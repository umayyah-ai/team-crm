import { createFileRoute, Link } from "@tanstack/react-router";
import { CrmShell } from "@/client/components/CrmShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { money } from "@/client/lib/format";
import { getMe, getPipelines } from "@/serverFunctions/crm";

export const Route = createFileRoute("/pipelines")({
  loader: async () => {
    const [pipelines, me] = await Promise.all([getPipelines(), getMe()]);
    return { pipelines, me };
  },
  head: () => ({ meta: [{ title: "Pipelines" }] }),
  component: PipelinesPage,
});

function PipelinesPage() {
  const { pipelines, me } = Route.useLoaderData();
  return (
    <CrmShell>
      <PageHeader title="Pipelines" />
      {pipelines.length === 0 ? (
        <EmptyState
          title="No pipelines yet"
          description={me.admin ? "Create one with its statuses in settings." : "An admin can create one in settings."}
          action={me.admin ? <Button render={<Link to="/settings/pipelines" />}>Set up pipelines</Button> : undefined}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {pipelines.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link to="/pipelines/$id" params={{ id: p.id }} className="font-medium hover:underline">
                {p.name}
              </Link>
              <span className="text-sm text-muted-foreground">
                {p.items} {p.items === 1 ? "item" : "items"} · {money(p.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CrmShell>
  );
}
