import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Columns3, List, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CrmShell } from "@/client/components/CrmShell";
import { compactSearch } from "@/client/components/crm/RecordList";
import { ItemForm, type ItemDraft } from "@/client/components/crm/ItemForm";
import { RecordNotFound } from "@/client/components/crm/NotFound";
import { EmptyState } from "@/client/components/EmptyState";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { NativeSelect } from "@/client/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { money } from "@/client/lib/format";
import { useRun } from "@/client/lib/useRun";
import { deleteItem, getContactOptions, getMe, getPipelineReport, moveItem } from "@/serverFunctions/crm";

interface Search {
  view: "list" | "board";
  status: string;
  assignee: string;
  from: string;
  to: string;
}

function parseSearch(s: Record<string, unknown>): Search {
  {
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    return { view: s.view === "board" ? "board" : "list", status: str(s.status), assignee: str(s.assignee), from: str(s.from), to: str(s.to) };
  }
}

export const Route = createFileRoute("/pipelines_/$id")({
  validateSearch: (s: Record<string, unknown>): Partial<Search> => compactSearch(parseSearch(s), parseSearch({})),
  loaderDeps: ({ search }) => parseSearch(search),
  loader: async ({ params, deps }) => {
    const ok = /^[0-9a-f-]{36}$/i.test(params.id);
    const [report, me, records] = await Promise.all([
      ok ? getPipelineReport({ data: { pipelineId: params.id, statusId: deps.status, assignee: deps.assignee, from: deps.from, to: deps.to } }) : null,
      getMe(),
      getContactOptions(),
    ]);
    return { report, me, records };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.report?.pipeline.name ?? "Not found" }] }),
  component: ReportPage,
});

function ReportPage() {
  const { report, me, records } = Route.useLoaderData();
  const search = parseSearch(Route.useSearch());
  const navigate = useNavigate();
  const { run } = useRun();
  const [editing, setEditing] = useState<ItemDraft | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  if (!report) {
    return (
      <CrmShell>
        <RecordNotFound back="/pipelines" backLabel="Back to pipelines" />
      </CrmShell>
    );
  }
  const { pipeline, items } = report;
  const go = (change: Partial<Search>) =>
    navigate({ to: "/pipelines/$id", params: { id: pipeline.id }, search: { ...search, ...change }, replace: true });
  const total = items.reduce((sum, i) => sum + (i.value ?? 0), 0);
  const statusName = (id: string) => pipeline.statuses.find((s) => s.id === id)?.name ?? "";
  const edit = (item: (typeof items)[number]) =>
    setEditing({
      id: item.id, pipelineId: pipeline.id, contactId: item.contactId, statusId: item.statusId,
      value: item.value === null ? "" : String(item.value), assignedUserId: item.assignedUserId, values: item.values as Record<string, string>,
    });

  return (
    <CrmShell>
      <PageHeader
        backLink={<BackLink to="/pipelines">Pipelines</BackLink>}
        title={pipeline.name}
        description={`${items.length} ${items.length === 1 ? "item" : "items"} · ${money(total)}`}
        actions={
          <>
            <SegmentedToggle
              showLabels
              value={search.view}
              onChange={(view) => go({ view })}
              items={[
                { value: "list", label: "List", icon: <List /> },
                { value: "board", label: "Board", icon: <Columns3 /> },
              ]}
            />
            {pipeline.statuses.length ? (
              <Button
                onClick={() =>
                  setEditing({ pipelineId: pipeline.id, contactId: "", statusId: pipeline.statuses[0]!.id, value: "", assignedUserId: me.id, values: {} })
                }
              >
                <Plus /> Add item
              </Button>
            ) : null}
          </>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="f-status">Status</Label>
          <NativeSelect id="f-status" value={search.status} onChange={(e) => go({ status: e.target.value })}>
            <option value="">All statuses</option>
            {pipeline.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-assignee">Assigned to</Label>
          <NativeSelect id="f-assignee" value={search.assignee} onChange={(e) => go({ assignee: e.target.value })}>
            <option value="">Anyone</option>
            {me.members.filter((m) => m.level !== "none").map((m) => (
              <option key={m.id} value={m.id}>
                {m.email}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-from">Added from</Label>
          <Input id="f-from" type="date" value={search.from} onChange={(e) => go({ from: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-to">Added to</Label>
          <Input id="f-to" type="date" value={search.to} onChange={(e) => go({ to: e.target.value })} />
        </div>
      </div>
      {pipeline.statuses.length === 0 ? (
        <EmptyState title="This pipeline has no statuses yet" description="An admin can add them in settings." />
      ) : search.view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {pipeline.statuses.map((status) => {
            const column = items.filter((i) => i.statusId === status.id);
            return (
              <section key={status.id} data-testid="board-column" className="flex w-64 shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
                <header className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{status.name}</h2>
                  {status.kind !== "open" ? <Badge variant={status.kind === "won" ? "default" : "secondary"}>{status.kind === "won" ? "Won" : "Lost"}</Badge> : null}
                </header>
                <p className="text-xs text-muted-foreground">
                  {column.length} · {money(column.reduce((s, i) => s + (i.value ?? 0), 0))}
                </p>
                {column.map((item) => (
                  <article key={item.id} className="grid gap-1 rounded-lg border border-border bg-card p-3 text-sm">
                    <Link to="/contacts/$id" params={{ id: item.contactId }} className="font-medium hover:underline">
                      {item.contactName}
                    </Link>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.assignee}</span>
                      <span className="font-medium text-foreground">{money(item.value)}</span>
                    </div>
                    {item.canEdit ? (
                      <NativeSelect
                        size="sm"
                        className="w-full"
                        aria-label={`Move ${item.contactName}`}
                        value={item.statusId}
                        onChange={(e) => run(() => moveItem({ data: { id: item.id, statusId: e.target.value } }))}
                      >
                        {pipeline.statuses.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : null}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      ) : items.length === 0 ? (
        <EmptyState kind="filtered" title="No items" description="Add one, or change the filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="hidden md:table-cell">Assigned to</TableHead>
                {pipeline.fields.map((f) => (
                  <TableHead key={f.id} className="hidden lg:table-cell">
                    {f.name}
                  </TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-testid="pipeline-item-row">
                  <TableCell>
                    <Link to="/contacts/$id" params={{ id: item.contactId }} className="font-medium hover:underline">
                      {item.contactName}
                    </Link>
                  </TableCell>
                  <TableCell>{statusName(item.statusId)}</TableCell>
                  <TableCell className="text-right">{money(item.value)}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{item.assignee}</TableCell>
                  {pipeline.fields.map((f) => (
                    <TableCell key={f.id} className="hidden lg:table-cell">
                      {(item.values as Record<string, string>)[f.id] ?? ""}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    {item.canEdit ? (
                      <span className="inline-flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => edit(item)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item.contactName}`} onClick={() => setDeleting(item.id)}>
                          <Trash2 />
                        </Button>
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing ? (
        <ItemForm
          initial={editing}
          pipelines={[pipeline]}
          records={editing.id ? undefined : records}
          members={me.members}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void run(async () => undefined);
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="Remove this item from the pipeline?"
          confirmLabel="Remove"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await run(() => deleteItem({ data: { id: deleting } }));
            setDeleting(null);
          }}
        >
          Its status history goes with it.
        </ConfirmDialog>
      ) : null}
    </CrmShell>
  );
}
