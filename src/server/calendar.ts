import { and, eq, gte, inArray, lt, or } from "drizzle-orm";
import type { z } from "zod";
import { isoTime as iso, eventInput, rangeInput } from "./inputs";
import { db } from "@/db";
import { contacts, eventAttendees, eventContacts, events, users } from "@/db/schema";
import { NotAllowedError, canRead, type Actor } from "./access";
import { runBatch } from "./batch";
import { readableContact } from "./contacts";

/**
 * Events in a range: the member's own and those they're invited to, plus
 * the chosen teammates' events this member may read.
 */
export async function listEvents(actor: Actor, input: z.infer<typeof rangeInput>) {
  const teammates = input.teammates.filter((id) => id !== actor.id && canRead(actor, id));
  const invited = db.select({ id: eventAttendees.eventId }).from(eventAttendees).where(eq(eventAttendees.userId, actor.id));
  const rows = await db
    .select({ event: events, owner: users.email })
    .from(events)
    .leftJoin(users, eq(users.id, events.ownerId))
    .where(
      and(
        eq(events.orgId, actor.orgId),
        lt(events.startsAt, input.to),
        gte(events.endsAt, input.from),
        or(
          eq(events.ownerId, actor.id),
          inArray(events.id, invited),
          teammates.length ? inArray(events.ownerId, teammates) : undefined,
        ),
      ),
    )
    .orderBy(events.startsAt)
    .limit(1000);
  return withLinks(actor, rows);
}

async function withLinks(actor: Actor, rows: { event: typeof events.$inferSelect; owner: string | null }[]) {
  const ids = rows.map((r) => r.event.id).slice(0, 90);
  const [attendees, links] = ids.length
    ? await Promise.all([
        db.select({ eventId: eventAttendees.eventId, userId: eventAttendees.userId, email: users.email })
          .from(eventAttendees).innerJoin(users, eq(users.id, eventAttendees.userId)).where(inArray(eventAttendees.eventId, ids)),
        db.select({ eventId: eventContacts.eventId, id: contacts.id, name: contacts.name, owner: contacts.assignedUserId })
          .from(eventContacts).innerJoin(contacts, eq(contacts.id, eventContacts.contactId)).where(inArray(eventContacts.eventId, ids)),
      ])
    : [[], []];
  return rows.map(({ event, owner }) => ({
    ...event,
    owner: owner ?? "",
    mine: event.ownerId === actor.id,
    canEdit: event.ownerId === actor.id || actor.admin,
    attendees: attendees.filter((a) => a.eventId === event.id).map(({ userId, email }) => ({ id: userId, email })),
    contacts: links.filter((l) => l.eventId === event.id && canRead(actor, l.owner)).map(({ id, name }) => ({ id, name })),
  }));
}

export async function saveEvent(actor: Actor, input: z.infer<typeof eventInput>) {
  const { id, attendeeIds, contactIds, ...fields } = input;
  const members = attendeeIds.length
    ? await db.select({ id: users.id }).from(users).where(and(eq(users.orgId, actor.orgId), inArray(users.id, attendeeIds)))
    : [];
  const linked: string[] = [];
  for (const contactId of contactIds) {
    if (await readableContact(actor, contactId)) linked.push(contactId);
    else throw new Error("That record doesn't exist");
  }
  let eventId = id;
  if (eventId) {
    const [existing] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.orgId, actor.orgId)));
    if (!existing || !(existing.ownerId === actor.id || actor.admin)) throw new NotAllowedError();
  }
  const finalId = eventId ?? crypto.randomUUID();
  await runBatch([
    eventId
      ? db.update(events).set(fields).where(eq(events.id, finalId))
      : db.insert(events).values({ ...fields, id: finalId, orgId: actor.orgId, ownerId: actor.id }),
    db.delete(eventAttendees).where(eq(eventAttendees.eventId, finalId)),
    db.delete(eventContacts).where(eq(eventContacts.eventId, finalId)),
    ...members.filter((m) => m.id !== actor.id).map((m) => db.insert(eventAttendees).values({ eventId: finalId, userId: m.id })),
    ...linked.map((contactId) => db.insert(eventContacts).values({ eventId: finalId, contactId })),
  ]);
  eventId = finalId;
  return { id: eventId };
}

export async function deleteEvent(actor: Actor, id: string) {
  const [existing] = await db.select().from(events).where(and(eq(events.id, id), eq(events.orgId, actor.orgId)));
  if (!existing || !(existing.ownerId === actor.id || actor.admin)) throw new NotAllowedError();
  await runBatch([
    db.delete(eventAttendees).where(eq(eventAttendees.eventId, id)),
    db.delete(eventContacts).where(eq(eventContacts.eventId, id)),
    db.delete(events).where(eq(events.id, id)),
  ]);
}
