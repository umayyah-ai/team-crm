import { createMiddleware } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { actorFor } from "@/server/access";

/** The verified member (ensureUserMiddleware) and what they may access. */
export const actorMiddleware = createMiddleware({ type: "function" })
  .middleware([ensureUserMiddleware])
  .server(async ({ next, context }) => next({ context: { actor: await actorFor(context.user) } }));
