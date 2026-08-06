import { useMemo } from "react";
import { useParams } from "react-router-dom";
import type { TaskJson } from "../../shared/contract";
import { useRepoTasks } from "../lib/queries";
import { avatarFor } from "../lib/avatar";
import { statusSemantic } from "../lib/status";
import { WarningStrip } from "../components/ui/WarningStrip";

interface MemberRow {
  email: string;
  name: string | null;
  open: number;
  reported: number;
  total: number;
}

function buildMembers(contributors: Record<string, string>, tasks: TaskJson[]): MemberRow[] {
  const rows = new Map<string, MemberRow>();
  const get = (email: string, name: string | null) => {
    let row = rows.get(email);
    if (!row) {
      row = { email, name: contributors[email] || name, open: 0, reported: 0, total: 0 };
      rows.set(email, row);
    }
    return row;
  };

  for (const email of Object.keys(contributors)) get(email, contributors[email] ?? null);

  for (const task of tasks) {
    if (task.deleted) continue;
    if (task.assignee) {
      const row = get(task.assignee, task.assignee_name);
      row.total++;
      if (statusSemantic(task.status) !== "success") row.open++;
    }
    const reporterRow = get(task.reporter, task.reporter_name);
    reporterRow.reported++;
    if (!task.assignee || task.assignee !== task.reporter) reporterRow.total++;
  }

  return [...rows.values()].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

/** Honest substitution for the reference's Members nav (§4.3) — git-task has no
 * invite/membership concept, just whoever `ls` has seen as an assignee, reporter or
 * commenter. Read-only directory + per-person task counts, no invites — nothing to
 * invite to. */
export function RepoMembersPage() {
  const { repo = "" } = useParams();
  const { data, isLoading, error } = useRepoTasks(repo, {});

  const members = useMemo(
    () => (data ? buildMembers(data.data.contributors, data.data.repos[0]?.tasks ?? []) : []),
    [data],
  );

  return (
    <div className="px-8 py-5">
      {data && <WarningStrip warnings={data.warnings} />}

      {isLoading && <p className="text-sm text-ink-4">Loading…</p>}
      {error && <p className="text-sm text-danger-ink">{error.message}</p>}
      {!isLoading && !error && members.length === 0 && (
        <p className="text-sm text-ink-4">No contributors seen yet — nobody has been assigned, reported, or commented on a task.</p>
      )}

      {members.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunk text-micro uppercase tracking-wide text-ink-4">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Person</th>
                <th className="px-4 py-2 text-right font-medium">Open (assigned)</th>
                <th className="px-4 py-2 text-right font-medium">Reported</th>
                <th className="px-4 py-2 text-right font-medium">Total tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {members.map((member) => {
                const avatar = avatarFor(member.email, member.name);
                return (
                  <tr key={member.email}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-pill text-micro font-semibold"
                          style={avatar.style}
                        >
                          {avatar.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-1">{member.name || member.email}</p>
                          {member.name && <p className="truncate text-micro text-ink-4">{member.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{member.open}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{member.reported}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{member.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
