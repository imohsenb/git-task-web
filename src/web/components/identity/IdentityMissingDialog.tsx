import type { ApiError } from "../../lib/api";
import { Modal } from "../ui/Modal";

function stringField(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function arrayField(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

/**
 * §3.2: "writes return 412 before spawning, with the repo path and the exact `git
 * config` command to run." The CLI's error context carries `path` + `missing` — this
 * turns that into copy-pasteable commands, since there's no identity editor here (an
 * editor would be the forgeable path §3.2 explicitly rules out).
 */
export function IdentityMissingDialog({ error, onClose }: { error: ApiError; onClose: () => void }) {
  const path = stringField(error.context?.path);
  const missing = arrayField(error.context?.missing);
  const commands = missing.map((field) => `git config ${field} "..."`);

  return (
    <Modal title="Git identity not set" onClose={onClose}>
      <p className="text-sm text-ink-2">
        {error.message} — git-task-web never supplies or overrides an identity; every write is attributed to
        whatever git itself resolves for the server process.
      </p>

      {commands.length > 0 && (
        <div className="mt-4 rounded-control bg-surface-sunk p-3">
          <p className="mb-2 text-micro uppercase tracking-wide text-ink-4">
            Run this{path ? ` in ${path}` : ""} (or add --global to set it everywhere):
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm text-ink-1">{commands.join("\n")}</pre>
        </div>
      )}

      <p className="mt-4 text-sm text-ink-3">Then retry the action that failed.</p>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-control bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          Got it
        </button>
      </div>
    </Modal>
  );
}
