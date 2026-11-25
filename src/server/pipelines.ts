import { and, asc, eq, gte, inArray, lte, notInArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { uuid as id, pipelineInput, renameInput, statusInput, moveStatusInput, pipelineFieldInput, itemInput, reportInput, fieldInput } from "./inputs";
import { db } from "@/db";
import {
  contacts,
  pipelineFields,
  pipelineItemValues,
  pipelineItems,
  pipelineStatuses,
  pipelines,
  statusChanges,
  tasks,
  users,
} from "@/db/schema";
import { NotAllowedError, canRead, canWrite, hiddenOwners, requireAdmin, type Actor } from "./access";
import { runBatch } from "./batch";
import { readableContact } from "./contacts";
import { cleanValues, toFieldDef } from "./fields";

async function orgPipeline(actor: Actor, pipelineId: string) {
  const [row] = await db.select().from(pipelines).where(and(eq(pipelines.id, pipelineId), eq(pipelines.orgId, actor.orgId)));
  return row ?? null;
}

/** Each pipeline with its statuses and fields. */
export async function listPipelines(actor: Actor) {
  const rows = await db.select().from(pipelines).where(eq(pipelines.orgId, actor.orgId)).orderBy(pipelines.createdAt);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const hidden = hiddenOwners(actor);
  const [statuses, fields, totals] = await Promise.all([
    db.select().from(pipelineStatuses).where(inArray(pipelineStatuses.pipelineId, ids)).orderBy(asc(pipelineStatuses.position)),
    db.select().from(pipelineFields).where(inArray(pipelineFields.pipelineId, ids)).orderBy(pipelineFields.createdAt),
    db
      .select({ pipelineId: pipelineItems.pipelineId, n: sql<number>`count(*)`, value: sql<number>`coalesce(sum(${pipelineItems.value}), 0)` })
      .from(pipelineItems)
      .where(and(inArray(pipelineItems.pipelineId, ids), hidden.length ? notInArray(pipelineItems.assignedUserId, hidden) : undefined))
      .groupBy(pipelineItems.pipelineId),
  ]);
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    statuses: statuses.filter((s) => s.pipelineId === p.id).map(({ id, name, kind }) => ({ id, name, kind })),
    fields: fields.filter((f) => f.pipelineId === p.id).map(toFieldDef),
    items: totals.find((t) => t.pipelineId === p.id)?.n ?? 0,
    value: totals.find((t) => t.pipelineId === p.id)?.value ?? 0,
  }));
}

export async function createPipeline(actor: Actor, input: z.infer<typeof pipelineInput>) {
  requireAdmin(actor);
  await db.insert(pipelines).values({ id: crypto.randomUUID(), orgId: actor.orgId, name: input.name });
}

export async function renamePipeline(actor: Actor, input: z.infer<typeof renameInput>) {
  requireAdmin(actor);
  await db.update(pipelines).set({ name: input.name }).where(and(eq(pipelines.id, input.id), eq(pipelines.orgId, actor.orgId)));
}

export async function deletePipeline(actor: Actor, pipelineId: string) {
  requireAdmin(actor);
  if (!(await orgPipeline(actor, pipelineId))) return;
  const items = db.select({ id: pipelineItems.id }).from(pipelineItems).where(eq(pipelineItems.pipelineId, pipelineId));
  await runBatch([
    db.update(tasks).set({ pipelineItemId: null }).where(inArray(tasks.pipelineItemId, items)),
    db.delete(statusChanges).where(inArray(statusChanges.itemId, items)),
    db.delete(pipelineItemValues).where(inArray(pipelineItemValues.itemId, items)),
    db.delete(pipelineItems).where(eq(pipelineItems.pipelineId, pipelineId)),
    db.delete(pipelineFields).where(eq(pipelineFields.pipelineId, pipelineId)),
    db.delete(pipelineStatuses).where(eq(pipelineStatuses.pipelineId, pipelineId)),
    db.delete(pipelines).where(eq(pipelines.id, pipelineId)),
  ]);
}

export async function addStatus(actor: Actor, input: z.infer<typeof statusInput>) {
  requireAdmin(actor);
  if (!(await orgPipeline(actor, input.pipelineId))) throw new NotAllowedError();
  const [last] = await db
    .select({ max: sql<number>`coalesce(max(${pipelineStatuses.position}), -1)` })
    .from(pipelineStatuses)
    .where(eq(pipelineStatuses.pipelineId, input.pipelineId));
  await db.insert(pipelineStatuses).values({ id: crypto.randomUUID(), ...input, position: (last?.max ?? -1) + 1 });
}

async function orgStatus(actor: Actor, statusId: string) {
  const [row] = await db
    .select({ status: pipelineStatuses })
    .from(pipelineStatuses)
    .innerJoin(pipelines, eq(pipelines.id, pipelineStatuses.pipelineId))
    .where(and(eq(pipelineStatuses.id, statusId), eq(pipelines.orgId, actor.orgId)));
  return row?.status ?? null;
}

