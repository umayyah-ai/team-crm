import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { fieldTypes, fieldInput } from "./inputs";
import { db } from "@/db";
import { customFieldValues, customFields } from "@/db/schema";
import { requireAdmin, type Actor } from "./access";

export interface FieldDef {
  id: string;
  name: string;
  type: (typeof fieldTypes)[number];
  options: string[];
}

export function toFieldDef(row: {
  id: string;
  name: string;
  type: FieldDef["type"];
  options: string;
}): FieldDef {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    options: row.options ? row.options.split("\n") : [],
  };
}

export async function listFields(actor: Actor): Promise<FieldDef[]> {
  const rows = await db
    .select()
    .from(customFields)
    .where(eq(customFields.orgId, actor.orgId))
    .orderBy(customFields.createdAt);
  return rows.map(toFieldDef);
}

export async function createField(
  actor: Actor,
  input: z.infer<typeof fieldInput>,
) {
  requireAdmin(actor);
  await db.insert(customFields).values({
    id: crypto.randomUUID(),
    orgId: actor.orgId,
    name: input.name,
    type: input.type,
    options: input.type === "dropdown" ? input.options.join("\n") : "",
  });
}

export async function deleteField(actor: Actor, id: string) {
  requireAdmin(actor);
  const [field] = await db
    .select({ id: customFields.id })
    .from(customFields)
    .where(and(eq(customFields.id, id), eq(customFields.orgId, actor.orgId)));
  if (!field) return;
  await db.batch([
    db.delete(customFieldValues).where(eq(customFieldValues.fieldId, id)),
    db.delete(customFields).where(eq(customFields.id, id)),
  ]);
}

/** Checks values against their fields; drops blanks and unknown fields. */
export function cleanValues(
  fields: FieldDef[],
  values: Record<string, string>,
): { fieldId: string; value: string }[] {
  const out: { fieldId: string; value: string }[] = [];
  for (const field of fields) {
    const value = (values[field.id] ?? "").trim();
    if (!value) continue;
    if (field.type === "number" && !Number.isFinite(Number(value)))
      throw new Error(`${field.name} must be a number`);
    if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Error(`${field.name} must be a date`);
    if (field.type === "dropdown" && !field.options.includes(value))
      throw new Error(`Pick one of the options for ${field.name}`);
    out.push({ fieldId: field.id, value: value.slice(0, 2000) });
  }
  return out;
}

export async function valuesFor(contactIds: string[]) {
  if (contactIds.length === 0) return new Map<string, Record<string, string>>();
  const rows = await db
    .select()
    .from(customFieldValues)
    .where(inArray(customFieldValues.contactId, contactIds));
  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const entry = map.get(row.contactId) ?? {};
    entry[row.fieldId] = row.value;
    map.set(row.contactId, entry);
  }
  return map;
}
