import type { ResolvedEnv } from "../env.js";
import { GitTaskError } from "./errors.js";
import type { GitTaskContext } from "./commands.js";

export function requireBin(env: ResolvedEnv): string {
  if (!env.bin) {
    throw new GitTaskError({
      kind: "internal",
      message: "git-task binary not found on PATH — install it or set GIT_TASK_BIN",
    });
  }
  return env.bin;
}

/** cwd = dataDir — for registry-wide commands (repos, ls --all/--project). */
export function dataDirContext(env: ResolvedEnv): GitTaskContext {
  return { bin: requireBin(env), cwd: env.dataDir, configDir: env.configDir };
}

/** cwd = a specific repo's path — for per-repo commands (ls --here, show, ...). */
export function repoContext(env: ResolvedEnv, repoPath: string): GitTaskContext {
  return { bin: requireBin(env), cwd: repoPath, configDir: env.configDir };
}
