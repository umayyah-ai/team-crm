import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CrmShell } from "@/client/components/CrmShell";
import { AdminOnly } from "@/client/components/crm/AdminOnly";
import type { PipelineDef } from "@/client/components/crm/ItemForm";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { NativeSelect } from "@/client/components/ui/native-select";
import { useRun } from "@/client/lib/useRun";
import {
  addPipelineField,
  addStatus,
  createPipeline,
  deletePipeline,
  deletePipelineField,
  deleteStatus,
  getMe,
  getPipelines,
  moveStatus,
} from "@/serverFunctions/crm";

export const Route = createFileRoute("/settings_/pipelines")({
  loader: async () => {
    const [pipelines, me] = await Promise.all([getPipelines(), getMe()]);
    return { pipelines, me };
  },
  head: () => ({ meta: [{ title: "Pipeline settings" }] }),
  component: PipelineSettings,
});

const KIND_LABELS = { open: "Open", won: "Won", lost: "Lost" } as const;
const FIELD_TYPES = { text: "Text", number: "Number", date: "Date", dropdown: "Dropdown" } as const;

function PipelineSettings() {
  const { pipelines, me } = Route.useLoaderData();
  const { run, pending } = useRun();
  const [name, setName] = useState("");
  return (
    <CrmShell>
      <PageHeader backLink={<BackLink to="/settings">Settings</BackLink>} title="Pipelines" />
      {!me.admin ? (
        <AdminOnly />
      ) : (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const ok = await run(async () => {
                await createPipeline({ data: { name } });
                return true;
              });
              if (ok) setName("");
            }}
          >
            <div className="grid min-w-56 flex-1 gap-1.5">
              <Label htmlFor="pipeline-name">Pipeline name</Label>
              <Input id="pipeline-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" pending={pending}>
              Create pipeline
            </Button>
          </form>
          {pipelines.map((p) => (
            <PipelineEditor key={p.id} pipeline={p} />
          ))}
        </>
      )}
    </CrmShell>
  );
}

function PipelineEditor({ pipeline }: { pipeline: PipelineDef }) {
  const { run } = useRun();
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState<keyof typeof KIND_LABELS>("open");
  const [field, setField] = useState("");
  const [fieldType, setFieldType] = useState<keyof typeof FIELD_TYPES>("text");
  const [options, setOptions] = useState("");
  const [confirm, setConfirm] = useState(false);
  const p = pipeline.id;
  return (
    <Card data-testid="pipeline-editor">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{pipeline.name}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
          Delete pipeline
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Statuses</h3>
          <ol className="grid gap-1">
            {pipeline.statuses.map((s, index) => (
              <li key={s.id} data-testid="status-row" className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                <span className="flex items-center gap-2">
                  {s.name}
                  {s.kind !== "open" ? <Badge variant="secondary">{KIND_LABELS[s.kind]}</Badge> : null}
                </span>
                <span className="flex">
                  <Button variant="ghost" size="icon-xs" aria-label={`Move ${s.name} up`} disabled={index === 0} onClick={() => run(() => moveStatus({ data: { id: s.id, direction: "up" } }))}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label={`Move ${s.name} down`} disabled={index === pipeline.statuses.length - 1} onClick={() => run(() => moveStatus({ data: { id: s.id, direction: "down" } }))}>
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label={`Delete ${s.name}`} onClick={() => run(() => deleteStatus({ data: { id: s.id } }))}>
                    <Trash2 />
                  </Button>
                </span>
              </li>
            ))}
          </ol>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!status.trim()) return;
              const ok = await run(async () => {
                await addStatus({ data: { pipelineId: p, name: status, kind } });
                return true;
              });
              if (ok) setStatus("");
            }}
          >
            <div className="grid min-w-32 flex-1 gap-1.5">
              <Label htmlFor={`status-name-${p}`}>Status name</Label>
              <Input id={`status-name-${p}`} value={status} onChange={(e) => setStatus(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`status-kind-${p}`}>Status kind</Label>
              <NativeSelect id={`status-kind-${p}`} value={kind} onChange={(e) => setKind(e.target.value as keyof typeof KIND_LABELS)}>
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="outline">
              Add status
            </Button>
          </form>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Fields</h3>
          <ul className="grid gap-1">
            {pipeline.fields.map((f) => (
              <li key={f.id} data-testid="pipeline-field-row" className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                <span className="flex items-center gap-2">
                  {f.name} <Badge variant="secondary">{FIELD_TYPES[f.type]}</Badge>
                </span>
                <Button variant="ghost" size="icon-xs" aria-label={`Delete ${f.name}`} onClick={() => run(() => deletePipelineField({ data: { id: f.id } }))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!field.trim()) return;
              const ok = await run(async () => {
                await addPipelineField({
                  data: { pipelineId: p, field: { name: field, type: fieldType, options: options.split("\n").map((o) => o.trim()).filter(Boolean) } },
                });
                return true;
              });
              if (ok) {
                setField("");
                setOptions("");
              }
            }}
          >
            <div className="grid min-w-32 flex-1 gap-1.5">
              <Label htmlFor={`field-name-${p}`}>Pipeline field name</Label>
              <Input id={`field-name-${p}`} value={field} onChange={(e) => setField(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`field-type-${p}`}>Pipeline field type</Label>
              <NativeSelect id={`field-type-${p}`} value={fieldType} onChange={(e) => setFieldType(e.target.value as keyof typeof FIELD_TYPES)}>
                {Object.entries(FIELD_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {fieldType === "dropdown" ? (
              <div className="grid w-full gap-1.5">
                <Label htmlFor={`field-options-${p}`}>Field options</Label>
                <Input id={`field-options-${p}`} placeholder="One per line" value={options} onChange={(e) => setOptions(e.target.value.replaceAll(",", "\n"))} />
              </div>
            ) : null}
            <Button type="submit" variant="outline">
              Add pipeline field
            </Button>
          </form>
        </section>
      </CardContent>
      {confirm ? (
        <ConfirmDialog
          title={`Delete ${pipeline.name}?`}
          confirmLabel="Delete"
          destructive
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await run(() => deletePipeline({ data: { id: p } }));
            setConfirm(false);
          }}
        >
          Its items and their history are deleted too.
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}
