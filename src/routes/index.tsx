import { createFileRoute, Link } from "@tanstack/react-router";
import { CrmShell } from "@/client/components/CrmShell";
import { TaskSection, type TaskRow } from "@/client/components/crm/TaskList";
import { PageHeader } from "@/client/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { localDay } from "@/client/lib/format";
import { useRun } from "@/client/lib/useRun";
import { getEvents, listTasks, setTaskDone } from "@/serverFunctions/crm";

export const Route = createFileRoute("/")({
  // Today is the browser's today.
  ssr: false,
  loader: async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const [tasks, events] = await Promise.all([
      listTasks({ data: { assignee: "" } }),
      getEvents({ data: { from: start.toISOString(), to: end.toISOString(), teammates: [] } }),
    ]);
    return { tasks, events };
  },
  head: () => ({ meta: [{ title: "Today" }] }),
  component: TodayPage,
});

function TodayPage() {
  const { tasks, events } = Route.useLoaderData();
  const { run } = useRun();
  const today = localDay();
  const onToggle = (task: TaskRow) => run(() => setTaskDone({ data: { id: task.id, done: task.completedAt === null } }));
  return (
    <CrmShell>
      <PageHeader
        title="Today"
        description={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <TaskSection
            testId="today-overdue"
            title="Overdue"
            tasks={tasks.open.filter((t) => t.dueDate < today)}
            empty="Nothing overdue."
            canEdit
            onToggle={onToggle}
          />
          <TaskSection
            testId="today-tasks"
            title="Due today"
            tasks={tasks.open.filter((t) => t.dueDate === today)}
            empty="Nothing due today."
            canEdit
            onToggle={onToggle}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events today.</p>
            ) : (
              <ul className="grid gap-3 text-sm">
                {events.map((e) => (
                  <li key={e.id}>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-muted-foreground">
                      {e.allDay
                        ? "All day"
                        : `${new Date(e.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${new Date(e.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                      {e.location ? ` · ${e.location}` : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/calendar" className="mt-4 inline-block text-sm text-primary hover:underline">
              Open calendar
            </Link>
          </CardContent>
        </Card>
      </div>
    </CrmShell>
  );
}
