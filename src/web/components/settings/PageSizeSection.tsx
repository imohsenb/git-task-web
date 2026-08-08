import { useEffect, useState, type KeyboardEvent } from "react";
import { usePageSize } from "../../lib/pageSize";

export function PageSizeSection() {
  const [pageSize, setPageSize] = usePageSize();
  const [draft, setDraft] = useState(String(pageSize));

  useEffect(() => setDraft(String(pageSize)), [pageSize]);

  function commit() {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed > 0) setPageSize(parsed);
    else setDraft(String(pageSize));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-4">Tasks per page</h2>
      <p className="mt-1 text-sm text-ink-3">
        How many tasks a board column shows before "Show more", and how many the list view reveals per "Load more".
        Applies across all repos.
      </p>

      <input
        type="number"
        min={1}
        max={200}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="mt-3 w-24 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink-1"
      />
    </section>
  );
}
