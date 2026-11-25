import { useState } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { NativeSelect } from "@/client/components/ui/native-select";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/format";
import { saveTask } from "@/serverFunctions/crm";
import { FormField, MemberSelect } from "./FormField";

export interface TaskDraft {
  id?: string;
  title: string;
  description: string;
  dueDate: string;
  contactId: string | null;
  pipelineItemId: string | null;
  assignedUserId: string;
}

export function TaskForm({
  initial,
  members,
  records,
  items,
  onClose,
  onSaved,
}: {
  initial: TaskDraft;
  members: { id: string; email: string; level: string }[];
  records: { id: string; name: string }[];
  items: { id: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return setError("Enter a title");
    if (!draft.dueDate) return setError("Pick a due date");
    setPending(true);
    setError(null);
    try {
      await saveTask({ data: draft });
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
          <DialogTitle>{initial.id ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          <FormField id="t-title" label="Title">
            <Input id="t-title" value={draft.title} onChange={(e) => set("title", e.target.value)} autoFocus />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="t-due" label="Due date">
              <Input id="t-due" type="date" value={draft.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </FormField>
            <FormField id="t-assignee" label="Assigned to">
              <MemberSelect
                id="t-assignee"
                members={members.filter((m) => m.level === "full" || m.id === draft.assignedUserId)}
                value={draft.assignedUserId}
                onChange={(v) => set("assignedUserId", v)}
              />
            </FormField>
          </div>
          <FormField id="t-description" label="Description">
            <Textarea id="t-description" rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />
          </FormField>
          <FormField id="t-record" label="Linked record">
            <NativeSelect id="t-record" className="w-full" value={draft.contactId ?? ""} onChange={(e) => set("contactId", e.target.value || null)}>
              <option value="">None</option>
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {items.length ? (
            <FormField id="t-item" label="Pipeline item">
              <NativeSelect id="t-item" className="w-full" value={draft.pipelineItemId ?? ""} onChange={(e) => set("pipelineItemId", e.target.value || null)}>
                <option value="">None</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}
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
