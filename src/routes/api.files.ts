import { createFileRoute } from "@tanstack/react-router";
import { requireEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { actorFor } from "@/server/access";
import { uploadFile } from "@/server/timeline";

// Upload a file to a record's timeline (multipart: contactId, file).
export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const actor = await actorFor(await requireEveryAppUser(request, env));
        const form = await request.formData();
        const contactId = form.get("contactId");
        const file = form.get("file");
        if (typeof contactId !== "string" || !(file instanceof File))
          return Response.json({ error: "Choose a file" }, { status: 400 });
        try {
          return Response.json(await uploadFile(actor, contactId, file), { status: 201 });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 403 });
        }
      },
    },
  },
});
