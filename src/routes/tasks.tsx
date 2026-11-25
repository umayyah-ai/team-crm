import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CrmShell } from "@/client/components/CrmShell";
import { MemberSelect } from "@/client/components/crm/FormField";
import { TaskForm, type TaskDraft } from "@/client/components/crm/TaskForm";
import { TaskSection, type TaskRow } from "@/client/components/crm/TaskList";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { localDay } from "@/client/lib/format";
import { useRun } from "@/client/lib/useRun";
import { deleteTask, getContactOptions, getItemOptions, getMe, listTasks, setTaskDone } from "@/serverFunctions/crm";

export const Route = createFileRoute("/tasks")({
  // Overdue and today depend on the browser's own date.
  ssr: false,
  validateSearch: (search: { assignee?: unknown }): { assignee?: string } =>
    typeof search.assignee === "string" && search.assignee ? { assignee: search.assignee } : {},
  loaderDeps: ({ search }) => ({ assignee: search.assignee ?? "" }),
  loader: async ({ deps }) => {
    const [tasks, me, records, items] = await Promise.all([
      listTasks({ data: { assignee: deps.assignee } }),
      getMe(),
      getContactOptions(),
      getItemOptions(),
    ]);
    return { tasks, me, records, items };
  },
  head: () => ({ meta: [{ title: "Tasks" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { tasks, me, records, items } = Route.useLoaderData();
  const assignee = Route.useSearch().assignee ?? "";
  const navigate = useNavigate();
  const { run } = useRun();
  const [editing, setEditing] = useState<TaskDraft | null>(null);
  const [deleting, setDeleting] = useState<TaskRow | null>(null);
  const today = localDay();
  const open = tasks.open;
  const sections = {
    overdue: open.filter((t) => t.dueDate < today),
    today: open.filter((t) => t.dueDate === today),
    upcoming: open.filter((t) => t.dueDate > today),
  };
  const common = {
    canEdit: tasks.canEdit,
    onToggle: (task: TaskRow) => run(() => setTaskDone({ data: { id: task.id, done: task.completedAt === null } })),
    onEdit: (task: TaskRow) =>
      setEditing({
        id: task.id, title: task.title, description: task.description, dueDate: task.dueDate,
        contactId: task.contactId, pipelineItemId: task.pipelineItemId, assignedUserId: task.assignedUserId,
      }),
    onDelete: (task: TaskRow) => setDeleting(task),
  };

  return (
    <CrmShell>
      <PageHeader
        title="Tasks"
        actions={
          <Button
            onClick={() =>
              setEditing({ title: "", description: "", dueDate: today, contactId: null, pipelineItemId: null, assignedUserId: assignee || me.id })
            }
          >
            <Plus /> New task
          </Button>
        }
      />
      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor="tasks-for">Show tasks for</Label>
        <MemberSelect
          id="tasks-for"
          members={me.members.filter((m) => m.level !== "none")}
          value={assignee || me.id}
          onChange={(v) => navigate({ to: "/tasks", search: v === me.id ? {} : { assignee: v } })}
        />
      </div>
      <TaskSection testId="tasks-overdue" title="Overdue" tasks={sections.overdue} empty="Nothing overdue." {...common} />
      <TaskSection testId="tasks-today" title="Today" tasks={sections.today} empty="Nothing due today." {...common} />
      <TaskSection testId="tasks-upcoming" title="Upcoming" tasks={sections.upcoming} empty="Nothing coming up." {...common} />
      <TaskSection testId="tasks-completed" title="Completed" tasks={tasks.completed} empty="No completed tasks yet." {...common} />
      {editing ? (
        <TaskForm
          initial={editing}
          members={me.members}
          records={records}
          items={items}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void run(async () => undefined);
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete “${deleting.title}”?`}
          confirmLabel="Delete"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await run(() => deleteTask({ data: { id: deleting.id } }));
            setDeleting(null);
          }}
        />
      ) : null}
    </CrmShell>
  );
}
