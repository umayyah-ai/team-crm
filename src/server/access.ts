import { and, eq } from "drizzle-orm";
import { isAdmin, type EveryAppUser } from "@every-app/sdk/server";
import { db } from "@/db";
import { accessLevels, users } from "@/db/schema";

export type Level = "full" | "read" | "none";

/** The signed-in member, with what they may do with each teammate's records. */
export interface Actor {
  id: string;
  orgId: string;
  email: string;
  admin: boolean;
  /** Levels set for this member by teammate id; a teammate not listed is full. */
  levels: Map<string, Level>;
}

/** Records the member on first sight (email from the identity) and loads their access. */
export async function actorFor(user: EveryAppUser): Promise<Actor> {
  const [, rows] = await db.batch([
    db
      .insert(users)
      .values({ id: user.id, orgId: user.orgId, email: user.email })
      .onConflictDoUpdate({
        target: users.id,
        set: { email: user.email, orgId: user.orgId },
      }),
    db
      .select({ ownerId: accessLevels.ownerId, level: accessLevels.level })
      .from(accessLevels)
      .where(
        and(
          eq(accessLevels.viewerId, user.id),
          eq(accessLevels.orgId, user.orgId),
        ),
      ),
  ]);
  return {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    admin: isAdmin(user),
    levels: new Map(rows.map((row) => [row.ownerId, row.level])),
  };
}

export function levelFor(actor: Actor, ownerId: string): Level {
  if (actor.admin || ownerId === actor.id) return "full";
  return actor.levels.get(ownerId) ?? "full";
}

export const canRead = (actor: Actor, ownerId: string) =>
  levelFor(actor, ownerId) !== "none";
export const canWrite = (actor: Actor, ownerId: string) =>
  levelFor(actor, ownerId) === "full";

/** Teammates whose records this member may not see at all. */
export function hiddenOwners(actor: Actor): string[] {
  if (actor.admin) return [];
  return [...actor.levels]
    .filter(([ownerId, level]) => level === "none" && ownerId !== actor.id)
    .map(([ownerId]) => ownerId);
}

export class NotAllowedError extends Error {
  constructor(message = "You can't change this.") {
    super(message);
  }
}

export function requireAdmin(actor: Actor) {
  if (!actor.admin) throw new NotAllowedError("Only admins can do this.");
}

/** Every member of the organization the app has seen, by email. */
export async function orgMembers(orgId: string) {
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.orgId, orgId))
    .orderBy(users.email);
}
