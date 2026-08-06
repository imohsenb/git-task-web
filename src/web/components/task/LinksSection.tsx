import { useState } from "react";
import type { LinkKind, TaskJson } from "../../../shared/contract";
import { Pill } from "../ui/Pill";
import { Combobox } from "../ui/Combobox";
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
    <div>
      <h3 className="mb-2 text-micro uppercase text-ink-4">Links</h3>

      {task.links.length > 0 && (
        <ul className="mb-2 space-y-1 text-sm">
          {task.links.map((link) => (
            <li
              key={`${link.kind}-${link.target_repo ?? ""}-${link.target_display_id}`}
              className="flex items-center gap-2 text-ink-2"
            >
              <Pill sem="neutral">{link.kind}</Pill>
              <span className="font-mono text-ink-3">{link.target_display_id}</span>
              {link.target_repo && (
                <span className="rounded-pill bg-neutral-tint px-1.5 py-0.5 text-micro text-neutral-ink">
                  {repoLabel(link.target_repo, registryRepos)}
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  removeLink.mutate({ kind: link.kind, target: link.target_display_id, targetRepo: link.target_repo ?? undefined })
                }
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
      ) : (
        <button type="button" onClick={() => setIsAdding(true)} className="text-micro text-ink-4 hover:text-ink-1">
          + Add link
        </button>
      )}
    </div>
  );
}
