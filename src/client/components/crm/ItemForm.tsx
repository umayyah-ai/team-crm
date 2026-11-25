import { useState } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { NativeSelect } from "@/client/components/ui/native-select";
import { errorMessage } from "@/client/lib/format";
import { saveItem } from "@/serverFunctions/crm";
import { CustomFieldInput, FormField, MemberSelect, type FieldDef } from "./FormField";

export interface PipelineDef {
  id: string;
  name: string;
  statuses: { id: string; name: string; kind: "open" | "won" | "lost" }[];
  fields: FieldDef[];
}

export interface ItemDraft {
  id?: string;
  pipelineId: string;
  contactId: string;
  statusId: string;
  value: string;
  assignedUserId: string;
  values: Record<string, string>;
}

/** Attach a record to a pipeline, or edit its item. */
export function ItemForm({
  initial,
  pipelines,
  records,
  members,
  onClose,
  onSaved,
}: {
  initial: ItemDraft;
  pipelines: PipelineDef[];
  /** Absent when the record is fixed. */
  records?: { id: string; name: string }[];
  members: { id: string; email: string; level: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pipeline = pipelines.find((p) => p.id === draft.pipelineId);
  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.contactId) return setError("Pick a record");
    if (!draft.statusId) return setError("Pick a status");
    setPending(true);
    setError(null);
    try {
      await saveItem({
        data: { ...draft, value: draft.value.trim() === "" ? null : Number(draft.value) },
      });
      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Edit pipeline item" : "Add to pipeline"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          {!initial.id ? (
            <FormField id="i-pipeline" label="Pipeline">
              <NativeSelect
                id="i-pipeline"
                className="w-full"
                value={draft.pipelineId}
                onChange={(e) => setDraft((d) => ({ ...d, pipelineId: e.target.value, statusId: pipelines.find((p) => p.id === e.target.value)?.statuses[0]?.id ?? "", values: {} }))}
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}
          {records ? (
            <FormField id="i-record" label="Record">
              <NativeSelect id="i-record" className="w-full" value={draft.contactId} onChange={(e) => set("contactId", e.target.value)}>
                <option value="">Choose…</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}
          <FormField id="i-status" label="Status">
            <NativeSelect id="i-status" className="w-full" value={draft.statusId} onChange={(e) => set("statusId", e.target.value)}>
              {pipeline?.statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="i-value" label="Value">
              <Input id="i-value" type="number" min={0} step="any" value={draft.value} onChange={(e) => set("value", e.target.value)} />
            </FormField>
            <FormField id="i-assignee" label="Assigned to">
              <MemberSelect
                id="i-assignee"
                members={members.filter((m) => m.level === "full" || m.id === draft.assignedUserId)}
                value={draft.assignedUserId}
                onChange={(v) => set("assignedUserId", v)}
              />
            </FormField>
          </div>
          {pipeline?.fields.map((field) => (
            <CustomFieldInput
              key={field.id}
              idPrefix="pf"
              field={field}
              value={draft.values[field.id] ?? ""}
              onChange={(value) => set("values", { ...draft.values, [field.id]: value })}
            />
          ))}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
