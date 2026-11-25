import { createFileRoute } from "@tanstack/react-router";
import { CrmShell } from "@/client/components/CrmShell";
import { RecordList, compactSearch, parseListSearch, type ListSearch } from "@/client/components/crm/RecordList";
import { getCompanyOptions, getFields, getGroups, getMe, listContacts } from "@/serverFunctions/crm";

export const Route = createFileRoute("/companies")({
  validateSearch: (search: Record<string, unknown>): Partial<ListSearch> => compactSearch(parseListSearch(search), parseListSearch({})),
  loaderDeps: ({ search }) => parseListSearch(search),
  loader: async ({ deps }) => {
    const [list, me, groups, fields, companies] = await Promise.all([
      listContacts({ data: { kind: "company", q: deps.q, groupId: deps.group, assignee: deps.assignee, sort: deps.sort, page: deps.page } }),
      getMe(),
      getGroups(),
      getFields(),
      getCompanyOptions(),
    ]);
    return { list, me, groups, fields, companies };
  },
  head: () => ({ meta: [{ title: "Companies" }] }),
  component: Page,
});

function Page() {
  return (
    <CrmShell>
      <RecordList kind="company" search={parseListSearch(Route.useSearch())} data={Route.useLoaderData()} />
    </CrmShell>
  );
}
