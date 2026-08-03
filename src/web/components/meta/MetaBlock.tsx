export interface MetaBlockProps {
  repoKey: string | null;
  branch: string | null;
  taskCount: number | null;
}

export function MetaBlock({ repoKey, branch, taskCount }: MetaBlockProps) {
  return (
    <div className="mt-3 flex items-center gap-2 text-sm text-ink-3">
      {repoKey && (
        <span className="rounded-pill bg-surface-sunk px-2 py-0.5 font-mono text-micro text-ink-3">{repoKey}</span>
      )}
      {branch && <span className="rounded-pill bg-surface-sunk px-2 py-0.5 text-micro text-ink-3">{branch}</span>}
      {taskCount !== null && (
        <span>
          {taskCount} task{taskCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
