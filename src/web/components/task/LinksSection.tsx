import { useState } from "react";
import type { LinkKind, TaskJson } from "../../../shared/contract";
import { Pill } from "../ui/Pill";
import { useAddLink, useRemoveLink } from "../../lib/mutations";
import { useRepoTasks } from "../../lib/queries";

const LINK_KINDS: LinkKind[] = ["blocks", "relates", "dup"];

export function LinksSection({ repo, task }: { repo: string; task: TaskJson }) {
  const addLink = useAddLink(repo, task.display_id);
  const removeLink = useRemoveLink(repo, task.display_id);
  const { data: allTasks } = useRepoTasks(repo);
  const [kind, setKind] = useState<LinkKind>("blocks");
  const [target, setTarget] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const candidates = (allTasks?.data.repos[0]?.tasks ?? []).filter((t) => t.id !== task.id);

  function submit() {
    if (!target) return;
    addLink.mutate({ kind, target }, { onSuccess: () => setIsAdding(false) });
  }

  return (
    <div>
      <h3 className="mb-2 text-micro uppercase text-ink-4">Links</h3>

      {task.links.length > 0 && (
        <ul className="mb-2 space-y-1 text-sm">
          {task.links.map((link) => (
            <li key={`${link.kind}-${link.target}`} className="flex items-center gap-2 text-ink-2">
              <Pill sem="neutral">{link.kind}</Pill>
              <span className="font-mono text-ink-3">{link.target_display_id}</span>
              <button
                type="button"
                onClick={() => removeLink.mutate({ kind: link.kind, target: link.target_display_id })}
                disabled={removeLink.isPending}
                className="ml-auto text-ink-4 hover:text-danger-ink"
                aria-label={`Remove link to ${link.target_display_id}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as LinkKind)}
            className="rounded-control border border-line bg-surface px-2 py-1 text-micro text-ink-1"
          >
            {LINK_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="min-w-[10rem] flex-1 rounded-control border border-line bg-surface px-2 py-1 text-micro text-ink-1"
          >
            <option value="">Pick a task…</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.display_id}>
                {t.display_id} · {t.title || "(untitled)"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={!target || addLink.isPending}
            className="rounded-control bg-brand px-2.5 py-1 text-micro font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            Add
          </button>
          <button type="button" onClick={() => setIsAdding(false)} className="text-micro text-ink-3 hover:text-ink-1">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setIsAdding(true)} className="text-micro text-ink-4 hover:text-ink-1">
          + Add link
        </button>
      )}
    </div>
  );
}
