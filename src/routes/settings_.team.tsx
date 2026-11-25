import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CrmShell } from "@/client/components/CrmShell";
import { AdminOnly } from "@/client/components/crm/AdminOnly";
import { MemberSelect } from "@/client/components/crm/FormField";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Label } from "@/client/components/ui/label";
import { NativeSelect } from "@/client/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { useRun } from "@/client/lib/useRun";
import { getMe, getTeam, reassignAll, setLevel } from "@/serverFunctions/crm";

export const Route = createFileRoute("/settings_/team")({
  loader: async () => {
    const me = await getMe();
    return { me, team: me.admin ? await getTeam() : null };
  },
  head: () => ({ meta: [{ title: "Team access" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { me, team } = Route.useLoaderData();
  const { run, pending } = useRun();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(me.id);
  const [confirm, setConfirm] = useState(false);
  if (!team) {
    return (
      <CrmShell>
        <PageHeader backLink={<BackLink to="/settings">Settings</BackLink>} title="Team access" />
        <AdminOnly />
      </CrmShell>
    );
  }
  const level = (viewerId: string, ownerId: string) =>
    team.levels.find((l) => l.viewerId === viewerId && l.ownerId === ownerId)?.level ?? "full";
  const label = (m: { email: string; name: string }) => (m.name ? `${m.name} (${m.email})` : m.email);
  const fromEmail = team.members.find((m) => m.id === from)?.email;
  const toEmail = team.members.find((m) => m.id === to)?.email;

  return (
    <CrmShell>
      <PageHeader
        backLink={<BackLink to="/settings">Settings</BackLink>}
        title="Team access"
        description="What each member can do with records assigned to each teammate. Admins always have full access."
      />
      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {team.members.length < 2 ? (
            <p className="text-sm text-muted-foreground">Teammates appear here once they open the app.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  {team.members.map((owner) => (
                    <TableHead key={owner.id}>{owner.email}'s records</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.members.map((viewer) => (
                  <TableRow key={viewer.id} data-testid="access-row">
                    <TableCell className="font-medium">
                      {label(viewer)}
                      {viewer.admin ? <span className="text-muted-foreground"> · admin</span> : null}
                    </TableCell>
                    {team.members.map((owner) => (
                      <TableCell key={owner.id}>
                        {viewer.id === owner.id || viewer.admin ? (
                          <span className="text-muted-foreground">Full</span>
                        ) : (
                          <NativeSelect
                            size="sm"
                            aria-label={`${viewer.email}'s access to ${owner.email}'s records`}
                            value={level(viewer.id, owner.id)}
                            onChange={(e) =>
                              run(
                                () => setLevel({ data: { viewerId: viewer.id, ownerId: owner.id, level: e.target.value as "full" | "read" | "none" } }),
                                "Access saved",
                              )
                            }
                          >
                            <option value="full">Full</option>
                            <option value="read">Read only</option>
                            <option value="none">None</option>
                          </NativeSelect>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {team.notOpenedYet.length ? (
            <p className="mt-3 text-sm text-muted-foreground">Not opened the app yet: {team.notOpenedYet.join(", ")}</p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Reassign records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reassign-from">Reassign records from</Label>
              <MemberSelect id="reassign-from" className="w-64" members={team.members} value={from} onChange={setFrom} anyLabel="Choose…" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reassign-to">Reassign records to</Label>
              <MemberSelect id="reassign-to" className="w-64" members={team.members} value={to} onChange={setTo} />
            </div>
            <Button variant="outline" disabled={!from || from === to} onClick={() => setConfirm(true)}>
              Reassign
            </Button>
          </div>
        </CardContent>
      </Card>
      {confirm ? (
        <ConfirmDialog
          title={`Reassign ${fromEmail}'s records to ${toEmail}?`}
          confirmLabel="Reassign"
          pending={pending}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            const result = await run(() => reassignAll({ data: { fromId: from, toId: to } }));
            setConfirm(false);
            if (result) toast.success(`Reassigned ${result.records} ${result.records === 1 ? "record" : "records"}`);
          }}
        >
          Their contacts, companies, open tasks and pipeline items move to them.
        </ConfirmDialog>
      ) : null}
    </CrmShell>
  );
}
