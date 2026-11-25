import { createFileRoute } from "@tanstack/react-router";
import { CrmShell } from "@/client/components/CrmShell";
import { RecordList, compactSearch, parseListSearch, type ListSearch } from "@/client/components/crm/RecordList";
import { getCompanyOptions, getFields, getGroups, getMe, listContacts } from "@/serverFunctions/crm";

export const Route = createFileRoute("/contacts")({
  validateSearch: (search: Record<string, unknown>): Partial<ListSearch> => compactSearch(parseListSearch(search), parseListSearch({})),
  loaderDeps: ({ search }) => parseListSearch(search),
  loader: async ({ deps }) => {
    const [list, me, groups, fields, companies] = await Promise.all([
      listContacts({ data: { kind: "person", q: deps.q, groupId: deps.group, assignee: deps.assignee, sort: deps.sort, page: deps.page } }),
      getMe(),
      getGroups(),
      getFields(),
      getCompanyOptions(),
    ]);
    return { list, me, groups, fields, companies };
  },
  head: () => ({ meta: [{ title: "Contacts" }] }),
  component: Page,
});

function Page() {
  return (
    <CrmShell>
      <RecordList kind="person" search={parseListSearch(Route.useSearch())} data={Route.useLoaderData()} />
    </CrmShell>
  );
}
