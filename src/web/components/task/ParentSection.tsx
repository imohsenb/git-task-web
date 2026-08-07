import { useState } from "react";
import type { TaskJson } from "../../../shared/contract";
import { Combobox } from "../ui/Combobox";
import { repoLabel } from "./LinksSection";
import { useClearParent, useSetParent } from "../../lib/mutations";
import { useRegistry, useRepoTasks } from "../../lib/queries";

const THIS_REPO = "";

export function ParentSection({ repo, task }: { repo: string; task: TaskJson }) {
  const setParent = useSetParent(repo, task.display_id);
  const clearParent = useClearParent(repo, task.display_id);
  const { data: registry } = useRegistry();
  const [isPicking, setIsPicking] = useState(false);
  const [epicRepo, setEpicRepo] = useState(THIS_REPO);
  const [epicId, setEpicId] = useState("");

  const effectiveRepo = epicRepo || repo;
  const { data: epicsData } = useRepoTasks(effectiveRepo, { kind: "epic" });
  const epics = (epicsData?.data.repos[0]?.tasks ?? []).filter((e) => e.id !== task.id);

  const registryRepos = registry?.data.repos ?? [];
  const repoOptions = [
    { value: THIS_REPO, label: "This repo" },
    ...registryRepos.filter((r) => r.name !== repo).map((r) => ({ value: r.name, label: r.name })),
  ];

  function submit() {
    if (!epicId) return;
    setParent.mutate(
      { epicId, epicRepo: epicRepo || undefined },
      { onSuccess: () => setIsPicking(false) },
    );
  }

  if (task.parent_display_id) {
    return (
      <div>
        <dt className="text-micro uppercase text-ink-4">Epic</dt>
        <dd className="mt-1 flex items-center gap-2 font-mono text-sm text-ink-2">
          {task.parent_display_id}
          {task.parent_repo && (
            <span className="rounded-pill bg-neutral-tint px-1.5 py-0.5 font-sans text-micro text-neutral-ink">
              {repoLabel(task.parent_repo, registryRepos)}
            </span>
          )}
          <button
            type="button"
            onClick={() => clearParent.mutate()}
            disabled={clearParent.isPending}
            className="font-sans text-micro text-ink-4 hover:text-danger-ink"
          >
            Remove
          </button>
        </dd>
      </div>
    );
  }

  return (
    <div>
      <dt className="text-micro uppercase text-ink-4">Epic</dt>
      <dd className="mt-1 text-sm">
        {isPicking ? (
          <div className="flex flex-wrap items-center gap-2">
            <Combobox
              className="w-40"
              value={epicRepo}
              onChange={(next) => {
                setEpicRepo(next);
                setEpicId("");
              }}
              placeholder="Repo…"
              options={repoOptions}
            />
            <Combobox
              className="min-w-[14rem] flex-1"
              value={epicId}
              onChange={setEpicId}
              placeholder="Pick an epic…"
              options={epics.map((epic) => ({
                value: epic.display_id,
                label: `${epic.display_id} · ${epic.title || "(untitled)"}`,
              }))}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!epicId || setParent.isPending}
              className="rounded-control bg-brand px-2.5 py-1 text-micro font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              Set
            </button>
            <button type="button" onClick={() => setIsPicking(false)} className="text-micro text-ink-3 hover:text-ink-1">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setIsPicking(true)} className="text-micro text-ink-4 hover:text-ink-1">
            + Set parent epic
          </button>
        )}
      </dd>
    </div>
  );
}
