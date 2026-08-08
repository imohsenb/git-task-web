import { useState } from "react";
import { RefreshCw, Terminal } from "lucide-react";
import type { TaskJson } from "../../../shared/contract";
import { PrRow } from "../prs/PrRow";
import { useTaskPrs } from "../../lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";
import { apiGet } from "../../lib/api";
import type { TaskPrsResponseJson } from "../../../shared/contract";

export function DevelopmentSection({ repo, task }: { repo: string; task: TaskJson }) {
  const { data, isLoading, isFetching } = useTaskPrs(repo, task.display_id);
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const freshData = await apiGet<TaskPrsResponseJson>(
        `/repos/${encodeURIComponent(repo)}/tasks/${encodeURIComponent(task.display_id)}/prs?force=true`,
      );
      queryClient.setQueryData(queryKeys.taskPrs(repo, task.display_id), freshData);
    } catch {
      // Ignore background refresh errors
    } finally {
      setIsRefreshing(false);
    }
  }

  const prsData = data?.data;
  const cliAvailable = prsData?.cliAvailable ?? false;
  const prs = prsData?.prs ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-micro uppercase text-ink-4">Development</h3>
        {cliAvailable && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isFetching}
            title="Refresh pull requests"
            className="text-ink-4 hover:text-ink-1 disabled:opacity-50"
          >
            <RefreshCw size={12} className={isRefreshing || isFetching ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-micro text-ink-4">Checking linked pull requests…</p>
      ) : !cliAvailable && prsData?.providerName ? (
        <div className="rounded-control border border-line bg-surface-sunk p-2.5 text-xs text-ink-3">
          <div className="flex items-center gap-1.5 font-medium text-ink-2">
            <Terminal size={14} className="text-ink-4" />
            <span>{prsData.providerName} Integration</span>
          </div>
          <p className="mt-1 text-micro text-ink-4">
            Install the <code className="rounded bg-surface px-1 font-mono text-ink-2">{prsData.cliName ?? "CLI"}</code> tool to automatically discover and link pull requests.
          </p>
        </div>
      ) : prs.length === 0 ? (
        <p className="text-micro text-ink-4">No linked pull requests found.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {prs.map((pr) => (
            <PrRow key={pr.id} pr={pr} />
          ))}
        </ul>
      )}
    </div>
  );
}
