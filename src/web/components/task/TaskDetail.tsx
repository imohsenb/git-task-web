import { useState } from "react";
import type { TaskJson } from "../../../shared/contract";
import { Pill } from "../ui/Pill";
import { Combobox } from "../ui/Combobox";
import { TaskListRow } from "../list/TaskListRow";
import { kindSemantic, prioritySemantic, statusSemantic } from "../../lib/status";
import { avatarFor } from "../../lib/avatar";
import { relativeTime } from "../../lib/format";
import { useSetStatus } from "../../lib/mutations";
import { useRepoTasks } from "../../lib/queries";
import { deriveColumns } from "../../lib/columns";
import { TaskEditForm } from "./TaskEditForm";
import { LabelsSection } from "./LabelsSection";
import { LinksSection } from "./LinksSection";
import { ParentSection } from "./ParentSection";
import { CommentsSection } from "./CommentsSection";
import { TaskDangerMenu } from "./TaskDangerMenu";

/**
 * Shared by the dialog and the full-page route. Every field below is user-controlled
 * task content rendered through plain JSX text interpolation — never
 * dangerouslySetInnerHTML — so a task title/description/comment crafted to look like
 * markup can't execute as one. Writable as of Phase 4: edit, status, comments,
 * labels, links, epic parent, delete/drop all hit their own mutation hook (§4.4 —
 * "Card kebab menu and detail dialog hit the same useSetStatus() hook").
 *
 * Two columns above `lg`: main content (title/description/children/comments) left,
 * a compact metadata list right — GTWEB-8384b5c4 (needed more width than the old
 * 480px drawer gave it to be worth doing; single column below `lg`).
 */
export function TaskDetail({ repo, task }: { repo: string; task: TaskJson }) {
  const [isEditing, setIsEditing] = useState(false);
  const assigneeAvatar = task.assignee ? avatarFor(task.assignee, task.assignee_name) : null;
  const reporterAvatar = avatarFor(task.reporter, task.reporter_name);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-micro text-ink-4">{task.display_id}</span>
            {task.deleted && <Pill sem="danger">deleted</Pill>}
          </div>
          {!task.deleted && (
            <div className="flex shrink-0 items-center gap-1">
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-micro text-ink-4 hover:text-ink-1"
                >
                  Edit
                </button>
              )}
              <TaskDangerMenu repo={repo} task={task} />
            </div>
          )}
        </div>

        {isEditing ? (
          <TaskEditForm repo={repo} task={task} onDone={() => setIsEditing(false)} />
        ) : (
          <>
            <h2 className={["text-xl font-semibold text-ink-1", task.deleted ? "line-through" : ""].join(" ")}>
              {task.title}
            </h2>
            {task.description && <p className="whitespace-pre-wrap text-sm text-ink-2">{task.description}</p>}
          </>
        )}

        {task.kind === "epic" && <EpicChildrenSection repo={repo} task={task} />}

        <CommentsSection repo={repo} task={task} />
      </div>

      <div className="w-full shrink-0 space-y-5 lg:w-64">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-micro uppercase text-ink-4">Status</dt>
            <dd className="mt-1">
              <StatusEditor repo={repo} task={task} />
            </dd>
          </div>
          <div>
            <dt className="text-micro uppercase text-ink-4">Kind</dt>
            <dd className="mt-1">
              <Pill sem={kindSemantic(task.kind)}>{task.kind}</Pill>
            </dd>
          </div>
          {task.priority && (
            <div>
              <dt className="text-micro uppercase text-ink-4">Priority</dt>
              <dd className="mt-1">
                <Pill sem={prioritySemantic(task.priority)}>{task.priority}</Pill>
              </dd>
            </div>
          )}
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
          <ParentSection repo={repo} task={task} />
          <div>
            <dt className="text-micro uppercase text-ink-4">Created</dt>
            <dd className="mt-1 text-ink-2">{relativeTime(task.created)}</dd>
          </div>
          <div>
            <dt className="text-micro uppercase text-ink-4">Updated</dt>
            <dd className="mt-1 text-ink-2">{relativeTime(task.updated)}</dd>
          </div>
        </dl>

        <LabelsSection repo={repo} task={task} />
        <VersionsSection task={task} />
        <LinksSection repo={repo} task={task} />
      </div>
    </div>
  );
}

