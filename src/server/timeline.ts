import { and, eq, inArray } from "drizzle-orm";
import { env } from "cloudflare:workers";
import type { z } from "zod";
import { noteInput, noteEditInput } from "./inputs";
import { db } from "@/db";
import {
  eventAttendees,
  eventContacts,
  events,
  files,
  notes,
  pipelineItems,
  pipelineStatuses,
  pipelines,
  statusChanges,
  tasks,
  users,
} from "@/db/schema";
import { NotAllowedError, canRead, canWrite, type Actor } from "./access";
import { readableContact, writableContact } from "./contacts";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type TimelineEntry = {
  id: string;
  at: string;
  by: string;
  mine: boolean;
  canChange: boolean;
} & (
  | { type: "note"; body: string; edited: boolean }
  | { type: "file"; name: string; size: number }
  | { type: "task"; title: string; dueDate: string; done: boolean }
  | { type: "event"; title: string; startsAt: string; allDay: boolean }
  | { type: "move"; pipeline: string; from: string | null; to: string }
);

export async function addNote(actor: Actor, input: z.infer<typeof noteInput>) {
  await writableContact(actor, input.contactId);
  await db.insert(notes).values({
    id: crypto.randomUUID(),
    contactId: input.contactId,
    authorId: actor.id,
    body: input.body,
  });
}

/** A note or file this member may change: their own on a record they can edit, or any as admin. */
async function changeable<T extends { authorId: string; contactId: string }>(actor: Actor, row: T | undefined) {
  if (!row) throw new NotAllowedError();
  await writableContact(actor, row.contactId);
  if (!actor.admin && row.authorId !== actor.id) throw new NotAllowedError();
  return row;
}

export async function editNote(actor: Actor, input: z.infer<typeof noteEditInput>) {
  const [row] = await db.select().from(notes).where(eq(notes.id, input.id));
  await changeable(actor, row);
  await db.update(notes).set({ body: input.body, editedAt: new Date().toISOString() }).where(eq(notes.id, input.id));
}

export async function deleteNote(actor: Actor, id: string) {
  const [row] = await db.select().from(notes).where(eq(notes.id, id));
  await changeable(actor, row);
  await db.delete(notes).where(eq(notes.id, id));
}

export async function uploadFile(actor: Actor, contactId: string, file: File) {
  await writableContact(actor, contactId);
  if (file.size > MAX_FILE_BYTES) throw new Error("Files can be up to 25 MB");
  const id = crypto.randomUUID();
  const name = file.name.replace(/[\r\n"\\/]/g, "_").slice(0, 200) || "file";
  const contentType = file.type || "application/octet-stream";
  await env.files.put(id, file.stream(), { httpMetadata: { contentType } });
  await db.insert(files).values({ id, contactId, authorId: actor.id, name, size: file.size, contentType });
  return { id };
}

/** The stored file, when this member may read the record it's attached to. */
export async function readFile(actor: Actor, id: string) {
  const [row] = await db.select().from(files).where(eq(files.id, id));
  if (!row || !(await readableContact(actor, row.contactId))) return null;
  const object = await env.files.get(id);
  return object ? { row, object } : null;
}

export async function deleteFile(actor: Actor, id: string) {
  const [row] = await db.select().from(files).where(eq(files.id, id));
  await changeable(actor, row);
  await db.delete(files).where(eq(files.id, id));
  await env.files.delete(id);
}

/** One history for a record, newest first. */
export async function timeline(actor: Actor, contactId: string): Promise<TimelineEntry[]> {
  const contact = await readableContact(actor, contactId);
  if (!contact) return [];
  const editable = canWrite(actor, contact.assignedUserId);
  const [people, noteRows, fileRows, taskRows, eventRows, moveRows] = await Promise.all([
    db.select({ id: users.id, email: users.email }).from(users).where(eq(users.orgId, actor.orgId)),
    db.select().from(notes).where(eq(notes.contactId, contactId)),
    db.select().from(files).where(eq(files.contactId, contactId)),
    db.select().from(tasks).where(and(eq(tasks.orgId, actor.orgId), eq(tasks.contactId, contactId))),
    db
      .select({ event: events })
      .from(eventContacts)
      .innerJoin(events, eq(events.id, eventContacts.eventId))
      .where(and(eq(eventContacts.contactId, contactId), eq(events.orgId, actor.orgId))),
    db
      .select({
        id: statusChanges.id,
        at: statusChanges.createdAt,
        userId: statusChanges.userId,
        fromStatusId: statusChanges.fromStatusId,
        toStatusId: statusChanges.toStatusId,
        pipeline: pipelines.name,
        itemOwner: pipelineItems.assignedUserId,
      })
      .from(statusChanges)
      .innerJoin(pipelineItems, eq(pipelineItems.id, statusChanges.itemId))
      .innerJoin(pipelines, eq(pipelines.id, pipelineItems.pipelineId))
      .where(eq(pipelineItems.contactId, contactId)),
  ]);
  const invited = eventRows.length
    ? await db
        .select()
        .from(eventAttendees)
        .where(and(inArray(eventAttendees.eventId, eventRows.map((r) => r.event.id)), eq(eventAttendees.userId, actor.id)))
    : [];
  const statusIds = [...new Set(moveRows.flatMap((m) => [m.toStatusId, m.fromStatusId ?? m.toStatusId]))];
  const statuses = statusIds.length
    ? await db.select({ id: pipelineStatuses.id, name: pipelineStatuses.name }).from(pipelineStatuses).where(inArray(pipelineStatuses.id, statusIds))
    : [];
  const email = (id: string) => people.find((p) => p.id === id)?.email ?? "A former member";
  const statusName = (id: string) => statuses.find((s) => s.id === id)?.name ?? "a removed status";
  const mayChange = (authorId: string) => editable && (actor.admin || authorId === actor.id);
  const entries: TimelineEntry[] = [
    ...noteRows.map((n): TimelineEntry => ({
      type: "note", id: n.id, at: n.createdAt, by: email(n.authorId), mine: n.authorId === actor.id,
      canChange: mayChange(n.authorId), body: n.body, edited: n.editedAt !== null,
    })),
    ...fileRows.map((f): TimelineEntry => ({
      type: "file", id: f.id, at: f.createdAt, by: email(f.authorId), mine: f.authorId === actor.id,
      canChange: mayChange(f.authorId), name: f.name, size: f.size,
    })),
    ...taskRows
      .filter((t) => canRead(actor, t.assignedUserId))
      .map((t): TimelineEntry => ({
        type: "task", id: t.id, at: t.createdAt, by: email(t.createdBy), mine: t.createdBy === actor.id,
        canChange: false, title: t.title, dueDate: t.dueDate, done: t.completedAt !== null,
      })),
    ...eventRows
      .map((r) => r.event)
      .filter((e) => e.ownerId === actor.id || canRead(actor, e.ownerId) || invited.some((i) => i.eventId === e.id))
      .map((e): TimelineEntry => ({
        type: "event", id: e.id, at: e.createdAt, by: email(e.ownerId), mine: e.ownerId === actor.id,
        canChange: false, title: e.title, startsAt: e.startsAt, allDay: e.allDay,
      })),
    ...moveRows
      .filter((m) => canRead(actor, m.itemOwner))
      .map((m): TimelineEntry => ({
        type: "move", id: m.id, at: m.at, by: email(m.userId), mine: m.userId === actor.id, canChange: false,
        pipeline: m.pipeline, from: m.fromStatusId ? statusName(m.fromStatusId) : null, to: statusName(m.toStatusId),
      })),
  ];
  return entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}