export async function moveStatus(actor: Actor, input: z.infer<typeof moveStatusInput>) {
  requireAdmin(actor);
  const status = await orgStatus(actor, input.id);
  if (!status) throw new NotAllowedError();
  const all = await db.select().from(pipelineStatuses).where(eq(pipelineStatuses.pipelineId, status.pipelineId)).orderBy(asc(pipelineStatuses.position));
  const at = all.findIndex((s) => s.id === status.id);
  const other = all[input.direction === "up" ? at - 1 : at + 1];
  if (!other) return;
  await runBatch([
    db.update(pipelineStatuses).set({ position: other.position }).where(eq(pipelineStatuses.id, status.id)),
    db.update(pipelineStatuses).set({ position: status.position }).where(eq(pipelineStatuses.id, other.id)),
  ]);
}

export async function deleteStatus(actor: Actor, statusId: string) {
  requireAdmin(actor);
  const status = await orgStatus(actor, statusId);
  if (!status) return;
  const [used] = await db.select({ n: sql<number>`count(*)` }).from(pipelineItems).where(eq(pipelineItems.statusId, statusId));
  if ((used?.n ?? 0) > 0) throw new Error("Move the items in this status first");
  await db.delete(pipelineStatuses).where(eq(pipelineStatuses.id, statusId));
}

export async function addPipelineField(actor: Actor, input: z.infer<typeof pipelineFieldInput>) {
  requireAdmin(actor);
  if (!(await orgPipeline(actor, input.pipelineId))) throw new NotAllowedError();
  await db.insert(pipelineFields).values({
    id: crypto.randomUUID(),
    pipelineId: input.pipelineId,
    name: input.field.name,
    type: input.field.type,
    options: input.field.type === "dropdown" ? input.field.options.join("\n") : "",
  });
}

export async function deletePipelineField(actor: Actor, fieldId: string) {
  requireAdmin(actor);
  const [row] = await db
    .select({ id: pipelineFields.id })
    .from(pipelineFields)
    .innerJoin(pipelines, eq(pipelines.id, pipelineFields.pipelineId))
    .where(and(eq(pipelineFields.id, fieldId), eq(pipelines.orgId, actor.orgId)));
  if (!row) return;
  await runBatch([
    db.delete(pipelineItemValues).where(eq(pipelineItemValues.fieldId, fieldId)),
    db.delete(pipelineFields).where(eq(pipelineFields.id, fieldId)),
  ]);
}

const itemColumns = {
  id: pipelineItems.id,
  pipelineId: pipelineItems.pipelineId,
  contactId: pipelineItems.contactId,
  contactName: contacts.name,
  statusId: pipelineItems.statusId,
  value: pipelineItems.value,
  assignedUserId: pipelineItems.assignedUserId,
  assignee: users.email,
  createdAt: pipelineItems.createdAt,
};

async function withValues<T extends { id: string; assignedUserId: string }>(actor: Actor, rows: T[]) {
  const ids = rows.map((r) => r.id);
  const values = ids.length
    ? await db.select().from(pipelineItemValues).where(inArray(pipelineItemValues.itemId, ids.slice(0, 90)))
    : [];
  return rows.map((row) => ({
    ...row,
    values: Object.fromEntries(values.filter((v) => v.itemId === row.id).map((v) => [v.fieldId, v.value])),
    canEdit: canWrite(actor, row.assignedUserId),
  }));
}

/** A pipeline's items this member may read, filtered. */
export async function pipelineReport(actor: Actor, input: z.infer<typeof reportInput>) {
  const [pipeline] = (await listPipelines(actor)).filter((p) => p.id === input.pipelineId);
  if (!pipeline) return null;
  const hidden = hiddenOwners(actor);
  const rows = await db
    .select(itemColumns)
    .from(pipelineItems)
    .innerJoin(contacts, eq(contacts.id, pipelineItems.contactId))
    .leftJoin(users, eq(users.id, pipelineItems.assignedUserId))
    .where(
      and(
        eq(pipelineItems.pipelineId, pipeline.id),
        hidden.length ? notInArray(pipelineItems.assignedUserId, hidden) : undefined,
        input.statusId ? eq(pipelineItems.statusId, input.statusId) : undefined,
        input.assignee ? eq(pipelineItems.assignedUserId, input.assignee) : undefined,
        /^\d{4}-\d{2}-\d{2}$/.test(input.from) ? gte(pipelineItems.createdAt, input.from) : undefined,
        /^\d{4}-\d{2}-\d{2}$/.test(input.to) ? lte(pipelineItems.createdAt, `${input.to}T23:59:59.999Z`) : undefined,
      ),
    )
    .orderBy(sql`lower(${contacts.name})`)
    .limit(1000);
  const items = rows.length <= 90 ? await withValues(actor, rows) : rows.map((r) => ({ ...r, values: {}, canEdit: canWrite(actor, r.assignedUserId) }));
  return { pipeline, items };
}

