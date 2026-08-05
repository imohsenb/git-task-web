import { useState } from "react";
import { Star, Pencil, Trash2, Check, X } from "lucide-react";
import { useRegistry } from "../../lib/queries";
import { useCreateProject, useDeleteProject, useRenameProject, useSetDefaultProject } from "../../lib/mutations";

/** Project CRUD, surfacing the CLI's own constraints rather than reimplementing them
 * (PLAN.md §6 Phase 5): can't delete the default project, can't delete one that still
 * has repos — both disabled here with a reason, and still fall through to the real
 * error toast if a race lets the button through anyway. */
export function ProjectsSection() {
  const { data: registry } = useRegistry();
  const createProject = useCreateProject();
  const setDefault = useSetDefaultProject();
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);

  const projects = registry?.data.projects ?? [];
  const defaultProject = registry?.data.default_project;
  const repoCounts = new Map<string, number>();
  for (const repo of registry?.data.repos ?? []) {
    repoCounts.set(repo.project, (repoCounts.get(repo.project) ?? 0) + 1);
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    createProject.mutate(name, { onSuccess: () => setNewName("") });
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-4">Projects</h2>
      <p className="mt-1 text-sm text-ink-3">Groups of repos. A repo joins one when it's registered or moved.</p>

      <div className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {projects.map((project) =>
          renaming === project ? (
            <RenameRow key={project} project={project} onDone={() => setRenaming(null)} />
          ) : (
            <ProjectRow
              key={project}
              project={project}
              isDefault={project === defaultProject}
              repoCount={repoCounts.get(project) ?? 0}
              onRename={() => setRenaming(project)}
              onSetDefault={() => setDefault.mutate(project)}
            />
          ),
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New project name"
          className="w-56 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink-1 focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!newName.trim() || createProject.isPending}
          className="rounded-control bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </section>
  );
}

function ProjectRow({
  project,
  isDefault,
  repoCount,
  onRename,
  onSetDefault,
}: {
  project: string;
  isDefault: boolean;
  repoCount: number;
  onRename: () => void;
  onSetDefault: () => void;
}) {
  const deleteProject = useDeleteProject();
  const deleteBlockedReason = isDefault
    ? "the default project can't be deleted — set a different default first"
    : repoCount > 0
      ? `still has ${repoCount} repo${repoCount === 1 ? "" : "s"} registered — move or unregister them first`
      : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <button
        type="button"
        onClick={onSetDefault}
        disabled={isDefault}
        title={isDefault ? "Default project" : "Set as default"}
        className={isDefault ? "text-warn-ink" : "text-ink-4 hover:text-ink-1"}
      >
        <Star size={14} fill={isDefault ? "currentColor" : "none"} />
      </button>
      <span className="flex-1 text-sm text-ink-1">{project}</span>
      <span className="text-micro text-ink-4">
        {repoCount} repo{repoCount === 1 ? "" : "s"}
      </span>
      <button type="button" onClick={onRename} className="text-ink-4 hover:text-ink-1" aria-label={`Rename ${project}`}>
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={() => deleteProject.mutate(project)}
        disabled={!!deleteBlockedReason || deleteProject.isPending}
        title={deleteBlockedReason ?? "Delete project"}
        className="text-ink-4 hover:text-danger-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-4"
        aria-label={`Delete ${project}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function RenameRow({ project, onDone }: { project: string; onDone: () => void }) {
  const renameProject = useRenameProject(project);
  const [value, setValue] = useState(project);

  function commit() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === project) {
      onDone();
      return;
    }
    renameProject.mutate(trimmed, { onSuccess: onDone, onError: onDone });
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onDone();
        }}
        className="flex-1 rounded-control border border-line bg-surface px-2 py-1 text-sm text-ink-1 focus:border-brand focus:outline-none"
      />
      <button type="button" onClick={commit} className="text-ink-4 hover:text-success-ink" aria-label="Save">
        <Check size={14} />
      </button>
      <button type="button" onClick={onDone} className="text-ink-4 hover:text-ink-1" aria-label="Cancel">
        <X size={14} />
      </button>
    </div>
  );
}
