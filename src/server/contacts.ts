import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,

  like,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { env } from "cloudflare:workers";
import type { z } from "zod";
import { contactKind as kind, textField as text, listInput, contactInput } from "./inputs";
import { db } from "@/db";
import {
  contacts,
  customFieldValues,
  eventContacts,
  files,
  groupMembers,
  groups,
  notes,
  pipelineItemValues,
  pipelineItems,
  statusChanges,
  tasks,
  users,
} from "@/db/schema";
import {
  NotAllowedError,
  canRead,
  canWrite,
  hiddenOwners,
  orgMembers,
  type Actor,
} from "./access";
import { runBatch } from "./batch";
import { cleanValues, listFields, valuesFor } from "./fields";

export const PAGE_SIZE = 25;

/** Rows this member may see at all: in their organization, not assigned to a hidden teammate. */
export function visibleContacts(actor: Actor): SQL {
  const hidden = hiddenOwners(actor);
  return and(
    eq(contacts.orgId, actor.orgId),
    hidden.length ? notInArray(contacts.assignedUserId, hidden) : undefined,
  )!;
}

/** Groups this member may see: shared ones and their own private ones. */
export function visibleGroups(actor: Actor): SQL {
  return and(
    eq(groups.orgId, actor.orgId),
    or(eq(groups.isPrivate, false), eq(groups.ownerId, actor.id)),
  )!;
}

function searchFilter(q: string): SQL | undefined {
  if (!q) return undefined;
  const pattern = `%${q}%`;
  return or(
    like(contacts.name, pattern),
    like(contacts.title, pattern),
    like(contacts.emails, pattern),
    like(contacts.phones, pattern),
    like(contacts.address, pattern),
    like(contacts.background, pattern),
    exists(
      db
        .select({ one: sql`1` })
        .from(customFieldValues)
        .where(
          and(
            eq(customFieldValues.contactId, contacts.id),
            like(customFieldValues.value, pattern),
          ),
        ),
    ),
  );
}

export async function listContacts(actor: Actor, input: z.infer<typeof listInput>) {
  const where = and(
    visibleContacts(actor),
    eq(contacts.kind, input.kind),
    searchFilter(input.q),
    input.assignee ? eq(contacts.assignedUserId, input.assignee) : undefined,
    input.groupId
      ? exists(
          db
            .select({ one: sql`1` })
            .from(groupMembers)
            .innerJoin(groups, eq(groups.id, groupMembers.groupId))
            .where(
              and(
                eq(groupMembers.contactId, contacts.id),
                eq(groups.id, input.groupId),
                visibleGroups(actor),
              ),
            ),
        )
      : undefined,
  );
  const order =
    input.sort === "name-desc"
      ? [desc(sql`lower(${contacts.name})`)]
      : input.sort === "updated"
        ? [desc(contacts.updatedAt)]
        : input.sort === "created"
          ? [desc(contacts.createdAt)]
          : [asc(sql`lower(${contacts.name})`)];
  const company = db
    .select({ id: contacts.id, name: contacts.name })
    .from(contacts)
    .as("company");
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        title: contacts.title,
        emails: contacts.emails,
        phones: contacts.phones,
        companyName: company.name,
        assignee: users.email,
        updatedAt: contacts.updatedAt,
      })
      .from(contacts)
      .leftJoin(company, eq(company.id, contacts.companyId))
      .leftJoin(users, eq(users.id, contacts.assignedUserId))
      .where(where)
      .orderBy(...order, contacts.id)
      .limit(PAGE_SIZE)
      .offset((input.page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(contacts).where(where),
  ]);
  return {
    rows: rows.map((row) => ({
      ...row,
      email: firstLine(row.emails),
      phone: firstLine(row.phones),
    })),
    total: total?.n ?? 0,
    page: input.page,
    pageSize: PAGE_SIZE,
  };
}

const firstLine = (value: string) => value.split("\n")[0] ?? "";

/** The contact, when this member may read it. */
export async function readableContact(actor: Actor, id: string) {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, actor.orgId)));
  if (!row || !canRead(actor, row.assignedUserId)) return null;
  return row;
}

/** The contact, when this member may change it; throws otherwise. */
export async function writableContact(actor: Actor, id: string) {
  const row = await readableContact(actor, id);
  if (!row || !canWrite(actor, row.assignedUserId)) throw new NotAllowedError();
  return row;
}

export async function getContact(actor: Actor, id: string) {
  const row = await readableContact(actor, id);
  if (!row) return null;
  const [fields, values, members, memberships] = await Promise.all([
    listFields(actor),
    valuesFor([row.id]),
    orgMembers(actor.orgId),
    db
      .select({ id: groups.id, name: groups.name, isPrivate: groups.isPrivate })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(and(eq(groupMembers.contactId, row.id), visibleGroups(actor)))
      .orderBy(groups.name),
  ]);
  const company =
    row.companyId ? await readableContact(actor, row.companyId) : null;
  const people =
    row.kind === "company"
      ? await db
          .select({ id: contacts.id, name: contacts.name, title: contacts.title })
          .from(contacts)
          .where(and(visibleContacts(actor), eq(contacts.companyId, row.id)))
          .orderBy(contacts.name)
      : [];
  return {
    contact: row,
    company: company ? { id: company.id, name: company.name } : null,
    people,
    fields,
    values: values.get(row.id) ?? {},
    assignee: members.find((m) => m.id === row.assignedUserId)?.email ?? "",
    groups: memberships,
    canEdit: canWrite(actor, row.assignedUserId),
  };
}

async function checkAssignee(actor: Actor, userId: string) {
  const [member] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, actor.orgId)));
  if (!member) throw new Error("Pick a teammate to assign it to");
  if (!canWrite(actor, userId))
    throw new NotAllowedError("You can't assign records to that teammate.");
}

