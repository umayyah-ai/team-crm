import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { CrmShell } from "@/client/components/CrmShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Switch } from "@/client/components/ui/switch";
import { useRun } from "@/client/lib/useRun";
import { getAgenda, getMe, setAgenda } from "@/serverFunctions/crm";

export const Route = createFileRoute("/settings")({
  loader: async () => {
    const [agenda, me] = await Promise.all([getAgenda(), getMe()]);
    return { agenda, me };
  },
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: SettingsPage,
});

const ADMIN_PAGES = [
  { to: "/settings/fields", label: "Custom fields" },
  { to: "/settings/pipelines", label: "Pipelines" },
  { to: "/settings/team", label: "Team access" },
] as const;

function SettingsPage() {
  const { agenda, me } = Route.useLoaderData();
  const { run } = useRun();
  return (
    <CrmShell>
      <PageHeader title="Settings" />
      <Card>
        <CardHeader>
          <CardTitle>Morning agenda email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Today's tasks, overdue tasks and events, sent to {me.email} at 7:00 your time.
            </p>
            <Switch
              aria-label="Morning agenda email"
              checked={agenda.enabled}
              onCheckedChange={(enabled) =>
                run(() => setAgenda({ data: { enabled, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" } }))
              }
            />
          </div>
          {agenda.enabled && !agenda.emailReady ? (
            <Alert>
              <AlertDescription>
                Email isn't set up on this Gateway, so nothing is sent yet.{" "}
                {me.admin ? "Set up email in your Gateway to turn it on." : "Ask an admin to set up email."}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
      {me.admin ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {ADMIN_PAGES.map((page) => (
            <li key={page.to}>
              <Link to={page.to} className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50">
                {page.label}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </CrmShell>
  );
}
