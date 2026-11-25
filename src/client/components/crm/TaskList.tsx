import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { dayLabel } from "@/client/lib/format";

export interface TaskRow {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  contactId: string | null;
  contactName: string | null;
  pipelineItemId: string | null;
  pipelineName: string | null;
  assignedUserId: string;
  completedAt: string | null;
}

/** One section of tasks; empty sections say so. */
export function TaskSection({
  testId,
  title,
  tasks,
  empty,
  canEdit,
  onToggle,
  onEdit,
  onDelete,
}: {
  testId: string;
  title: string;
  tasks: TaskRow[];
  empty: string;
  canEdit: boolean;
  onToggle: (task: TaskRow) => void;
  onEdit?: (task: TaskRow) => void;
  onDelete?: (task: TaskRow) => void;
}) {
  return (
    <section data-testid={testId} className="space-y-2">
      <h2 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground">{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-start gap-3 px-4 py-3">
              <Checkbox
                className="mt-0.5"
                checked={task.completedAt !== null}
                disabled={!canEdit}
                aria-label={`Complete ${task.title}`}
                onCheckedChange={() => onToggle(task)}
              />
              <div className="min-w-0 flex-1">
                <div className={task.completedAt ? "text-muted-foreground line-through" : "font-medium"}>{task.title}</div>
                <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span>Due {dayLabel(task.dueDate)}</span>
                  {task.contactId && task.contactName ? (
                    <Link to="/contacts/$id" params={{ id: task.contactId }} className="hover:underline">
                      {task.contactName}
                    </Link>
                  ) : null}
                  {task.pipelineName ? <span>{task.pipelineName}</span> : null}
                </div>
                {task.description ? <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{task.description}</p> : null}
              </div>
              {canEdit && onEdit && onDelete ? (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}>
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
