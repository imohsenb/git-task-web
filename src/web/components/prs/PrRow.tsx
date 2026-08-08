import { GitPullRequest, ExternalLink } from "lucide-react";
import type { PullRequestJson } from "../../../shared/contract";
import { Pill } from "../ui/Pill";

export function PrRow({ pr, repoLabel }: { pr: PullRequestJson; repoLabel?: string }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5 transition-colors hover:bg-surface-sunk">
      <div className="flex min-w-0 items-center gap-2">
        <GitPullRequest size={14} className="shrink-0 text-ink-3" />
        {repoLabel && <Pill sem="neutral">{repoLabel}</Pill>}
        <span className="shrink-0 font-mono text-micro text-ink-3">{pr.id}</span>
        <Pill sem={pr.state === "open" ? "info" : pr.state === "merged" ? "success" : "neutral"}>{pr.state}</Pill>
        <span className="truncate text-xs font-medium text-ink-1" title={pr.title}>
          {pr.title}
        </span>
      </div>
      <a
        href={pr.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-ink-4 hover:text-ink-1"
        title="Open pull request in browser"
      >
        <ExternalLink size={13} />
      </a>
    </li>
  );
}
