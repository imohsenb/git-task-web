import type { TaskJson } from "../../../shared/contract";
import { Pill } from "../ui/Pill";
import { kindSemantic, prioritySemantic, statusSemantic } from "../../lib/status";
import { avatarFor } from "../../lib/avatar";
import { relativeTime } from "../../lib/format";

/**
 * Read-only detail view, shared by the drawer and the full-page route. Every field
 * below is user-controlled task content rendered through plain JSX text
 * interpolation — never dangerouslySetInnerHTML — so a task title/description/comment
 * crafted to look like markup can't execute as one.
 */
export function TaskDetail({ task }: { task: TaskJson }) {
  const assigneeAvatar = task.assignee ? avatarFor(task.assignee, task.assignee_name) : null;
  const reporterAvatar = avatarFor(task.reporter, task.reporter_name);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {task.priority && <Pill sem={prioritySemantic(task.priority)}>{task.priority}</Pill>}
        <Pill sem={kindSemantic(task.kind)}>{task.kind}</Pill>
        <Pill sem={statusSemantic(task.status)}>{task.status}</Pill>
        {task.deleted && <Pill sem="danger">deleted</Pill>}
        <span className="font-mono text-micro text-ink-4">{task.display_id}</span>
      </div>

      <h2 className={["text-xl font-semibold text-ink-1", task.deleted ? "line-through" : ""].join(" ")}>
        {task.title}
      </h2>

      {task.description && <p className="whitespace-pre-wrap text-sm text-ink-2">{task.description}</p>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-micro uppercase text-ink-4">Assignee</dt>
          <dd className="mt-1 flex items-center gap-1.5 text-ink-2">
            {assigneeAvatar ? (
              <>
                <span
                  className="flex size-5 items-center justify-center rounded-pill text-[10px] font-semibold"
                  style={assigneeAvatar.style}
                >
                  {assigneeAvatar.initials}
                </span>
                {task.assignee_name ?? task.assignee}
              </>
            ) : (
              <span className="text-ink-4">Unassigned</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-micro uppercase text-ink-4">Reporter</dt>
          <dd className="mt-1 flex items-center gap-1.5 text-ink-2">
            <span
              className="flex size-5 items-center justify-center rounded-pill text-[10px] font-semibold"
              style={reporterAvatar.style}
            >
              {reporterAvatar.initials}
            </span>
            {task.reporter_name}
          </dd>
        </div>
        {task.milestone && (
          <div>
            <dt className="text-micro uppercase text-ink-4">Milestone</dt>
            <dd className="mt-1 text-ink-2">{task.milestone}</dd>
          </div>
        )}
        {task.due && (
          <div>
            <dt className="text-micro uppercase text-ink-4">Due</dt>
            <dd className="mt-1 text-ink-2">{task.due}</dd>
          </div>
        )}
        {task.parent_display_id && (
          <div>
            <dt className="text-micro uppercase text-ink-4">Epic</dt>
            <dd className="mt-1 font-mono text-ink-2">{task.parent_display_id}</dd>
          </div>
        )}
        <div>
          <dt className="text-micro uppercase text-ink-4">Created</dt>
          <dd className="mt-1 text-ink-2">{relativeTime(task.created)}</dd>
        </div>
        <div>
          <dt className="text-micro uppercase text-ink-4">Updated</dt>
          <dd className="mt-1 text-ink-2">{relativeTime(task.updated)}</dd>
        </div>
      </dl>

      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.labels.map((label) => (
            <Pill key={label} sem="neutral">
              {label}
            </Pill>
          ))}
        </div>
      )}

      {task.links.length > 0 && (
        <div>
          <h3 className="mb-2 text-micro uppercase text-ink-4">Links</h3>
          <ul className="space-y-1 text-sm">
            {task.links.map((link) => (
              <li key={`${link.kind}-${link.target}`} className="flex items-center gap-2 text-ink-2">
                <Pill sem="neutral">{link.kind}</Pill>
                <span className="font-mono text-ink-3">{link.target_display_id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {task.comments.length > 0 && (
        <div>
          <h3 className="mb-2 text-micro uppercase text-ink-4">Comments ({task.comments.length})</h3>
          <ul className="space-y-3">
            {task.comments.map((comment) => {
              const commentAvatar = avatarFor(comment.author, comment.author_name);
              return (
                <li key={comment.id} className="rounded-card bg-surface-sunk p-3">
                  <div className="mb-1 flex items-center gap-2 text-micro text-ink-4">
                    <span
                      className="flex size-4 items-center justify-center rounded-pill text-[9px] font-semibold"
                      style={commentAvatar.style}
                    >
                      {commentAvatar.initials}
                    </span>
                    <span className="font-medium text-ink-3">{comment.author_name}</span>
                    <span>{relativeTime(comment.timestamp)}</span>
                    {comment.edited && <span>(edited)</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ink-2">{comment.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
