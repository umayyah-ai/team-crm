import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { z } from "zod";
import { dayString as date, taskInput, taskListInput } from "./inputs";
import { db } from "@/db";
import { contacts, pipelineItems, pipelines, tasks, users } from "@/db/schema";
import { NotAllowedError, canRead, canWrite, type Actor } from "./access";
import { readableContact } from "./contacts";

const shown = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  dueDate: tasks.dueDate,
  contactId: tasks.contactId,
  contactName: contacts.name,
  pipelineItemId: tasks.pipelineItemId,
  pipelineName: pipelines.name,
  assignedUserId: tasks.assignedUserId,
  assignee: users.email,
  completedAt: tasks.completedAt,
  contactOwner: contacts.assignedUserId,
};

/** The tasks assigned to one member (default: the caller), open and the latest completed. */
export async function listTasks(actor: Actor, input: z.infer<typeof taskListInput>) {
  const assignee = input.assignee || actor.id;
  if (!canRead(actor, assignee)) return { open: [], completed: [], canEdit: false };
  const base = () => db
    .select(shown)
    .from(tasks)
    .leftJoin(contacts, eq(contacts.id, tasks.contactId))
    .leftJoin(pipelineItems, eq(pipelineItems.id, tasks.pipelineItemId))
    .leftJoin(pipelines, eq(pipelines.id, pipelineItems.pipelineId))
    .leftJoin(users, eq(users.id, tasks.assignedUserId));
  const mine = and(eq(tasks.orgId, actor.orgId), eq(tasks.assignedUserId, assignee));
  const [open, completed] = await Promise.all([
    base().where(and(mine, isNull(tasks.completedAt))).orderBy(asc(tasks.dueDate), asc(tasks.createdAt)),
    base().where(and(mine, isNotNull(tasks.completedAt))).orderBy(desc(tasks.completedAt)).limit(50),
  ]);
  const hide = (rows: typeof open) =>
    rows.map(({ contactOwner, ...row }) =>
      contactOwner && !canRead(actor, contactOwner) ? { ...row, contactId: null, contactName: null } : row,
    );
  return { open: hide(open), completed: hide(completed), canEdit: canWrite(actor, assignee) };
}

async function writableTask(actor: Actor, id: string) {
  const [row] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.orgId, actor.orgId)));
  if (!row || !(canWrite(actor, row.assignedUserId) || row.createdBy === actor.id)) throw new NotAllowedError();
  return row;
}

export async function saveTask(actor: Actor, input: z.infer<typeof taskInput>) {
  const [assignee] = await db.select().from(users).where(and(eq(users.id, input.assignedUserId), eq(users.orgId, actor.orgId)));
  if (!assignee) throw new Error("Pick a teammate to assign it to");
  if (!canWrite(actor, assignee.id)) throw new NotAllowedError("You can't assign tasks to that teammate.");
  if (input.contactId && !(await readableContact(actor, input.contactId))) throw new Error("That record doesn't exist");
  if (input.pipelineItemId) {
    const [item] = await db
      .select({ owner: pipelineItems.assignedUserId })
      .from(pipelineItems)
      .innerJoin(pipelines, eq(pipelines.id, pipelineItems.pipelineId))
      .where(and(eq(pipelineItems.id, input.pipelineItemId), eq(pipelines.orgId, actor.orgId)));
    if (!item || !canRead(actor, item.owner)) throw new Error("That pipeline item doesn't exist");
  }
  const { id, ...fields } = input;
  if (id) {
    await writableTask(actor, id);
    await db.update(tasks).set(fields).where(eq(tasks.id, id));
    return { id };
  }
  const newId = crypto.randomUUID();
  await db.insert(tasks).values({ ...fields, id: newId, orgId: actor.orgId, createdBy: actor.id });
  return { id: newId };
}

export async function setTaskDone(actor: Actor, id: string, done: boolean) {
  await writableTask(actor, id);
  await db.update(tasks).set({ completedAt: done ? new Date().toISOString() : null }).where(eq(tasks.id, id));
}

export async function deleteTask(actor: Actor, id: string) {
  await writableTask(actor, id);
  await db.delete(tasks).where(eq(tasks.id, id));
}


