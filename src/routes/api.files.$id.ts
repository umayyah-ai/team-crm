import { createFileRoute } from "@tanstack/react-router";
import { requireEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { actorFor } from "@/server/access";
import { readFile } from "@/server/timeline";

// Download a timeline file, for members who may read its record.
export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const actor = await actorFor(await requireEveryAppUser(request, env));
        const found = /^[0-9a-f-]{36}$/.test(params.id) ? await readFile(actor, params.id) : null;
        if (!found) return new Response("Not found", { status: 404 });
        return new Response(found.object.body, {
          headers: {
            "content-type": found.row.contentType,
            "content-length": String(found.row.size),
            "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(found.row.name)}`,
            "x-content-type-options": "nosniff",
            "cache-control": "private, no-store",
          },
        });
      },
    },
  },
});
