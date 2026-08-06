import { useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { useRegistry } from "../lib/queries";
import { usePullRepo, usePushRepo } from "../lib/mutations";
import { ApiError } from "../lib/api";
import { Pill } from "../components/ui/Pill";
import type { PullJson, PushJson } from "../../shared/contract";

/**
 * Phase 6 (PLAN.md §6): per-repo push/pull with a per-ref result report, a "pull
 * first" CTA on rejection, and credential-error guidance — the three UX requirements
 * that a plain toast can't carry (they need a place to persist and an action button).
 */
export function RepoSyncPage() {
  const { repo = "" } = useParams();
  const { data: registry } = useRegistry();
  const repoEntry = registry?.data.repos.find((r) => r.name === repo);
  const remotes = repoEntry?.remotes ?? [];

  const [remote, setRemote] = useState<string | undefined>(undefined);
  const activeRemote = remote ?? remotes[0]?.name;

  const push = usePushRepo(repo);
  const pull = usePullRepo(repo);

  if (!registry) {
    return (
      <div className="px-8 py-6">
        <p className="text-sm text-ink-4">Loading…</p>
      </div>
    );
  }

  if (remotes.length === 0) {
    return (
      <div className="px-8 py-6">
        <p className="text-sm text-ink-3">
          No remote configured for this repo. Add one from a terminal —{" "}
          <code className="font-mono text-ink-2">git remote add origin &lt;url&gt;</code> — then reload.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5 px-8 py-6">
      <div className="flex items-center gap-2">
        <span className="text-micro uppercase tracking-wide text-ink-4">Remote</span>
        {remotes.length > 1 ? (
          <select
            value={activeRemote}
            onChange={(e) => setRemote(e.target.value)}
            className="rounded-control border border-line bg-surface px-2 py-1 text-sm text-ink-1"
          >
            {remotes.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-ink-1">{activeRemote}</span>
        )}
        {remotes.find((r) => r.name === activeRemote)?.url && (
          <span className="truncate font-mono text-micro text-ink-4">
            {remotes.find((r) => r.name === activeRemote)?.url}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => pull.mutate(activeRemote)}
          disabled={pull.isPending || !activeRemote}
          className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-1 transition-colors hover:bg-surface-sunk disabled:opacity-50"
        >
          <ArrowDown size={14} className={pull.isPending ? "animate-pulse" : ""} />
          {pull.isPending ? "Pulling…" : "Pull"}
        </button>
        <button
          type="button"
          onClick={() => push.mutate(activeRemote)}
          disabled={push.isPending || !activeRemote}
          className="flex items-center gap-1.5 rounded-control bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          <ArrowUp size={14} className={push.isPending ? "animate-pulse" : ""} />
          {push.isPending ? "Pushing…" : "Push"}
        </button>
      </div>

      {push.isError && (
        <ErrorBanner error={push.error} onPull={() => pull.mutate(activeRemote)} pullPending={pull.isPending} />
      )}
      {pull.isError && <ErrorBanner error={pull.error} />}

      {push.data && <PushResult data={push.data.data} />}
      {pull.data && <PullResult data={pull.data.data} />}
    </div>
  );
}

function ErrorBanner({
  error,
  onPull,
  pullPending,
}: {
  error: unknown;
  onPull?: () => void;
  pullPending?: boolean;
}) {
  const apiError = error instanceof ApiError ? error : null;

  if (apiError?.kind === "rejected") {
    return (
      <div className="flex items-center gap-3 rounded-card border border-warn-ink/30 bg-warn-tint px-3 py-2.5 text-sm text-warn-ink">
        <AlertTriangle size={16} className="shrink-0" />
        <span className="flex-1">Rejected — the remote has changes you don't have locally.</span>
        {onPull && (
          <button
            type="button"
            onClick={onPull}
            disabled={pullPending}
            className="shrink-0 rounded-control bg-warn-ink px-2.5 py-1 text-micro font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {pullPending ? "Pulling…" : "Pull now"}
          </button>
        )}
      </div>
    );
  }

  if (apiError?.kind === "remote") {
    return (
      <div className="rounded-card border border-danger-ink/30 bg-danger-tint px-3 py-2.5 text-sm text-danger-ink">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Could not reach the remote — check your network and that your SSH key or credentials work for this repo.</span>
        </div>
        {apiError.causes.length > 0 && (
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-micro text-danger-ink/80">
            {apiError.causes.join("\n")}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-card border border-danger-ink/30 bg-danger-tint px-3 py-2.5 text-sm text-danger-ink">
      {error instanceof Error ? error.message : "Sync failed."}
    </div>
  );
}

function PushResult({ data }: { data: PushJson }) {
  if (data.nothing_to_push) {
    return <p className="text-sm text-ink-4">Nothing to push — already up to date.</p>;
  }
  return (
    <div className="overflow-hidden rounded-card border border-line">
      <div className="border-b border-line bg-surface-sunk px-3 py-1.5 text-micro text-ink-3">
        Pushed {data.pushed} of {data.attempted} ref{data.attempted === 1 ? "" : "s"} to {data.remote}
      </div>
      <ul className="divide-y divide-line bg-surface text-sm">
        {[...data.refs, ...data.rejected].map((ref) => (
          <li key={ref.ref} className="flex items-center gap-2 px-3 py-1.5">
            <Pill sem={ref.status === "ok" ? "success" : "danger"}>{ref.status}</Pill>
            <span className="font-mono text-ink-2">{ref.display_id ?? ref.ref}</span>
            {ref.message && <span className="truncate text-micro text-ink-4">{ref.message}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PullResult({ data }: { data: PullJson }) {
  const { new: newCount, fast_forwarded, merged, up_to_date } = data.counts;
  if (newCount + fast_forwarded + merged === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-ink-4">
        <RefreshCw size={14} /> Already up to date ({up_to_date} task{up_to_date === 1 ? "" : "s"}).
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-card border border-line">
      <div className="border-b border-line bg-surface-sunk px-3 py-1.5 text-micro text-ink-3">
        {newCount} new · {fast_forwarded} fast-forwarded · {merged} merged · {up_to_date} up to date
      </div>
      <ul className="divide-y divide-line bg-surface text-sm">
        {data.tasks
          .filter((t) => t.outcome !== "up_to_date")
          .map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-1.5">
              <Pill sem="info">{t.outcome}</Pill>
              <span className="font-mono text-ink-2">{t.display_id}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
