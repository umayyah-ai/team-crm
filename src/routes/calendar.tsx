import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { CrmShell } from "@/client/components/CrmShell";
import { compactSearch } from "@/client/components/crm/RecordList";
import { EventForm, type CalendarEvent } from "@/client/components/crm/EventForm";
import { PageHeader } from "@/client/components/PageHeader";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { localDay } from "@/client/lib/format";
import { useRun } from "@/client/lib/useRun";
import { getContactOptions, getEvents, getMe } from "@/serverFunctions/crm";

interface Search {
  view: "month" | "week";
  date: string;
  team: string[];
}

/** The days the view shows, from Sunday to Saturday. */
function visibleDays(view: Search["view"], date: string) {
  const anchor = new Date(`${date}T00:00:00`);
  const start = new Date(anchor);
  if (view === "month") start.setDate(1);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(view === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) : start);
  if (view === "week") end.setDate(start.getDate() + 6);
  else end.setDate(end.getDate() + (6 - end.getDay()));
  const days: Date[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  return days;
}

function parseSearch(s: Record<string, unknown>): Search {
  return ({
    view: s.view === "week" ? "week" : "month",
    date: typeof s.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : localDay(),
    team: Array.isArray(s.team) ? s.team.filter((t): t is string => typeof t === "string") : [],
  });
}

export const Route = createFileRoute("/calendar")({
  // The grid is in the browser's time zone.
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Partial<Search> => compactSearch(parseSearch(s), parseSearch({})),
  loaderDeps: ({ search }) => parseSearch(search),
  loader: async ({ deps }) => {
    const days = visibleDays(deps.view, deps.date);
    const to = new Date(days[days.length - 1]!);
    to.setDate(to.getDate() + 1);
    const [events, me, records] = await Promise.all([
      getEvents({ data: { from: days[0]!.toISOString(), to: to.toISOString(), teammates: deps.team } }),
      getMe(),
      getContactOptions(),
    ]);
    return { events, me, records };
  },
  head: () => ({ meta: [{ title: "Calendar" }] }),
  component: CalendarPage,
});

function eventDays(e: CalendarEvent) {
  if (e.allDay) return { first: e.startsAt.slice(0, 10), last: e.endsAt.slice(0, 10) };
  return { first: localDay(new Date(e.startsAt)), last: localDay(new Date(e.endsAt)) };
}

function CalendarPage() {
  const { events, me, records } = Route.useLoaderData();
  const search = parseSearch(Route.useSearch());
  const navigate = useNavigate();
  const { run } = useRun();
  const [open, setOpen] = useState<{ event: CalendarEvent | null; day: string } | null>(null);
  const days = visibleDays(search.view, search.date);
  const anchor = new Date(`${search.date}T00:00:00`);
  const today = localDay();
  const go = (change: Partial<Search>) => navigate({ to: "/calendar", search: { ...search, ...change } });
  const shift = (step: number) => {
    const d = new Date(anchor);
    if (search.view === "month") d.setMonth(d.getMonth() + step, 1);
    else d.setDate(d.getDate() + 7 * step);
    go({ date: localDay(d) });
  };
  const teammates = me.members.filter((m) => m.id !== me.id && m.level !== "none");
  const title =
    search.view === "month"
      ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : `${days[0]!.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6]!.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <CrmShell>
      <PageHeader
        title="Calendar"
        description={title}
        actions={
          <>
            <SegmentedToggle
              showLabels
              value={search.view}
              onChange={(view) => go({ view })}
              items={[
                { value: "month", label: "Month", icon: <CalendarDays /> },
                { value: "week", label: "Week", icon: <CalendarRange /> },
              ]}
            />
            <Button variant="outline" size="icon" aria-label="Previous" onClick={() => shift(-1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" onClick={() => go({ date: today })}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next" onClick={() => shift(1)}>
              <ChevronRight />
            </Button>
            <Button onClick={() => setOpen({ event: null, day: search.date })}>
              <Plus /> New event
            </Button>
          </>
        }
      />
      {teammates.length ? (
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <legend className="sr-only">Team view</legend>
          <span className="text-muted-foreground">Also show</span>
          {teammates.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <Checkbox
                checked={search.team.includes(m.id)}
                aria-label={`Show ${m.email}`}
                onCheckedChange={(on) => go({ team: on ? [...search.team, m.id] : search.team.filter((t) => t !== m.id) })}
              />
              {m.email}
            </div>
          ))}
        </fieldset>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border text-xs text-muted-foreground">
          {days.slice(0, 7).map((d) => (
            <div key={d.toISOString()} className="px-2 py-1.5">
              {d.toLocaleDateString(undefined, { weekday: "short" })}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = localDay(d);
            const dayEvents = events.filter((e) => {
              const { first, last } = eventDays(e);
              return first <= key && key <= last;
            });
            const outside = search.view === "month" && d.getMonth() !== anchor.getMonth();
            return (
              <div
                key={key}
                className={`grid content-start gap-1 border-r border-b border-border p-1.5 ${search.view === "week" ? "min-h-64" : "min-h-24"} ${outside ? "bg-muted/40" : ""}`}
              >
                <button
                  type="button"
                  aria-label={`Add event on ${key}`}
                  onClick={() => setOpen({ event: null, day: key })}
                  className={`justify-self-start rounded px-1 text-xs ${key === today ? "bg-primary text-primary-foreground" : outside ? "text-muted-foreground" : ""}`}
                >
                  {d.getDate()}
                </button>
                {dayEvents.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    data-testid="calendar-event"
                    onClick={() => setOpen({ event: e, day: key })}
                    className={`truncate rounded px-1.5 py-0.5 text-left text-xs ${e.ownerId === me.id ? "bg-primary/15 text-foreground" : "bg-muted text-foreground"}`}
                    title={e.ownerId === me.id ? e.title : `${e.title} (${e.owner})`}
                  >
                    {e.allDay ? null : (
                      <span className="text-muted-foreground">
                        {new Date(e.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{" "}
                      </span>
                    )}
                    {e.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {open ? (
        <EventForm
          event={open.event}
          day={open.day}
          me={me.id}
          members={me.members}
          records={records}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            void run(async () => undefined);
          }}
        />
      ) : null}
    </CrmShell>
  );
}
