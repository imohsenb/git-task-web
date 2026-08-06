import { useState } from "react";
import { Link } from "react-router-dom";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import type { TaskJson } from "../../../shared/contract";
import { Pill } from "../ui/Pill";
import { Combobox } from "../ui/Combobox";
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

  function copyLink() {
    const url = `${window.location.origin}/t/${encodeURIComponent(repo)}/${encodeURIComponent(task.display_id)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Couldn't copy link"),
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-micro text-ink-4">{task.display_id}</span>
            {task.deleted && <Pill sem="danger">deleted</Pill>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={copyLink}
              title="Copy link to this task"
              className="flex items-center gap-1 text-micro text-ink-4 hover:text-ink-1"
            >
              <Link2 size={13} />
              Copy link
            </button>
            {!task.deleted && (
              <>
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
              </>
            )}
          </div>
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
 * GTWEB-8384b5c4: "doesn't show the list of epic's children". GTWEB-913a480c:
 * `ls --parent=<id>` (even `--all`) only ever matches a same-repo parent — it can't
 * see a cross-repo child at all, so it was silently dropping them. `show`'s
 * `children[]` is the only place the CLI actually resolves cross-repo children (a
 * scan against every repo registered under the same project — see
 * docs/cli-json-contract.md), and `task` here already comes from `show` (useTask),
 * so this just reads it off the prop instead of firing its own query. Gated at the
 * call site (not a self-return-null here) so it never runs for a non-epic task.
 */
function EpicChildrenSection({ repo, task }: { repo: string; task: TaskJson }) {
  const children = task.children ?? [];

  return (
    <div>
      <h3 className="mb-2 text-micro uppercase text-ink-4">Children ({children.length})</h3>
      {children.length === 0 && <p className="text-sm text-ink-4">No child tasks yet.</p>}
      {children.length > 0 && (
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {children.map((child) => (
            <Link
              key={`${child.repo ?? repo}-${child.display_id}`}
              to={`/t/${encodeURIComponent(child.repo ?? repo)}/${encodeURIComponent(child.display_id)}`}
              className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-sunk"
            >
              <Pill sem={kindSemantic(child.kind)}>{child.kind}</Pill>
              <span className="w-24 shrink-0 truncate font-mono text-micro text-ink-4">{child.display_id}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-1">
                {child.title || "(untitled)"}
              </span>
              <Pill sem={statusSemantic(child.status)}>{child.status}</Pill>
              {child.repo && (
                <span className="shrink-0 rounded-pill bg-neutral-tint px-1.5 py-0.5 text-micro text-neutral-ink">
                  {child.repo}
                </span>
              )}
            </Link>
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