export async function saveContact(actor: Actor, input: z.infer<typeof contactInput>) {
  const fields = await listFields(actor);
  const values = cleanValues(fields, input.values);
  await checkAssignee(actor, input.assignedUserId);
  let companyId: string | null = null;
  if (input.kind === "person" && input.companyId) {
    const company = await readableContact(actor, input.companyId);
    if (!company || company.kind !== "company") throw new Error("That company doesn't exist");
    companyId = company.id;
  }
  const record = {
    name: input.name,
    title: input.kind === "person" ? input.title : "",
    companyId,
    emails: lines(input.emails),
    phones: lines(input.phones),
    address: input.address,
    background: input.background,
    assignedUserId: input.assignedUserId,
    updatedAt: new Date().toISOString(),
  };
  let id = input.id;
  if (id) {
    const existing = await writableContact(actor, id);
    if (existing.kind !== input.kind) throw new Error("That record doesn't exist");
    await runBatch([
      db.update(contacts).set(record).where(eq(contacts.id, id)),
      db.delete(customFieldValues).where(eq(customFieldValues.contactId, id)),
      ...values.map((v) => db.insert(customFieldValues).values({ ...v, contactId: id! })),
    ]);
  } else {
    id = crypto.randomUUID();
    await runBatch([
      db.insert(contacts).values({ ...record, id, orgId: actor.orgId, kind: input.kind }),
      ...values.map((v) => db.insert(customFieldValues).values({ ...v, contactId: id! })),
    ]);
  }
  return { id };
}

const lines = (value: string) =>
  value
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");

export async function deleteContact(actor: Actor, id: string) {
  const row = await writableContact(actor, id);
  const fileRows = await db.select({ id: files.id }).from(files).where(eq(files.contactId, id));
  const items = db.select({ id: pipelineItems.id }).from(pipelineItems).where(eq(pipelineItems.contactId, id));
  await runBatch([
    db.delete(notes).where(eq(notes.contactId, id)),
    db.delete(files).where(eq(files.contactId, id)),
    db.delete(customFieldValues).where(eq(customFieldValues.contactId, id)),
    db.delete(groupMembers).where(eq(groupMembers.contactId, id)),
    db.delete(eventContacts).where(eq(eventContacts.contactId, id)),
    db.update(tasks).set({ contactId: null }).where(eq(tasks.contactId, id)),
    db.update(tasks).set({ pipelineItemId: null }).where(inArray(tasks.pipelineItemId, items)),
    db.delete(statusChanges).where(inArray(statusChanges.itemId, items)),
    db.delete(pipelineItemValues).where(inArray(pipelineItemValues.itemId, items)),
    db.delete(pipelineItems).where(eq(pipelineItems.contactId, id)),
    db.update(contacts).set({ companyId: null }).where(eq(contacts.companyId, id)),
    db.delete(contacts).where(eq(contacts.id, row.id)),
  ]);
  if (fileRows.length) await env.files.delete(fileRows.map((f) => f.id));
}

/** Every record this member may read, for pickers. */
export async function contactOptions(actor: Actor) {
  return db
    .select({ id: contacts.id, name: contacts.name, kind: contacts.kind })
    .from(contacts)
    .where(visibleContacts(actor))
    .orderBy(sql`lower(${contacts.name})`)
    .limit(2000);
}

/** The companies this member may read, for the company picker. */
export async function companyOptions(actor: Actor) {
  return db
    .select({ id: contacts.id, name: contacts.name })
    .from(contacts)
    .where(and(visibleContacts(actor), eq(contacts.kind, "company")))
    .orderBy(sql`lower(${contacts.name})`)
    .limit(2000);
}

/** Every readable person and company as CSV, with custom fields as columns. */
export async function exportCsv(actor: Actor) {
  const company = db.select({ id: contacts.id, name: contacts.name }).from(contacts).as("company");
  const [fields, rows, values] = await Promise.all([
    listFields(actor),
    db
      .select({
        id: contacts.id,
        kind: contacts.kind,
        name: contacts.name,
        title: contacts.title,
        companyName: company.name,
        emails: contacts.emails,
        phones: contacts.phones,
        address: contacts.address,
        background: contacts.background,
        assignee: users.email,
      })
      .from(contacts)
      .leftJoin(company, eq(company.id, contacts.companyId))
      .leftJoin(users, eq(users.id, contacts.assignedUserId))
      .where(visibleContacts(actor))
      .orderBy(contacts.kind, sql`lower(${contacts.name})`),
    db
      .select({ contactId: customFieldValues.contactId, fieldId: customFieldValues.fieldId, value: customFieldValues.value })
      .from(customFieldValues)
      .innerJoin(contacts, eq(contacts.id, customFieldValues.contactId))
      .where(visibleContacts(actor)),
  ]);
  const byContact = new Map<string, Record<string, string>>();
  for (const v of values) {
    const entry = byContact.get(v.contactId) ?? {};
    entry[v.fieldId] = v.value;
    byContact.set(v.contactId, entry);
  }
  const header = ["Type", "Name", "Title", "Company", "Emails", "Phones", "Address", "Background", "Assigned to", ...fields.map((f) => f.name)];
  const body = rows.map((row) => [
    row.kind === "company" ? "Company" : "Person",
    row.name,
    row.title,
    row.companyName ?? "",
    row.emails.split("\n").join("; "),
    row.phones.split("\n").join("; "),
    row.address,
    row.background,
    row.assignee ?? "",
    ...fields.map((f) => byContact.get(row.id)?.[f.id] ?? ""),
  ]);
  return [header, ...body].map((cells) => cells.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(value: string) {
  // A leading =, +, - or @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}


