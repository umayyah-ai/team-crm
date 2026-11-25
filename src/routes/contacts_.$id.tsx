import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { CalendarDays, CheckSquare, FileText, GitCommitHorizontal, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import type { TimelineEntry } from "@/server/timeline";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CrmShell } from "@/client/components/CrmShell";
import { ContactForm, type ContactDraft } from "@/client/components/crm/ContactForm";
import { ItemForm, type ItemDraft } from "@/client/components/crm/ItemForm";
import { RecordNotFound } from "@/client/components/crm/NotFound";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Label } from "@/client/components/ui/label";
import { NativeSelect } from "@/client/components/ui/native-select";
import { Textarea } from "@/client/components/ui/textarea";
import { dayLabel, errorMessage, money, when } from "@/client/lib/format";
import { useRun } from "@/client/lib/useRun";
import {
  addNote,
  addToGroup,
  deleteContact,
  deleteFile,
  deleteNote,
  editNote,
  getCompanyOptions,
  getContact,
  getGroups,
  getMe,
  getPipelines,
  moveItem,
  removeFromGroup,
} from "@/serverFunctions/crm";

export const Route = createFileRoute("/contacts_/$id")({
  loader: async ({ params }) => {
    const ok = /^[0-9a-f-]{36}$/i.test(params.id);
    const [record, me, groups, pipelines, companies] = await Promise.all([
      ok ? getContact({ data: { id: params.id } }) : null,
      getMe(),
      getGroups(),
      getPipelines(),
      getCompanyOptions(),
    ]);
    return { record, me, groups, pipelines, companies };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.record?.contact.name ?? "Not found" }] }),
  component: RecordPage,
});

type Loaded = ReturnType<typeof Route.useLoaderData>;
type RecordData = NonNullable<Loaded["record"]>;

