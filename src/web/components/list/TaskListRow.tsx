import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Link2 } from "lucide-react";
import type { TaskJson } from "../../../shared/contract";
import { Pill } from "../ui/Pill";
import { kindSemantic, prioritySemantic, statusSemantic } from "../../lib/status";
import { avatarFor } from "../../lib/avatar";
import { relativeTime } from "../../lib/format";

export function TaskListRow({ repo, task }: { repo: string; task: TaskJson }) {
  const location = useLocation();
  const view = location.pathname.includes("/board") ? "board" : location.pathname.includes("/table") ? "table" : "list";
  const avatar = task.assignee ? avatarFor(task.assignee, task.assignee_name) : null;

  return (
    <Link
      to={`/r/${encodeURIComponent(repo)}/${view}/t/${encodeURIComponent(task.display_id)}`}
      className={[
        "flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-sunk",
        task.deleted ? "opacity-55" : "",
      ].join(" ")}
    >
      {task.priority && <Pill sem={prioritySemantic(task.priority)}>{task.priority}</Pill>}
      <Pill sem={kindSemantic(task.kind)}>{task.kind}</Pill>
      <span className="w-24 shrink-0 truncate font-mono text-micro text-ink-4">{task.display_id}</span>
      <span
        className={[
          "min-w-0 flex-1 truncate text-sm font-medium text-ink-1",
          task.deleted ? "line-through" : "",
        ].join(" ")}
      >
        {task.title}
      </span>
      {task.deleted && <Pill sem="danger">deleted</Pill>}
      <Pill sem={statusSemantic(task.status)}>{task.status}</Pill>
      {avatar && (
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-pill text-[10px] font-semibold"
          style={avatar.style}
          title={task.assignee_name ?? task.assignee ?? undefined}
        >
          {avatar.initials}
        </span>
      )}
      {task.comments.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-micro text-ink-4">
          <MessageSquare size={12} />
          {task.comments.length}
        </span>
      )}
      {task.links.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-micro text-ink-4">
          <Link2 size={12} />
          {task.links.length}
        </span>
      )}
      <span className="w-20 shrink-0 text-right text-micro text-ink-4">{relativeTime(task.updated)}</span>
    </Link>
  );
}
