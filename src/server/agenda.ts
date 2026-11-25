import { and, asc, eq, gte, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { GatewayRefusalError, integrationStatus, sendEmail } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import type { z } from "zod";
import { agendaInput, validZone } from "./inputs";
import { db } from "@/db";
import { contacts, eventAttendees, events, tasks, users } from "@/db/schema";
import type { Actor } from "./access";

/** The local hour from which the morning email goes out. */
export const AGENDA_HOUR = 7;

/** The local date (YYYY-MM-DD) and hour in a time zone. */
export function localNow(timeZone: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** Whether the email capability can send now. */
async function emailReady(): Promise<boolean> {
  try {
    const status = await integrationStatus({ env, provider: "email" });
    return status.ready;
  } catch (error) {
    if (error instanceof GatewayRefusalError) return false;
    throw error;
  }
}

export async function agendaSettings(actor: Actor) {
  const [row] = await db.select({ enabled: users.agendaEnabled, timeZone: users.timeZone }).from(users).where(eq(users.id, actor.id));
  return { enabled: row?.enabled ?? false, timeZone: row?.timeZone ?? "UTC", emailReady: await emailReady() };
}

export async function setAgenda(actor: Actor, input: z.infer<typeof agendaInput>) {
  await db.update(users).set({ agendaEnabled: input.enabled, timeZone: input.timeZone }).where(eq(users.id, actor.id));
}

/** The agenda for one member on one local day. */
export async function agendaFor(user: { id: string; orgId: string; timeZone: string }, date: string) {
  const dayStart = zonedMidnight(date, user.timeZone);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const invited = db.select({ id: eventAttendees.eventId }).from(eventAttendees).where(eq(eventAttendees.userId, user.id));
  const [taskRows, eventRows] = await Promise.all([
    db
      .select({ title: tasks.title, dueDate: tasks.dueDate, contact: contacts.name })
      .from(tasks)
      .leftJoin(contacts, eq(contacts.id, tasks.contactId))
      .where(and(eq(tasks.orgId, user.orgId), eq(tasks.assignedUserId, user.id), isNull(tasks.completedAt), lte(tasks.dueDate, date)))
      .orderBy(asc(tasks.dueDate))
      .limit(100),
    db
      .select({ title: events.title, startsAt: events.startsAt, allDay: events.allDay, location: events.location })
      .from(events)
      .where(
        and(
          eq(events.orgId, user.orgId),
          lt(events.startsAt, dayEnd.toISOString()),
          gte(events.endsAt, dayStart.toISOString()),
          or(eq(events.ownerId, user.id), inArray(events.id, invited)),
        ),
      )
      .orderBy(events.startsAt)
      .limit(100),
  ]);
  return { tasks: taskRows, events: eventRows };
}

/** The UTC instant of local midnight on `date` in `timeZone`. */
function zonedMidnight(date: string, timeZone: string) {
  const guess = new Date(`${date}T00:00:00Z`);
  const local = new Date(guess.toLocaleString("en-US", { timeZone }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
}

function render(date: string, timeZone: string, agenda: Awaited<ReturnType<typeof agendaFor>>) {
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  const lines = [`Your agenda for ${date}`, ""];
  const overdue = agenda.tasks.filter((t) => t.dueDate < date);
  const today = agenda.tasks.filter((t) => t.dueDate === date);
  const task = (t: (typeof agenda.tasks)[number]) => `- ${t.title}${t.contact ? ` (${t.contact})` : ""}`;
  if (overdue.length) lines.push("Overdue tasks:", ...overdue.map((t) => `${task(t)}, due ${t.dueDate}`), "");
  lines.push("Tasks due today:", ...(today.length ? today.map(task) : ["- None"]), "");
  lines.push(
    "Events today:",
    ...(agenda.events.length
      ? agenda.events.map((e) => `- ${e.allDay ? "All day" : time(e.startsAt)}: ${e.title}${e.location ? ` at ${e.location}` : ""}`)
      : ["- None"]),
  );
  return lines.join("\n");
}

/** Hourly: sends each member who asked for it their agenda once, from 7:00 their time. */
export async function sendAgendas(now = new Date()) {
  const subscribers = await db.select().from(users).where(eq(users.agendaEnabled, true));
  for (const user of subscribers) {
    const { date, hour } = localNow(user.timeZone, now);
    if (hour < AGENDA_HOUR || user.agendaSentOn === date) continue;
    const agenda = await agendaFor(user, date);
    try {
      await sendEmail({
        env,
        for: { background: true, organizationId: user.orgId },
        message: { to: user.email, subject: `Your agenda for ${date}`, text: render(date, user.timeZone, agenda) },
      });
      await db.update(users).set({ agendaSentOn: date }).where(eq(users.id, user.id));
    } catch (error) {
      if (error instanceof GatewayRefusalError) continue;
      console.error("agenda email failed", error);
    }
  }
}
