import type { ReactNode } from "react";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { NativeSelect } from "@/client/components/ui/native-select";

/** A label above its control. */
export function FormField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export interface FieldDef {
  id: string;
  name: string;
  type: "text" | "number" | "date" | "dropdown";
  options: string[];
}

/** The input for one custom field's value. */
export function CustomFieldInput({
  field,
  value,
  onChange,
  idPrefix = "cf",
}: {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${field.id}`;
  return (
    <FormField id={id} label={field.name}>
      {field.type === "dropdown" ? (
        <NativeSelect id={id} className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">None</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FormField>
  );
}

/** A select of teammates by email. */
export function MemberSelect({
  id,
  members,
  value,
  onChange,
  anyLabel,
  className = "w-full",
}: {
  id: string;
  members: { id: string; email: string }[];
  value: string;
  onChange: (value: string) => void;
  anyLabel?: string;
  className?: string;
}) {
  return (
    <NativeSelect id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {anyLabel !== undefined ? <option value="">{anyLabel}</option> : null}
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.email}
        </option>
      ))}
    </NativeSelect>
  );
}
