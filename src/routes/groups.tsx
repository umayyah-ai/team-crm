import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useState } from "react";
import { CrmShell } from "@/client/components/CrmShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { useRun } from "@/client/lib/useRun";
import { createGroup, getGroups } from "@/serverFunctions/crm";

export const Route = createFileRoute("/groups")({
  loader: () => getGroups(),
  head: () => ({ meta: [{ title: "Groups" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const groups = Route.useLoaderData();
  const { run, pending } = useRun();
  const [name, setName] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  return (
    <CrmShell>
      <PageHeader title="Groups" />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const ok = await run(async () => {
            await createGroup({ data: { name, isPrivate } });
            return true;
          });
          if (ok) {
            setName("");
            setPrivate(false);
          }
        }}
      >
        <div className="grid min-w-56 flex-1 gap-1.5">
          <Label htmlFor="group-name">Group name</Label>
          <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex h-8 items-center gap-2 text-sm">
          <Checkbox checked={isPrivate} onCheckedChange={(v) => setPrivate(v === true)} aria-label="Private" />
          Private
        </div>
        <Button type="submit" pending={pending}>
          Create group
        </Button>
      </form>
      {groups.length === 0 ? (
        <EmptyState title="No groups yet" description="Create one above, then add contacts to it from their pages." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {groups.map((g) => (
            <li key={g.id} data-testid="group-row" className="flex items-center justify-between gap-3 px-4 py-3">
              <Link to="/groups/$id" params={{ id: g.id }} className="font-medium hover:underline">
                {g.name}
              </Link>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {g.isPrivate ? (
                  <Badge variant="secondary">
                    <Lock /> Private
                  </Badge>
                ) : null}
                {g.size} {g.size === 1 ? "record" : "records"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CrmShell>
  );
}
