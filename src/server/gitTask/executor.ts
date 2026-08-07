import { execa } from "execa";
import { existsSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { ZodType } from "zod";
import { cliResponseSchema } from "../../shared/contract.zod.js";
import type { CliResponse, CliWarning } from "../../shared/contract.js";
import { GitTaskError, parseStderrFallback } from "./errors.js";

/** Single choke point for spawning git-task. No other file may spawn a process. */

export const DEFAULT_TIMEOUT_MS = 15_000;
export const SYNC_TIMEOUT_MS = 120_000;

export interface RunGitTaskOptions {
  bin: string;
  /** Required — ground truth #1: every git-task command resolves its repo from cwd,
   * there is no --repo flag. Must be absolute and already exist. */
  cwd: string;
  configDir: string;
  /** argv after the binary: [subcommand, ...flags/positionals], not including --format
   * json — the executor inserts that. Must NOT be inserted after args[0] by the caller:
   * a `--` separator (needed before any positional that could start with '-') makes
   * every following token positional, so --format json has to land before it — the
   * executor owns that ordering, not callers. */
  args: string[];
  timeoutMs?: number;
  /** Used in error messages before we have a parsed `command` field to fall back on. */
  commandLabel?: string;
  /** Overrides for the inherited env vars (HOME/PATH/LANG/TZ) — identity tests and the
   * Docker boot bootstrap (GT_USER_NAME/GT_USER_EMAIL) are the intended uses. Cannot
   * override the hardcoded safety vars below (GIT_TASK_CONFIG_DIR etc). */
  env?: NodeJS.ProcessEnv;
}

export interface GitTaskResult<T> {
  data: T;
  warnings: CliWarning[];
  command: string;
  version: string;
}

export async function runGitTask<T>(dataSchema: ZodType<T>, opts: RunGitTaskOptions): Promise<GitTaskResult<T>> {
  const { bin, cwd, configDir, args, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  const commandLabel = opts.commandLabel ?? args[0] ?? "git-task";

  if (!isAbsolute(cwd)) {
    throw new GitTaskError({
      kind: "internal",
      message: `executor cwd must be absolute, got '${cwd}'`,
      command: commandLabel,
    });
  }
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
    throw new GitTaskError({
      kind: "internal",
      message: `executor cwd does not exist: '${cwd}'`,
      command: commandLabel,
    });
  }

  // Env is constructed, not inherited wholesale — ground truth #4/#5/#6/#7. HOME is the
  // exception: §3.2 requires it inherited so git resolves identity exactly like the
  // user's own terminal would (GIT_CONFIG_GLOBAL is inert; HOME is the real fallback).
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    LANG: process.env.LANG,
    TZ: process.env.TZ,
    HOME: process.env.HOME,
    ...opts.env,
    GIT_TASK_NO_HINTS: "1",
    NO_COLOR: "1",
    GIT_TASK_CONFIG_DIR: configDir,
    GIT_TERMINAL_PROMPT: "0",
  };
  if (env.SSH_AUTH_SOCK === undefined && process.env.SSH_AUTH_SOCK) {
    env.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;
  }

  // --format json must land immediately after the subcommand, before any `--`
  // separator a caller used ahead of a free-text positional — `--` makes clap treat
  // everything after it as positional, which would swallow a trailing --format json.
  const [subcommand, ...rest] = args;
  const fullArgs = [subcommand, "--format", "json", ...rest];

  let result;
  try {
    result = await execa(bin, fullArgs, {
      cwd,
      env,
      extendEnv: false, // env above is the *complete* child env — execa merges with process.env by default
      stdin: "ignore",
      timeout: timeoutMs,
      reject: false,
      stripFinalNewline: true,
    });
  } catch (err) {
    throw new GitTaskError({
      kind: "io",
      message: `failed to spawn git-task: ${err instanceof Error ? err.message : String(err)}`,
      command: commandLabel,
    });
  }

  if (result.timedOut) {
    throw new GitTaskError({
      kind: "timeout",
      message: `git-task ${commandLabel} timed out after ${timeoutMs}ms`,
      command: commandLabel,
    });
  }
  if (result.signal) {
    throw new GitTaskError({
      kind: "io",
      message: `git-task ${commandLabel} was killed by signal ${result.signal}`,
      command: commandLabel,
    });
  }

  return parseResponse(dataSchema, result.stdout, result.stderr, result.exitCode ?? 1, commandLabel);
}

const VERSION_TIMEOUT_MS = 5_000;
const VERSION_PATTERN = /git task (\S+)/;

/**
 * `--version` short-circuits clap before any subcommand handling, so it ignores
 * --format json and always prints plain text ("git task 1.0.0"). Handled separately
 * from runGitTask, but still funneled through this file — the sole spawn point.
 */
export async function getVersion(bin: string): Promise<string> {
  let result;
  try {
    result = await execa(bin, ["--version"], {
      stdin: "ignore",
      timeout: VERSION_TIMEOUT_MS,
      reject: false,
      stripFinalNewline: true,
    });
  } catch (err) {
    throw new GitTaskError({
      kind: "io",
      message: `failed to spawn git-task --version: ${err instanceof Error ? err.message : String(err)}`,
      command: "--version",
    });
  }

  if (result.timedOut) {
    throw new GitTaskError({ kind: "timeout", message: "git-task --version timed out", command: "--version" });
  }

  const match = result.stdout.match(VERSION_PATTERN);
  if (!match) {
    throw new GitTaskError({
      kind: "internal",
      message: `could not parse version from git-task --version output: '${result.stdout}'`,
      command: "--version",
    });
  }
  return match[1];
}

function parseResponse<T>(
  dataSchema: ZodType<T>,
  stdout: string,
  stderr: string,
  exitCode: number,
  commandLabel: string,
): GitTaskResult<T> {
  const envelopeSchema = cliResponseSchema(dataSchema);

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(stdout);
  } catch {
    rawJson = undefined;
  }

  if (rawJson !== undefined) {
    const envelopeResult = envelopeSchema.safeParse(rawJson);
    if (envelopeResult.success) {
      // zod's discriminatedUnion loses literal narrowing through a generic T; the shape
      // is exactly CliResponse<T> by construction (cliResponseSchema mirrors it 1:1).
      const parsed = envelopeResult.data as unknown as CliResponse<T>;
      if (parsed.ok) {
        return { data: parsed.data, warnings: parsed.warnings, command: parsed.command, version: parsed.version };
      }
      throw new GitTaskError({
        kind: parsed.error.kind,
        message: parsed.error.message,
        causes: parsed.error.causes,
        context: parsed.error.context,
        command: parsed.command,
      });
    }

    // Legacy: some commands (show/export) predate the envelope and emit bare data.
    if (exitCode === 0) {
      const bareResult = dataSchema.safeParse(rawJson);
      if (bareResult.success) {
        return { data: bareResult.data, warnings: [], command: commandLabel, version: "unknown" };
      }
    }
  }

  if (exitCode !== 0) {
    throw parseStderrFallback(stderr, commandLabel);
  }

  throw new GitTaskError({
    kind: "internal",
    message: `git-task produced output that doesn't match the expected shape for '${commandLabel}'`,
    command: commandLabel,
  });
}