function RecordPage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const { run } = useRun();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState<ItemDraft | null>(null);
  const { record, me } = data;
  if (!record) {
    return (
      <CrmShell>
        <RecordNotFound back="/contacts" backLabel="Back to contacts" />
      </CrmShell>
    );
  }
  const c = record.contact;
  const isCompany = c.kind === "company";
  const draft: ContactDraft = {
    id: c.id, kind: c.kind, name: c.name, title: c.title, companyId: c.companyId, emails: c.emails, phones: c.phones,
    address: c.address, background: c.background, assignedUserId: c.assignedUserId, values: record.values,
  };
  const memberOf = new Set(record.groups.map((g) => g.id));
  const addable = data.groups.filter((g) => !memberOf.has(g.id));

  return (
    <CrmShell>
      <PageHeader
        backLink={<BackLink to={isCompany ? "/companies" : "/contacts"}>{isCompany ? "Companies" : "Contacts"}</BackLink>}
        title={c.name}
        description={
          isCompany ? (
            "Company"
          ) : (
            <>
              {c.title}
              {c.title && record.company ? " at " : null}
              {record.company ? (
                <Link to="/contacts/$id" params={{ id: record.company.id }} className="text-foreground hover:underline">
                  {record.company.name}
                </Link>
              ) : null}
            </>
          )
        }
        actions={
          record.canEdit ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
              <Button variant="outline" aria-label="Delete record" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
              </Button>
            </>
          ) : (
            <Badge variant="secondary">Read only</Badge>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <Detail label="Emails" value={c.emails} />
                <Detail label="Phones" value={c.phones} />
                <Detail label="Address" value={c.address} />
                <Detail label="Background" value={c.background} />
                {record.fields.map((f) => (
                  <Detail key={f.id} label={f.name} value={record.values[f.id] ?? ""} />
                ))}
                <Detail label="Assigned to" value={record.assignee} />
              </dl>
            </CardContent>
          </Card>

          {isCompany ? (
            <Card>
              <CardHeader>
                <CardTitle>People</CardTitle>
              </CardHeader>
              <CardContent data-testid="company-people">
                {record.people.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No one here yet. Pick this company on a contact to link them.</p>
                ) : (
                  <ul className="grid gap-2 text-sm">
                    {record.people.map((p) => (
                      <li key={p.id}>
                        <Link to="/contacts/$id" params={{ id: p.id }} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        {p.title ? <span className="text-muted-foreground"> · {p.title}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Groups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div data-testid="record-groups" className="flex flex-wrap gap-2">
                {record.groups.length === 0 ? <p className="text-sm text-muted-foreground">In no groups.</p> : null}
                {record.groups.map((g) => (
                  <Badge key={g.id} variant="secondary" className="gap-1">
                    <Link to="/groups/$id" params={{ id: g.id }}>
                      {g.name}
                    </Link>
                    {record.canEdit ? (
                      <button
                        type="button"
                        aria-label={`Remove from ${g.name}`}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => run(() => removeFromGroup({ data: { groupId: g.id, contactId: c.id } }))}
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </Badge>
                ))}
              </div>
              {record.canEdit && addable.length ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="add-group">Add to group</Label>
                  <NativeSelect
                    id="add-group"
                    className="w-full"
                    value=""
                    onChange={(e) => e.target.value && run(() => addToGroup({ data: { groupId: e.target.value, contactId: c.id } }))}
                  >
                    <option value="">Choose a group…</option>
                    {addable.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pipelines</CardTitle>
              {record.canEdit && data.pipelines.some((p) => p.statuses.length) ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const first = data.pipelines.find((p) => p.statuses.length)!;
                    setAdding({ pipelineId: first.id, contactId: c.id, statusId: first.statuses[0]!.id, value: "", assignedUserId: c.assignedUserId, values: {} });
                  }}
                >
                  <Plus /> Add to pipeline
                </Button>
              ) : null}
            </CardHeader>
            <CardContent data-testid="record-pipelines" className="grid gap-3">
              {record.items.length === 0 ? <p className="text-sm text-muted-foreground">Not in any pipeline.</p> : null}
              {record.items.map((item) => {
                const pipeline = data.pipelines.find((p) => p.id === item.pipelineId);
                return (
                  <div key={item.id} className="flex flex-wrap items-end justify-between gap-2 text-sm">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`status-${item.id}`}>
                        <Link to="/pipelines/$id" params={{ id: item.pipelineId }} className="hover:underline">
                          {item.pipelineName}
                        </Link>
                      </Label>
                      <NativeSelect
                        id={`status-${item.id}`}
                        aria-label={`Status in ${item.pipelineName}`}
                        disabled={!item.canEdit}
                        value={item.statusId}
                        onChange={(e) => run(() => moveItem({ data: { id: item.id, statusId: e.target.value } }))}
                      >
                        {pipeline?.statuses.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{money(item.value)}</div>
                      <div className="text-xs text-muted-foreground">{item.assignee}</div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Timeline record={record} />
      </div>

      {editing ? (
        <ContactForm
          initial={draft}
          fields={record.fields}
          members={me.members}
          companies={data.companies}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void run(async () => undefined);
          }}
        />
      ) : null}
      {adding ? (
        <ItemForm
          initial={adding}
          pipelines={data.pipelines.filter((p) => p.statuses.length)}
          members={me.members}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            void run(async () => undefined);
          }}
        />
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete ${c.name}?`}
          confirmLabel="Delete"
          destructive
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const done = await run(async () => {
              await deleteContact({ data: { id: c.id } });
              return true;
            });
            setConfirmDelete(false);
            if (done) void navigate({ to: isCompany ? "/companies" : "/contacts" });
          }}
        >
          Its notes, files and pipeline items are deleted too.
        </ConfirmDialog>
      ) : null}
    </CrmShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line break-words">{value}</dd>
    </div>
  );
}

const ICONS = { note: FileText, file: Paperclip, task: CheckSquare, event: CalendarDays, move: GitCommitHorizontal };

function Timeline({ record }: { record: RecordData }) {
  const router = useRouter();
  const { run, pending } = useRun();
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; type: "note" | "file" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const contactId = record.contact.id;

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("contactId", contactId);
      form.set("file", file);
      const response = await fetch("/api/files", { method: "POST", body: form });
      if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "Upload failed");
      await router.invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {record.canEdit ? (
          <form
            className="grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!body.trim()) return;
              const ok = await run(async () => {
                await addNote({ data: { contactId, body } });
                return true;
              });
              if (ok) setBody("");
            }}
          >
            <Label htmlFor="new-note" className="sr-only">
              New note
            </Label>
            <Textarea id="new-note" rows={3} placeholder="Write a note…" value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex items-center justify-between gap-2">
              <div>
                <input
                  ref={fileInput}
                  id="attach-file"
                  type="file"
                  aria-label="Attach file"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
                <Button type="button" variant="outline" size="sm" pending={uploading} onClick={() => fileInput.current?.click()}>
                  <Paperclip /> Attach file
                </Button>
              </div>
              <Button type="submit" size="sm" pending={pending}>
                Add note
              </Button>
            </div>
          </form>
        ) : null}
        {record.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet. Notes, files, tasks, events and pipeline moves appear here.</p>
        ) : (
          <ol data-testid="timeline" className="grid gap-3">
            {(record.timeline as TimelineEntry[]).map((entry) => {
              const Icon = ICONS[entry.type];
              return (
                <li key={`${entry.type}-${entry.id}`} data-testid="timeline-item" className="flex gap-3 rounded-lg border border-border p-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 text-xs text-muted-foreground">
                      <span>
                        {entry.by} · {when(entry.at)}
                        {entry.type === "note" && entry.edited ? " · edited" : null}
                      </span>
                      {entry.canChange && editingId !== entry.id ? (
                        <span className="flex gap-1">
                          {entry.type === "note" ? (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Edit note"
                              onClick={() => {
                                setEditingId(entry.id);
                                setEditBody(entry.body);
                              }}
                            >
                              <Pencil />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={entry.type === "note" ? "Delete note" : "Delete file"}
                            onClick={() => setConfirm({ id: entry.id, type: entry.type === "note" ? "note" : "file" })}
                          >
                            <Trash2 />
                          </Button>
                        </span>
                      ) : null}
                    </div>
                    {entry.type === "note" ? (
                      editingId === entry.id ? (
                        <form
                          className="grid gap-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const ok = await run(async () => {
                              await editNote({ data: { id: entry.id, body: editBody } });
                              return true;
                            });
                            if (ok) setEditingId(null);
                          }}
                        >
                          <Textarea aria-label="Note text" rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                            <Button type="submit" size="sm">
                              Save note
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <p className="whitespace-pre-line break-words text-sm">{entry.body}</p>
                      )
                    ) : entry.type === "file" ? (
                      <a href={`/api/files/${entry.id}`} download={entry.name} className="text-sm font-medium text-primary hover:underline">
                        {entry.name}
                      </a>
                    ) : entry.type === "task" ? (
                      <p className="text-sm">
                        Task: <span className={entry.done ? "line-through" : "font-medium"}>{entry.title}</span>
                        <span className="text-muted-foreground"> · due {dayLabel(entry.dueDate)}</span>
                      </p>
                    ) : entry.type === "event" ? (
                      <p className="text-sm">
                        Event: <span className="font-medium">{entry.title}</span>
                        <span className="text-muted-foreground"> · {entry.allDay ? dayLabel(entry.startsAt.slice(0, 10)) : when(entry.startsAt)}</span>
                      </p>
                    ) : (
                      <p className="text-sm">
                        {entry.from ? `Moved from ${entry.from} to ${entry.to}` : `Added as ${entry.to}`} in {entry.pipeline}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
      {confirm ? (
        <ConfirmDialog
          title={confirm.type === "note" ? "Delete this note?" : "Delete this file?"}
          confirmLabel="Delete"
          destructive
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await run(() => (confirm.type === "note" ? deleteNote({ data: { id: confirm.id } }) : deleteFile({ data: { id: confirm.id } })));
            setConfirm(null);
          }}
        />
      ) : null}
    </Card>
  );
}
