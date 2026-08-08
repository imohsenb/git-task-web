import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FolderOpen } from "lucide-react";
import { useAllTasksLite, useRegistry } from "../../lib/queries";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

const MAX_PROJECT_RESULTS = 5;
const MAX_TASK_RESULTS = 8;

/**
 * Quick-jump by project name, task ID, or task title across every registered
 * repo — not full-text search over description/comments (that's what the
 * per-repo/project FilterBar search is for). Three things keep this cheap as
 * repos/tasks grow: (1) `ls --all` is one CLI spawn covering every repo, not
 * one per repo; (2) the query stays disabled until the box is actually
 * focused, so it costs nothing on pages that never touch search; (3) it hits
 * `/api/tasks?light=true`, which strips each task down to id/display_id/title
 * server-side (see routes/tasks.ts toLite) instead of shipping every task's
 * full description/comments/links over HTTP just to throw them away here.
 * GTASK-7b322d51 tracks the matching CLI-side ask — skip building the full
 * payload in the first place, not just trim it after.
 */
export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 150);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: registry } = useRegistry();
  const { data: allTasks, isFetching } = useAllTasksLite({ enabled: hasInteracted });

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const q = debouncedQuery.trim().toLowerCase();

  const matchedProjects = q
    ? (registry?.data.projects ?? []).filter((p) => p.toLowerCase().includes(q)).slice(0, MAX_PROJECT_RESULTS)
    : [];

  const matchedTasks = q
    ? (allTasks?.data.repos ?? [])
        .flatMap((r) => r.tasks.map((task) => ({ repo: r.name, task })))
        .filter(({ task }) => task.display_id.toLowerCase().includes(q) || task.title.toLowerCase().includes(q))
        .slice(0, MAX_TASK_RESULTS)
    : [];

  const hasResults = matchedProjects.length > 0 || matchedTasks.length > 0;

  function go(to: string) {
    navigate(to);
    setQuery("");
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setIsOpen(false);
      e.currentTarget.blur();
      return;
    }
    if (e.key === "Enter") {
      if (matchedProjects[0]) {
        go(`/p/${encodeURIComponent(matchedProjects[0])}`);
      } else if (matchedTasks[0]) {
        const { repo, task } = matchedTasks[0];
        go(`/t/${encodeURIComponent(repo)}/${encodeURIComponent(task.display_id)}`);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative w-72">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4" />
        <input
          type="search"
          value={query}
          onFocus={() => {
            setHasInteracted(true);
            setIsOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search project, task ID, or title…"
          className="w-full rounded-control border border-line bg-surface py-1.5 pl-8 pr-3 text-sm text-ink-1 placeholder:text-ink-4 focus:border-brand focus:outline-none"
        />
      </div>

      {isOpen && q && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-card border border-line bg-surface py-1 shadow-lift">
          {isFetching && !hasResults && <p className="px-3 py-2 text-sm text-ink-4">Searching…</p>}
          {!isFetching && !hasResults && <p className="px-3 py-2 text-sm text-ink-4">No matches.</p>}

          {matchedProjects.length > 0 && (
            <div>
              <p className="px-3 pb-1 pt-1.5 text-micro uppercase tracking-wide text-ink-4">Projects</p>
              {matchedProjects.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => go(`/p/${encodeURIComponent(p)}`)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-1 transition-colors hover:bg-surface-sunk"
                >
                  <FolderOpen size={13} className="shrink-0 text-ink-4" />
                  <span className="truncate">{p}</span>
                </button>
              ))}
            </div>
          )}

          {matchedTasks.length > 0 && (
            <div>
              <p className="px-3 pb-1 pt-1.5 text-micro uppercase tracking-wide text-ink-4">Tasks</p>
              {matchedTasks.map(({ repo, task }) => (
                <button
                  key={`${repo}-${task.id}`}
                  type="button"
                  onClick={() => go(`/t/${encodeURIComponent(repo)}/${encodeURIComponent(task.display_id)}`)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-sunk"
                >
                  <span className="shrink-0 font-mono text-micro text-ink-4">{task.display_id}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-1">{task.title || "(untitled)"}</span>
                  <span className="shrink-0 truncate text-micro text-ink-4">{repo}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
