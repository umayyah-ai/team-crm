import { and, count, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { groupInput, membershipInput } from "./inputs";
import { db } from "@/db";
import { contacts, groupMembers, groups } from "@/db/schema";
import { NotAllowedError, type Actor } from "./access";
import { runBatch } from "./batch";
import { visibleContacts, visibleGroups, writableContact } from "./contacts";

export async function listGroups(actor: Actor) {
  const [rows, sizes] = await Promise.all([
    db
      .select({ id: groups.id, name: groups.name, isPrivate: groups.isPrivate, ownerId: groups.ownerId })
      .from(groups)
      .where(visibleGroups(actor))
      .orderBy(sql`lower(${groups.name})`),
    db
      .select({ groupId: groupMembers.groupId, n: count() })
      .from(groupMembers)
      .innerJoin(contacts, eq(contacts.id, groupMembers.contactId))
      .where(visibleContacts(actor))
      .groupBy(groupMembers.groupId),
  ]);
  return rows.map((row) => ({
    ...row,
    size: sizes.find((s) => s.groupId === row.id)?.n ?? 0,
    canChange: row.ownerId === actor.id || (actor.admin && !row.isPrivate),
  }));
}

async function visibleGroup(actor: Actor, id: string) {
  const [row] = await db.select().from(groups).where(and(eq(groups.id, id), visibleGroups(actor)));
  return row ?? null;
}

export async function getGroup(actor: Actor, id: string) {
  const group = await visibleGroup(actor, id);
  if (!group) return null;
  const members = await db
    .select({ id: contacts.id, name: contacts.name, kind: contacts.kind })
    .from(groupMembers)
    .innerJoin(contacts, eq(contacts.id, groupMembers.contactId))
    .where(and(eq(groupMembers.groupId, id), visibleContacts(actor)))
    .orderBy(sql`lower(${contacts.name})`);
  return {
    group: { id: group.id, name: group.name, isPrivate: group.isPrivate },
    members,
    canChange: group.ownerId === actor.id || (actor.admin && !group.isPrivate),
  };
}

export async function createGroup(actor: Actor, input: z.infer<typeof groupInput>) {
  await db.insert(groups).values({ id: crypto.randomUUID(), orgId: actor.orgId, ownerId: actor.id, ...input });
}

export async function deleteGroup(actor: Actor, id: string) {
  const group = await visibleGroup(actor, id);
  if (!group || !(group.ownerId === actor.id || (actor.admin && !group.isPrivate))) throw new NotAllowedError();
  await runBatch([
    db.delete(groupMembers).where(eq(groupMembers.groupId, id)),
    db.delete(groups).where(eq(groups.id, id)),
  ]);
}

/** Adding to or removing from a group needs the group visible and the record editable. */
async function checkMembership(actor: Actor, input: z.infer<typeof membershipInput>) {
  const group = await visibleGroup(actor, input.groupId);
  if (!group) throw new NotAllowedError();
  await writableContact(actor, input.contactId);
}

export async function addToGroup(actor: Actor, input: z.infer<typeof membershipInput>) {
  await checkMembership(actor, input);
  await db.insert(groupMembers).values(input).onConflictDoNothing();
}

export async function removeFromGroup(actor: Actor, input: z.infer<typeof membershipInput>) {
  await checkMembership(actor, input);
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, input.groupId), eq(groupMembers.contactId, input.contactId)));
}


