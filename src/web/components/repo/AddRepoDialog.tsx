import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../ui/Modal";
import { Combobox } from "../ui/Combobox";
import { useCloneRepo, useRegisterRepo } from "../../lib/mutations";
import { useRegistry } from "../../lib/queries";

type Mode = "register" | "clone";

/** Phase 5's two ways to get a repo into the registry (PLAN.md §6): "register a
 * path" for a dev repo already on this machine, "clone a URL" for a tasks-only
 * checkout pulled fresh from a remote. Both end the same way — a fresh registry
 * entry — so they share one dialog with a mode switch instead of two components. */
export function AddRepoDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { data: registry } = useRegistry();
  const registerRepo = useRegisterRepo();
  const cloneRepo = useCloneRepo();

  const [mode, setMode] = useState<Mode>("register");
  const [path, setPath] = useState("");
  const [url, setUrl] = useState("");
  const [dir, setDir] = useState("");
  const [name, setName] = useState("");
  const [project, setProject] = useState("");

  const projectOptions = (registry?.data.projects ?? []).map((p) => ({ value: p, label: p }));
  const mutation = mode === "register" ? registerRepo : cloneRepo;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "register") {
      if (!path.trim()) return;
      registerRepo.mutate(
        { path: path.trim(), name: name.trim() || undefined, project: project.trim() || undefined },
        { onSuccess: (result) => result && finish(result.data.name) },
      );
    } else {
      if (!url.trim()) return;
      cloneRepo.mutate(
        {
          url: url.trim(),
          dir: dir.trim() || undefined,
          name: name.trim() || undefined,
          project: project.trim() || undefined,
        },
        { onSuccess: (result) => result && finish(result.data.register.name) },
      );
    }
  }

  function finish(registeredName: string) {
    onClose();
    navigate(`/r/${encodeURIComponent(registeredName)}`);
  }

  return (
    <Modal title="Add a repo" onClose={onClose}>
      <div className="mb-4 flex gap-1 rounded-control bg-surface-sunk p-1">
        <ModeTab active={mode === "register"} onClick={() => setMode("register")}>
          Register a path
        </ModeTab>
        <ModeTab active={mode === "clone"} onClick={() => setMode("clone")}>
          Clone a URL
        </ModeTab>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" ? (
          <Field label="Repo path" hint="An absolute path to an existing git repo on this machine.">
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              autoFocus
              placeholder="/Users/me/code/my-project"
              className={inputClass}
            />
          </Field>
        ) : (
          <>
            <Field label="Remote URL" hint="Cloned into a fresh directory — no source checkout, tasks only.">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                placeholder="git@host:org/repo.git"
                className={inputClass}
              />
            </Field>
            <Field label="Directory name" hint="Optional — defaults to <repo>-tasks.">
              <input type="text" value={dir} onChange={(e) => setDir(e.target.value)} className={inputClass} />
            </Field>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Register as" hint="Optional — defaults to the directory name.">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Project" hint="Optional — type a new name to create one.">
            <Combobox
              allowCustom
              value={project}
              options={projectOptions}
              onChange={setProject}
              placeholder={registry?.data.default_project ?? "default"}
              className="[&_input]:py-1.5"
            />
          </Field>
        </div>

        {mutation.isError && <p className="text-sm text-danger-ink">{(mutation.error as Error).message}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-control px-4 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-sunk"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-control bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {mutation.isPending ? "Working…" : mode === "register" ? "Register" : "Clone"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-control px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-shell text-ink-1 shadow-lift" : "text-ink-3 hover:text-ink-1",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-micro uppercase tracking-wide text-ink-4">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-micro text-ink-4">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink-1 focus:border-brand focus:outline-none";
