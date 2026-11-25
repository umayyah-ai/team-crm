import { and, eq, inArray, sql } from "drizzle-orm";
import { GatewayRefusalError, listMembers } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import type { z } from "zod";
import { levelInput, reassignInput } from "./inputs";
import { db } from "@/db";
import { accessLevels, contacts, pipelineItems, pipelines, tasks, users } from "@/db/schema";
import { orgMembers, requireAdmin, type Actor } from "./access";
import { runBatch } from "./batch";

/** The team: everyone who has opened the app, with names from the Gateway's directory when it answers. */
export async function teamOverview(actor: Actor) {
  requireAdmin(actor);
  const [members, levels, directory] = await Promise.all([
    orgMembers(actor.orgId),
    db.select().from(accessLevels).where(eq(accessLevels.orgId, actor.orgId)),
    listMembers({ env }).then(
      (result) => result.members,
      (error) => {
        if (error instanceof GatewayRefusalError) return null;
        throw error;
      },
    ),
  ]);
  return {
    members: members.map((m) => {
      const entry = directory?.find((d) => d.id === m.id);
      return { ...m, name: entry?.name ?? "", admin: entry ? entry.role === "owner" || entry.role === "admin" : null };
    }),
    levels: levels.map(({ viewerId, ownerId, level }) => ({ viewerId, ownerId, level })),
    notOpenedYet: directory ? directory.filter((d) => !members.some((m) => m.id === d.id)).map((d) => d.email) : [],
  };
}

async function inOrg(actor: Actor, ...ids: string[]) {
  for (const id of ids) {
    const [row] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, id), eq(users.orgId, actor.orgId)));
    if (!row) throw new Error("That person isn't on the team");
  }
}

export async function setLevel(actor: Actor, input: z.infer<typeof levelInput>) {
  requireAdmin(actor);
  if (input.viewerId === input.ownerId) return;
  await inOrg(actor, input.viewerId, input.ownerId);
  if (input.level === "full") {
    await db.delete(accessLevels).where(and(eq(accessLevels.viewerId, input.viewerId), eq(accessLevels.ownerId, input.ownerId)));
    return;
  }
  await db
    .insert(accessLevels)
    .values({ orgId: actor.orgId, ...input })
    .onConflictDoUpdate({ target: [accessLevels.viewerId, accessLevels.ownerId], set: { level: input.level } });
}

/** Moves every contact, company, open task and pipeline item from one member to another. */
export async function reassignAll(actor: Actor, input: z.infer<typeof reassignInput>) {
  requireAdmin(actor);
  if (input.fromId === input.toId) throw new Error("Pick two different people");
  await inOrg(actor, input.fromId, input.toId);
  const [moved] = await db
    .select({ n: sql<number>`count(*)` })
    .from(contacts)
    .where(and(eq(contacts.orgId, actor.orgId), eq(contacts.assignedUserId, input.fromId)));
  const orgItems = db.select({ id: pipelineItems.id }).from(pipelineItems).innerJoin(pipelines, eq(pipelines.id, pipelineItems.pipelineId)).where(eq(pipelines.orgId, actor.orgId));
  await runBatch([
    db.update(contacts).set({ assignedUserId: input.toId }).where(and(eq(contacts.orgId, actor.orgId), eq(contacts.assignedUserId, input.fromId))),
    db.update(tasks).set({ assignedUserId: input.toId }).where(and(eq(tasks.orgId, actor.orgId), eq(tasks.assignedUserId, input.fromId), sql`${tasks.completedAt} is null`)),
    db.update(pipelineItems).set({ assignedUserId: input.toId }).where(and(eq(pipelineItems.assignedUserId, input.fromId), inArray(pipelineItems.id, orgItems))),
  ]);
  return { records: moved?.n ?? 0 };
}


