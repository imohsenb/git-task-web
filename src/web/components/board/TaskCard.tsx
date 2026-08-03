import { Link } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare, Link2, ListTree } from "lucide-react";
import type { TaskJson } from "../../../shared/contract";
import { Pill } from "../ui/Pill";
import { kindSemantic, prioritySemantic } from "../../lib/status";
import { avatarFor, type AvatarInfo } from "../../lib/avatar";

const MAX_LABELS = 2;
const MAX_PEOPLE = 3;

interface CardPerson extends AvatarInfo {
  email: string;
  name: string | null;
}

/** Draggable card in a board column — drag payload carries `displayId`/`status` so
 * RepoBoard's onDragEnd can call useSetStatus without a lookup. */
export function TaskCard({ repo, task, childCount }: { repo: string; task: TaskJson; childCount?: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { displayId: task.display_id, status: task.status },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: transform ? CSS.Translate.toString(transform) : undefined, touchAction: "none" }}
      className={["cursor-grab touch-none active:cursor-grabbing", isDragging ? "opacity-40" : ""].join(" ")}
    >
      <Link
        to={`/r/${encodeURIComponent(repo)}/board/t/${encodeURIComponent(task.display_id)}`}
        className={[
          "block rounded-card bg-surface p-3 shadow-card transition-shadow hover:shadow-lift",
          task.deleted ? "opacity-55" : "",
        ].join(" ")}
      >
        <CardContent task={task} childCount={childCount} />
      </Link>
    </div>
  );
}

/** Non-interactive clone rendered inside `<DragOverlay>` — sharing an `id` with the
 * real draggable in the same `useDraggable` call would register it twice. */
export function TaskCardGhost({ task, childCount }: { task: TaskJson; childCount?: number }) {
  return (
    <div className="rounded-card bg-surface p-3 shadow-lift">
      <CardContent task={task} childCount={childCount} />
    </div>
  );
}

function CardContent({ task, childCount }: { task: TaskJson; childCount?: number }) {
  const people = cardPeople(task);
  const extraLabels = task.labels.length - MAX_LABELS;

  return (
    <>
      <div className="flex items-center gap-1.5">
        {task.priority && <Pill sem={prioritySemantic(task.priority)}>{task.priority}</Pill>}
        <Pill sem={kindSemantic(task.kind)}>{task.kind}</Pill>
        {task.deleted && <Pill sem="danger">deleted</Pill>}
        <span className="ml-auto shrink-0 font-mono text-micro text-ink-4">{task.display_id}</span>
      </div>

      <p className={["mt-2 line-clamp-2 text-sm font-semibold text-ink-1", task.deleted ? "line-through" : ""].join(" ")}>
        {task.title}
      </p>

      {task.description && <p className="mt-1 line-clamp-1 text-micro text-ink-3">{task.description}</p>}

      <div className="mt-2.5 flex items-center gap-1.5">
        {task.labels.slice(0, MAX_LABELS).map((label) => (
          <Pill key={label} sem="neutral">
            {label}
          </Pill>
        ))}
        {extraLabels > 0 && <Pill sem="neutral">+{extraLabels}</Pill>}

        <div className="ml-auto flex items-center gap-2">
          {people.length > 0 && (
            <div className="flex -space-x-1.5">
              {people.map((p) => (
                <span
                  key={p.email}
                  className="flex size-5 shrink-0 items-center justify-center rounded-pill text-[10px] font-semibold ring-2 ring-surface"
                  style={p.style}
                  title={p.name ?? p.email}
                >
                  {p.initials}
                </span>
              ))}
            </div>
          )}
          <span className="flex items-center gap-2 text-micro text-ink-4">
            {task.comments.length > 0 && (
              <span className="flex items-center gap-0.5">
                <MessageSquare size={12} />
                {task.comments.length}
              </span>
            )}
            {task.links.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Link2 size={12} />
                {task.links.length}
              </span>
            )}
            {task.kind === "epic" && !!childCount && (
              <span className="flex items-center gap-0.5">
                <ListTree size={12} />
                {childCount}
              </span>
            )}
          </span>
        </div>
      </div>
    </>
  );
}

/** Assignee first, then distinct comment authors, capped at MAX_PEOPLE (§4.3 TaskCard row 4). */
function cardPeople(task: TaskJson): CardPerson[] {
  const seen = new Set<string>();
  const people: CardPerson[] = [];

  if (task.assignee) {
    seen.add(task.assignee);
    people.push({ email: task.assignee, name: task.assignee_name, ...avatarFor(task.assignee, task.assignee_name) });
  }
  for (const comment of task.comments) {
    if (people.length >= MAX_PEOPLE) break;
    if (seen.has(comment.author)) continue;
    seen.add(comment.author);
    people.push({ email: comment.author, name: comment.author_name, ...avatarFor(comment.author, comment.author_name) });
  }
  return people;
}
