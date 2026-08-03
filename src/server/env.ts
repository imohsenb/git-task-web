import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

export interface ResolvedEnv {
  /** Absolute path to the git-task binary, or null if it could not be found. */
  bin: string | null;
  /** Directory for this app's own state: registry when not overridden, ui.json, identity.json. */
  dataDir: string;
  /** Passed as GIT_TASK_CONFIG_DIR to every spawn — mirrors git-task's own default resolution. */
  configDir: string;
  host: string;
  port: number;
}

const BIN_NAMES = ["git-task", "gtask"] as const;

function candidateNames(name: string): string[] {
  return process.platform === "win32" ? [`${name}.exe`, name] : [name];
}

function findOnPath(name: string): string | null {
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    for (const candidate of candidateNames(name)) {
      const full = join(dir, candidate);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

/** GIT_TASK_BIN -> `which git-task` -> `which gtask` -> ~/.cargo/bin/{git-task,gtask}. */
export function resolveBin(): string | null {
  if (process.env.GIT_TASK_BIN) return process.env.GIT_TASK_BIN;

  for (const name of BIN_NAMES) {
    const found = findOnPath(name);
    if (found) return found;
  }

  const cargoBin = join(homedir(), ".cargo", "bin");
  for (const name of BIN_NAMES) {
    for (const candidate of candidateNames(name)) {
      const full = join(cargoBin, candidate);
      if (existsSync(full)) return full;
    }
  }

  return null;
}

export function resolveDataDir(): string {
  if (process.env.GIT_TASK_WEB_DATA_DIR) return process.env.GIT_TASK_WEB_DATA_DIR;
  return join(homedir(), ".local", "share", "git-task-web");
}

/**
 * Mirrors git-task's own resolution (git-task/src/config/global.rs:192) exactly, so
 * setting this explicitly on every spawn is defence-in-depth, not a behavior change:
 * GIT_TASK_CONFIG_DIR > XDG_CONFIG_HOME/git-task > ~/.config/git-task.
 */
export function resolveConfigDir(): string {
  if (process.env.GIT_TASK_CONFIG_DIR) return process.env.GIT_TASK_CONFIG_DIR;
  if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, "git-task");
  return join(homedir(), ".config", "git-task");
}

export function resolveEnv(): ResolvedEnv {
  return {
    bin: resolveBin(),
    dataDir: resolveDataDir(),
    configDir: resolveConfigDir(),
    host: process.env.GIT_TASK_WEB_HOST ?? "127.0.0.1",
    port: Number(process.env.GIT_TASK_WEB_PORT ?? 4600),
  };
}
