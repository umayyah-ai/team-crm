import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CrmShell } from "@/client/components/CrmShell";
import { RecordNotFound } from "@/client/components/crm/NotFound";
import { EmptyState } from "@/client/components/EmptyState";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { useRun } from "@/client/lib/useRun";
import { deleteGroup, getGroup, removeFromGroup } from "@/serverFunctions/crm";

export const Route = createFileRoute("/groups_/$id")({
  loader: ({ params }) => (/^[0-9a-f-]{36}$/i.test(params.id) ? getGroup({ data: { id: params.id } }) : null),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.group.name ?? "Not found" }] }),
  component: GroupPage,
});

function GroupPage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const { run } = useRun();
  const [confirm, setConfirm] = useState(false);
  if (!data) {
    return (
      <CrmShell>
        <RecordNotFound back="/groups" backLabel="Back to groups" />
      </CrmShell>
    );
  }
  return (
    <CrmShell>
      <PageHeader
        backLink={<BackLink to="/groups">Groups</BackLink>}
        title={data.group.name}
        description={data.group.isPrivate ? "Private: only you can see it" : "Shared with the team"}
        actions={
          data.canChange ? (
            <Button variant="outline" onClick={() => setConfirm(true)}>
              Delete group
            </Button>
          ) : null
        }
      />
      {data.members.length === 0 ? (
        <EmptyState title="No one in this group yet" description="Add contacts and companies from their pages." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {data.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link to="/contacts/$id" params={{ id: m.id }} className="font-medium hover:underline">
                {m.name}
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => run(() => removeFromGroup({ data: { groupId: data.group.id, contactId: m.id } }))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {confirm ? (
        <ConfirmDialog
          title={`Delete ${data.group.name}?`}
          confirmLabel="Delete"
          destructive
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await run(() => deleteGroup({ data: { id: data.group.id } }));
            setConfirm(false);
            void navigate({ to: "/groups" });
          }}
        >
          The records in it are kept.
        </ConfirmDialog>
      ) : null}
    </CrmShell>
  );
}
