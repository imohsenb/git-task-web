import { useState } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw, Terminal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRepoPrs } from "../lib/queries";
import { queryKeys } from "../lib/queryKeys";
import { apiGet } from "../lib/api";
import type { RepoPrsResponseJson } from "../../shared/contract";
import { PrRow } from "../components/prs/PrRow";

export function RepoDevelopmentPage() {
  const { repo = "" } = useParams();
  const { data, isLoading, isFetching } = useRepoPrs(repo);
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const freshData = await apiGet<RepoPrsResponseJson>(`/repos/${encodeURIComponent(repo)}/prs?force=true`);
      queryClient.setQueryData(queryKeys.repoPrs(repo), freshData);
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
    <div className="px-8 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-1">Open pull requests</h2>
        {cliAvailable && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isFetching}
            className="flex items-center gap-1.5 text-micro text-ink-4 transition-colors hover:text-ink-1 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRefreshing || isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-4">Checking pull requests…</p>
      ) : !cliAvailable && prsData?.providerName ? (
        <div className="max-w-md rounded-card border border-line bg-surface-sunk p-4 text-sm text-ink-3">
          <div className="flex items-center gap-2 font-medium text-ink-2">
            <Terminal size={16} className="text-ink-4" />
            <span>{prsData.providerName} Integration</span>
          </div>
          <p className="mt-1.5 text-xs text-ink-4">
            Install the <code className="rounded bg-surface px-1 font-mono text-ink-2">{prsData.cliName ?? "CLI"}</code>{" "}
            tool to list this repo's open pull requests here.
          </p>
        </div>
      ) : !prsData?.providerName ? (
        <p className="text-sm text-ink-4">No GitHub or GitLab remote detected for this repo.</p>
      ) : prs.length === 0 ? (
        <p className="text-sm text-ink-4">No open pull requests.</p>
      ) : (
        <ul className="max-w-2xl space-y-1.5 text-sm">
          {prs.map((pr) => (
            <PrRow key={pr.id} pr={pr} />
          ))}
        </ul>
      )}
    </div>
  );
}
