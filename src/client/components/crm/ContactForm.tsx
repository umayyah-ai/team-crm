import { useState } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { NativeSelect } from "@/client/components/ui/native-select";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/format";
import { saveContact } from "@/serverFunctions/crm";
import { CustomFieldInput, FormField, MemberSelect, type FieldDef } from "./FormField";

export interface ContactDraft {
  id?: string;
  kind: "person" | "company";
  name: string;
  title: string;
  companyId: string | null;
  emails: string;
  phones: string;
  address: string;
  background: string;
  assignedUserId: string;
  values: Record<string, string>;
}

export function emptyDraft(kind: "person" | "company", me: string): ContactDraft {
  return { kind, name: "", title: "", companyId: null, emails: "", phones: "", address: "", background: "", assignedUserId: me, values: {} };
}

/** Create or edit a person or company. */
export function ContactForm({
  initial,
  fields,
  members,
  companies,
  onClose,
  onSaved,
}: {
  initial: ContactDraft;
  fields: FieldDef[];
  members: { id: string; email: string; level: string }[];
  companies: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const person = draft.kind === "person";
  const assignable = members.filter((m) => m.level === "full" || m.id === draft.assignedUserId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError("Enter a name");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { id } = await saveContact({ data: draft });
      onSaved(id);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial.id ? `Edit ${initial.name}` : person ? "New contact" : "New company"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          <FormField id="c-name" label="Name">
            <Input id="c-name" value={draft.name} onChange={(e) => set("name", e.target.value)} autoFocus />
          </FormField>
          {person ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="c-title" label="Title">
                <Input id="c-title" value={draft.title} onChange={(e) => set("title", e.target.value)} />
              </FormField>
              <FormField id="c-company" label="Company">
                <NativeSelect
                  id="c-company"
                  className="w-full"
                  value={draft.companyId ?? ""}
                  onChange={(e) => set("companyId", e.target.value || null)}
                >
                  <option value="">None</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="c-emails" label="Emails">
              <Textarea id="c-emails" rows={2} value={draft.emails} onChange={(e) => set("emails", e.target.value)} placeholder="One per line" />
            </FormField>
            <FormField id="c-phones" label="Phones">
              <Textarea id="c-phones" rows={2} value={draft.phones} onChange={(e) => set("phones", e.target.value)} placeholder="One per line" />
            </FormField>
          </div>
          <FormField id="c-address" label="Address">
            <Textarea id="c-address" rows={2} value={draft.address} onChange={(e) => set("address", e.target.value)} />
          </FormField>
          <FormField id="c-background" label="Background">
            <Textarea id="c-background" rows={3} value={draft.background} onChange={(e) => set("background", e.target.value)} />
          </FormField>
          {fields.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <CustomFieldInput
                  key={field.id}
                  field={field}
                  value={draft.values[field.id] ?? ""}
                  onChange={(value) => set("values", { ...draft.values, [field.id]: value })}
                />
              ))}
            </div>
          ) : null}
          <FormField id="c-assignee" label="Assigned to">
            <MemberSelect id="c-assignee" members={assignable} value={draft.assignedUserId} onChange={(v) => set("assignedUserId", v)} />
          </FormField>
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
