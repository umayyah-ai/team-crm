import { Link, useNavigate } from "@tanstack/react-router";
import { Download, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { NativeSelect } from "@/client/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { errorMessage } from "@/client/lib/format";
import { exportContacts } from "@/serverFunctions/crm";
import { ContactForm, emptyDraft, type ContactDraft } from "./ContactForm";
import type { FieldDef } from "./FormField";

/** The search params that differ from the defaults. */
export function compactSearch<T extends object>(search: T, defaults: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(search).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(defaults[key as keyof T])),
  ) as Partial<T>;
}

export interface ListSearch {
  q: string;
  group: string;
  assignee: string;
  sort: "name-asc" | "name-desc" | "updated" | "created";
  page: number;
}

export function parseListSearch(search: Partial<Record<string, unknown>>): ListSearch {
  const sorts = ["name-asc", "name-desc", "updated", "created"] as const;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const sort = sorts.find((s) => s === search.sort) ?? "name-asc";
  const page = Number(search.page);
  return { q: str(search.q), group: str(search.group), assignee: str(search.assignee), sort, page: Number.isInteger(page) && page > 0 ? page : 1 };
}

interface Row {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  companyName: string | null;
  assignee: string | null;
}

export function RecordList({
  kind,
  search,
  data,
}: {
  kind: "person" | "company";
  search: ListSearch;
  data: {
    list: { rows: Row[]; total: number; page: number; pageSize: number };
    me: { id: string; members: { id: string; email: string; level: string }[] };
    groups: { id: string; name: string }[];
    fields: FieldDef[];
    companies: { id: string; name: string }[];
  };
}) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState<ContactDraft | null>(null);
  const [q, setQ] = useState(search.q);
  const person = kind === "person";
  const path = person ? "/contacts" : "/companies";
  const noun = person ? "contacts" : "companies";
  const { rows, total, page, pageSize } = data.list;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(search.q || search.group || search.assignee);

  const go = (change: Partial<ListSearch>) =>
    navigate({ to: path, search: { ...search, page: 1, ...change }, replace: true });

  useEffect(() => {
    if (q === search.q) return;
    const timer = setTimeout(() => go({ q }), 200);
    return () => clearTimeout(timer);
  }, [q]);

  async function download() {
    try {
      const csv = await exportContacts();
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        title={person ? "Contacts" : "Companies"}
        description={`${total} ${total === 1 ? (person ? "contact" : "company") : noun}`}
        actions={
          <>
            <Button variant="outline" onClick={download}>
              <Download /> Export CSV
            </Button>
            <Button onClick={() => setCreating(emptyDraft(kind, data.me.id))}>
              <Plus /> {person ? "New contact" : "New company"}
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-48 flex-1 gap-1.5">
          <Label htmlFor="list-q">Search</Label>
          <Input id="list-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone or any field" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="list-group">Group</Label>
          <NativeSelect id="list-group" value={search.group} onChange={(e) => go({ group: e.target.value })}>
            <option value="">All groups</option>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="list-assignee">Assigned to</Label>
          <NativeSelect id="list-assignee" value={search.assignee} onChange={(e) => go({ assignee: e.target.value })}>
            <option value="">Anyone</option>
            {data.me.members.filter((m) => m.level !== "none").map((m) => (
              <option key={m.id} value={m.id}>
                {m.email}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="list-sort">Sort</Label>
          <NativeSelect id="list-sort" value={search.sort} onChange={(e) => go({ sort: e.target.value as ListSearch["sort"] })}>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="updated">Recently updated</option>
            <option value="created">Recently added</option>
          </NativeSelect>
        </div>
      </div>
      {rows.length === 0 ? (
        filtered ? (
          <EmptyState kind="filtered" title={`No ${noun} match`} description="Try another search or filter." />
        ) : (
          <EmptyState
            title={person ? "No contacts yet" : "No companies yet"}
            description="Add one and it will appear here."
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {person ? <TableHead className="hidden md:table-cell">Company</TableHead> : null}
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Assigned to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid="contact-row">
                  <TableCell>
                    <Link to="/contacts/$id" params={{ id: row.id }} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                    {row.title ? <div className="text-xs text-muted-foreground">{row.title}</div> : null}
                  </TableCell>
                  {person ? <TableCell className="hidden md:table-cell">{row.companyName}</TableCell> : null}
                  <TableCell className="hidden sm:table-cell">{row.email}</TableCell>
                  <TableCell className="hidden lg:table-cell">{row.phone}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{row.assignee}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          Page {page} of {pages}
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => go({ page: page + 1 })}>
            Next
          </Button>
        </div>
      ) : null}
      {creating ? (
        <ContactForm
          initial={creating}
          fields={data.fields}
          members={data.me.members}
          companies={data.companies}
          onClose={() => setCreating(null)}
          onSaved={(id) => navigate({ to: "/contacts/$id", params: { id } })}
        />
      ) : null}
    </>
  );
}
