import { useState } from "react";
import { Link } from "react-router-dom";
import { Link2, Plus } from "lucide-react";
import type { LinkKind, TaskJson } from "../../../shared/contract";
import { Pill } from "../ui/Pill";
import { Combobox } from "../ui/Combobox";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { useAddLink, useRemoveLink } from "../../lib/mutations";
import { useRegistry, useRepoTasks } from "../../lib/queries";

const LINK_KINDS: LinkKind[] = ["blocks", "relates", "dup"];
const THIS_REPO = "";

/** `link.target_repo`/`task.parent_repo` (from the CLI) is a registered repo's origin
 * remote URL when it has one, else an absolute path — registry entries are the source
 * of truth for turning either form back into the name the rest of the UI uses. Falls
 * back to the identifier's basename so an unregistered/moved repo still renders
 * something sane instead of a raw URL/path. */
export function repoLabel(
  identifier: string,
  registryRepos: { name: string; path: string; remotes?: { url: string | null }[] | null }[],
): string {
  const match = registryRepos.find(
    (r) => r.path === identifier || r.remotes?.some((remote) => remote.url === identifier),
  );
  return match?.name ?? identifier.split("/").filter(Boolean).pop() ?? identifier;
}

export function LinksSection({ repo, task }: { repo: string; task: TaskJson }) {
  const addLink = useAddLink(repo, task.display_id);
  const removeLink = useRemoveLink(repo, task.display_id);
  const { data: registry } = useRegistry();
  const [kind, setKind] = useState<LinkKind>("blocks");
  const [targetRepo, setTargetRepo] = useState(THIS_REPO);
  const [target, setTarget] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const effectiveRepo = targetRepo || repo;
  const { data: targetRepoTasks } = useRepoTasks(effectiveRepo);
  const candidates = (targetRepoTasks?.data.repos[0]?.tasks ?? []).filter((t) => t.id !== task.id);

  const registryRepos = registry?.data.repos ?? [];
  const repoOptions = [
    { value: THIS_REPO, label: "This repo" },
    ...registryRepos.filter((r) => r.name !== repo).map((r) => ({ value: r.name, label: r.name })),
  ];

  function submit() {
    if (!target) return;
    addLink.mutate(
      { kind, target, targetRepo: targetRepo || undefined },
      { onSuccess: () => setIsAdding(false) },
    );
  }

  return (
    <CollapsibleSection
      title="Links"
      actions={
        !isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            title="Add link"
            className="text-ink-4 hover:text-ink-1"
          >
            <Plus size={14} />
          </button>
        )
      }
    >
      {task.links.length > 0 && (
        <ul className="mb-2 space-y-1.5 text-sm">
          {task.links.map((link) => {
            const linkedRepo = link.target_repo ? repoLabel(link.target_repo, registryRepos) : repo;
            return (
              <li
                key={`${link.kind}-${link.target_repo ?? ""}-${link.target_display_id}`}
                className="flex items-center justify-between gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5 transition-colors hover:bg-surface-sunk"
              >
                <Link
                  to={`/t/${encodeURIComponent(linkedRepo)}/${encodeURIComponent(link.target_display_id)}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <Link2 size={14} className="shrink-0 text-ink-3" />
                  <Pill sem="neutral">{link.kind}</Pill>
                  <span className="shrink-0 font-mono text-micro text-ink-3">{link.target_display_id}</span>
                  {link.target_repo && <Pill sem="neutral">{repoLabel(link.target_repo, registryRepos)}</Pill>}
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    removeLink.mutate({ kind: link.kind, target: link.target_display_id, targetRepo: link.target_repo ?? undefined })
                  }
                  disabled={removeLink.isPending}
                  className="shrink-0 text-ink-4 hover:text-danger-ink"
                  aria-label={`Remove link to ${link.target_display_id}`}
                >
                  ×
                </button>
              </li>
            );
          })}
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
          <Combobox
            className="w-40"
            value={targetRepo}
            onChange={(next) => {
              setTargetRepo(next);
              setTarget("");
            }}
            placeholder="Repo…"
            options={repoOptions}
          />
          <Combobox
            className="min-w-[14rem] flex-1"
            value={target}
            onChange={setTarget}
            placeholder="Search tasks…"
            options={candidates.map((t) => ({
              value: t.display_id,
              label: `${t.display_id} · ${t.title || "(untitled)"}`,
            }))}
          />
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
      ) : task.links.length === 0 ? (
        <p className="text-micro text-ink-4">No linked tasks found.</p>
      ) : null}
    </CollapsibleSection>
  );
}