/** The pipeline items of one record. */
export async function itemsForContact(actor: Actor, contactId: string) {
  const rows = await db
    .select({ ...itemColumns, pipelineName: pipelines.name })
    .from(pipelineItems)
    .innerJoin(contacts, eq(contacts.id, pipelineItems.contactId))
    .innerJoin(pipelines, eq(pipelines.id, pipelineItems.pipelineId))
    .leftJoin(users, eq(users.id, pipelineItems.assignedUserId))
    .where(and(eq(pipelineItems.contactId, contactId), eq(pipelines.orgId, actor.orgId)))
    .orderBy(pipelines.name);
  return withValues(actor, rows.filter((r) => canRead(actor, r.assignedUserId)));
}

/** Every readable item, for the task form's picker. */
export async function itemOptions(actor: Actor) {
  const rows = await db
    .select({ id: pipelineItems.id, owner: pipelineItems.assignedUserId, contactName: contacts.name, pipelineName: pipelines.name })
    .from(pipelineItems)
    .innerJoin(contacts, eq(contacts.id, pipelineItems.contactId))
    .innerJoin(pipelines, eq(pipelines.id, pipelineItems.pipelineId))
    .where(eq(pipelines.orgId, actor.orgId))
    .orderBy(pipelines.name, contacts.name)
    .limit(2000);
  return rows.filter((r) => canRead(actor, r.owner)).map((r) => ({ id: r.id, label: `${r.contactName} · ${r.pipelineName}` }));
}

export async function saveItem(actor: Actor, input: z.infer<typeof itemInput>) {
  const [pipeline] = (await listPipelines(actor)).filter((p) => p.id === input.pipelineId);
  if (!pipeline) throw new Error("That pipeline doesn't exist");
  if (!pipeline.statuses.some((s) => s.id === input.statusId)) throw new Error("Pick a status from this pipeline");
  const contact = await readableContact(actor, input.contactId);
  if (!contact) throw new Error("That record doesn't exist");
  const [assignee] = await db.select().from(users).where(and(eq(users.id, input.assignedUserId), eq(users.orgId, actor.orgId)));
  if (!assignee || !canWrite(actor, assignee.id)) throw new NotAllowedError("You can't assign items to that teammate.");
  const values = cleanValues(pipeline.fields, input.values);
  const fields = { statusId: input.statusId, value: input.value, assignedUserId: input.assignedUserId };
  if (input.id) {
    const [existing] = await db.select().from(pipelineItems).where(and(eq(pipelineItems.id, input.id), eq(pipelineItems.pipelineId, pipeline.id)));
    if (!existing || !canWrite(actor, existing.assignedUserId)) throw new NotAllowedError();
    const itemId = existing.id;
    await runBatch([
      db.update(pipelineItems).set(fields).where(eq(pipelineItems.id, itemId)),
      db.delete(pipelineItemValues).where(eq(pipelineItemValues.itemId, itemId)),
      ...values.map((v) => db.insert(pipelineItemValues).values({ ...v, itemId })),
      ...(existing.statusId !== input.statusId
        ? [db.insert(statusChanges).values({ id: crypto.randomUUID(), itemId, fromStatusId: existing.statusId, toStatusId: input.statusId, userId: actor.id })]
        : []),
    ]);
    return { id: itemId };
  }
  const itemId = crypto.randomUUID();
  await runBatch([
    db.insert(pipelineItems).values({ id: itemId, pipelineId: pipeline.id, contactId: contact.id, ...fields }),
    ...values.map((v) => db.insert(pipelineItemValues).values({ ...v, itemId })),
    db.insert(statusChanges).values({ id: crypto.randomUUID(), itemId, fromStatusId: null, toStatusId: input.statusId, userId: actor.id }),
  ]);
  return { id: itemId };
}

async function writableItem(actor: Actor, itemId: string) {
  const [row] = await db
    .select({ item: pipelineItems })
    .from(pipelineItems)
    .innerJoin(pipelines, eq(pipelines.id, pipelineItems.pipelineId))
    .where(and(eq(pipelineItems.id, itemId), eq(pipelines.orgId, actor.orgId)));
  if (!row || !canWrite(actor, row.item.assignedUserId)) throw new NotAllowedError();
  return row.item;
}

export async function moveItem(actor: Actor, itemId: string, statusId: string) {
  const item = await writableItem(actor, itemId);
  const [status] = await db.select().from(pipelineStatuses).where(and(eq(pipelineStatuses.id, statusId), eq(pipelineStatuses.pipelineId, item.pipelineId)));
  if (!status) throw new Error("Pick a status from this pipeline");
  if (item.statusId === statusId) return;
  await runBatch([
    db.update(pipelineItems).set({ statusId }).where(eq(pipelineItems.id, item.id)),
    db.insert(statusChanges).values({ id: crypto.randomUUID(), itemId: item.id, fromStatusId: item.statusId, toStatusId: statusId, userId: actor.id }),
  ]);
}

export async function deleteItem(actor: Actor, itemId: string) {
  const item = await writableItem(actor, itemId);
  await runBatch([
    db.update(tasks).set({ pipelineItemId: null }).where(eq(tasks.pipelineItemId, item.id)),
    db.delete(statusChanges).where(eq(statusChanges.itemId, item.id)),
    db.delete(pipelineItemValues).where(eq(pipelineItemValues.itemId, item.id)),
    db.delete(pipelineItems).where(eq(pipelineItems.id, item.id)),
  ]);
}


