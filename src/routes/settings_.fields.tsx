import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CrmShell } from "@/client/components/CrmShell";
import { AdminOnly } from "@/client/components/crm/AdminOnly";
import { EmptyState } from "@/client/components/EmptyState";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { NativeSelect } from "@/client/components/ui/native-select";
import { Textarea } from "@/client/components/ui/textarea";
import { useRun } from "@/client/lib/useRun";
import { createField, deleteField, getFields, getMe } from "@/serverFunctions/crm";

export const Route = createFileRoute("/settings_/fields")({
  loader: async () => {
    const [fields, me] = await Promise.all([getFields(), getMe()]);
    return { fields, me };
  },
  head: () => ({ meta: [{ title: "Custom fields" }] }),
  component: FieldsPage,
});

const TYPE_LABELS = { text: "Text", number: "Number", date: "Date", dropdown: "Dropdown" } as const;

function FieldsPage() {
  const { fields, me } = Route.useLoaderData();
  const { run, pending } = useRun();
  const [name, setName] = useState("");
  const [type, setType] = useState<keyof typeof TYPE_LABELS>("text");
  const [options, setOptions] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  return (
    <CrmShell>
      <PageHeader backLink={<BackLink to="/settings">Settings</BackLink>} title="Custom fields" />
      {!me.admin ? (
        <AdminOnly />
      ) : (
        <>
          <form
            className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const ok = await run(async () => {
                await createField({ data: { name, type, options: options.split("\n").map((o) => o.trim()).filter(Boolean) } });
                return true;
              });
              if (ok) {
                setName("");
                setOptions("");
              }
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="field-name">Field name</Label>
              <Input id="field-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="field-type">Type</Label>
              <NativeSelect id="field-type" value={type} onChange={(e) => setType(e.target.value as keyof typeof TYPE_LABELS)}>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {type === "dropdown" ? (
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="field-options">Options</Label>
                <Textarea id="field-options" rows={3} placeholder="One per line" value={options} onChange={(e) => setOptions(e.target.value)} />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit" pending={pending}>
                Add field
              </Button>
            </div>
          </form>
          {fields.length === 0 ? (
            <EmptyState title="No custom fields yet" description="Fields you add appear on every contact and company." />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {fields.map((f) => (
                <li key={f.id} data-testid="field-row" className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{f.name}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{TYPE_LABELS[f.type]}</Badge>
                    {f.type === "dropdown" ? <span className="text-muted-foreground">{f.options.join(", ")}</span> : null}
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${f.name}`} onClick={() => setDeleting(f)}>
                      <Trash2 />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await run(() => deleteField({ data: { id: deleting.id } }));
            setDeleting(null);
          }}
        >
          Its value is removed from every record.
        </ConfirmDialog>
      ) : null}
    </CrmShell>
  );
}