/**
 * GTWEB-8384b5c4: "doesn't show the list of epic's children". `ls --parent=<id>`
 * already exists for exactly this — verified live, no backend change needed. Gated
 * at the call site (not a self-return-null here) so the query never fires for a
 * non-epic task.
 */
function EpicChildrenSection({ repo, task }: { repo: string; task: TaskJson }) {
  const { data, isLoading } = useRepoTasks(repo, { parent: task.display_id });
  const children = data?.data.repos[0]?.tasks ?? [];

  return (
    <div>
      <h3 className="mb-2 text-micro uppercase text-ink-4">Children{data ? ` (${children.length})` : ""}</h3>
      {isLoading && <p className="text-sm text-ink-4">Loading…</p>}
      {data && children.length === 0 && <p className="text-sm text-ink-4">No child tasks yet.</p>}
      {children.length > 0 && (
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {children.map((child) => (
            <TaskListRow key={child.id} repo={repo} task={child} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Read-only: the CLI's `--fixed-version`/`--affected-version` are `new`-time-only
 * flags — `edit` has no matching add/rm path yet, so unlike labels there's nothing
 * to wire a mutation to.
 */
function VersionsSection({ task }: { task: TaskJson }) {
  if (task.fixed_versions.length === 0 && task.affected_versions.length === 0) return null;

  return (
    <div className="space-y-4">
      {task.fixed_versions.length > 0 && (
        <div>
          <h3 className="mb-2 text-micro uppercase text-ink-4">Fixed in</h3>
          <div className="flex flex-wrap gap-1.5">
            {task.fixed_versions.map((version) => (
              <Pill key={version} sem="success">
                {version}
              </Pill>
            ))}
          </div>
        </div>
      )}
      {task.affected_versions.length > 0 && (
        <div>
          <h3 className="mb-2 text-micro uppercase text-ink-4">Affects</h3>
          <div className="flex flex-wrap gap-1.5">
            {task.affected_versions.map((version) => (
              <Pill key={version} sem="danger">
                {version}
              </Pill>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Options come from `deriveColumns` — the same default-preset ∪ observed-statuses
 * union the board uses for its columns (§ board fix), so the picker always offers
 * at least todo/doing/blocked/done plus whatever this repo actually uses.
 * `allowCustom` stays on: git-task's `status` is free-form (no closed enum — see
 * `setStatus round-trips a dash-prefixed status value verbatim` in
 * mutations.test.ts), so typing an unlisted value and hitting Enter still works.
 */
function StatusEditor({ repo, task }: { repo: string; task: TaskJson }) {
  const setStatus = useSetStatus(repo);
  const { data: tasksData } = useRepoTasks(repo);
  const [isEditing, setIsEditing] = useState(false);

  if (task.deleted) {
    return <Pill sem={statusSemantic(task.status)}>{task.status}</Pill>;
  }

  if (!isEditing) {
    return (
      <button type="button" title="Click to change status" onClick={() => setIsEditing(true)}>
        <Pill sem={statusSemantic(task.status)}>{task.status}</Pill>
      </button>
    );
  }

  const options = deriveColumns(tasksData?.data.statuses ?? []).map((col) => ({
    value: col.status,
    label: col.status,
  }));

  function commit(next: string) {
    setIsEditing(false);
    if (!next || next === task.status) return;
    setStatus.mutate({ id: task.display_id, status: next });
  }

  return (
    <Combobox
      autoFocus
      allowCustom
      className="w-40"
      value={task.status}
      options={options}
      placeholder="Status…"
      onChange={commit}
      onCancel={() => setIsEditing(false)}
    />
  );
}
