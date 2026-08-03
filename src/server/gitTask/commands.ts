import { runGitTask, type GitTaskResult, type RunGitTaskOptions } from "./executor.js";
import { lsJsonSchema, registryJsonSchema, taskJsonSchema, whoamiJsonSchema } from "../../shared/contract.zod.js";
import type { LsJson, RegistryJson, TaskJson, WhoamiJson } from "../../shared/contract.js";

/**
 * The only argv builder. Every command below assembles its own argv and calls
 * runGitTask — no other file constructs a git-task argv or calls execa. Each returns
 * the full GitTaskResult (data + warnings), not just data — ground truth #9 (ls warns
 * and skips unopenable repos, still exits 0) depends on warnings reaching the HTTP
 * response; dropping them here would silently break the WarningStrip (§3.1).
 */
export interface GitTaskContext {
  bin: string;
  cwd: string;
  configDir: string;
  timeoutMs?: number;
  /** Test/deploy-only env overrides — see RunGitTaskOptions.env. */
  env?: NodeJS.ProcessEnv;
}

export function whoami(ctx: GitTaskContext): Promise<GitTaskResult<WhoamiJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["whoami"], commandLabel: "whoami" };
  return runGitTask(whoamiJsonSchema, opts);
}

export interface LsFilters {
  status?: string;
  assignee?: string;
  label?: string;
  kind?: string;
  parent?: string;
  mine?: boolean;
  deleted?: boolean;
  withHistory?: boolean;
}

/**
 * `=` form throughout, not `--flag value` — clap treats a value starting with '-' as
 * another flag in the space form ("--status -weird" -> "unexpected argument '-w'"),
 * silently breaking (not injecting) on adversarial filter values. `=` sidesteps it.
 */
function lsFilterArgs(filters: LsFilters = {}): string[] {
  const args: string[] = [];
  if (filters.status !== undefined) args.push(`--status=${filters.status}`);
  if (filters.assignee !== undefined) args.push(`--assignee=${filters.assignee}`);
  if (filters.label !== undefined) args.push(`--label=${filters.label}`);
  if (filters.kind !== undefined) args.push(`--kind=${filters.kind}`);
  if (filters.parent !== undefined) args.push(`--parent=${filters.parent}`);
  if (filters.mine) args.push("--mine");
  if (filters.deleted) args.push("--deleted");
  if (filters.withHistory) args.push("--with-history");
  return args;
}

export function lsHere(ctx: GitTaskContext, filters?: LsFilters): Promise<GitTaskResult<LsJson>> {
  const opts: RunGitTaskOptions = {
    ...ctx,
    args: ["ls", "--here", ...lsFilterArgs(filters)],
    commandLabel: "ls",
  };
  return runGitTask(lsJsonSchema, opts);
}

export function lsAll(ctx: GitTaskContext, filters?: LsFilters): Promise<GitTaskResult<LsJson>> {
  const opts: RunGitTaskOptions = {
    ...ctx,
    args: ["ls", "--all", ...lsFilterArgs(filters)],
    commandLabel: "ls",
  };
  return runGitTask(lsJsonSchema, opts);
}

export function lsProject(ctx: GitTaskContext, project: string, filters?: LsFilters): Promise<GitTaskResult<LsJson>> {
  const opts: RunGitTaskOptions = {
    ...ctx,
    args: ["ls", `--project=${project}`, ...lsFilterArgs(filters)],
    commandLabel: "ls",
  };
  return runGitTask(lsJsonSchema, opts);
}

export function reposDeep(ctx: GitTaskContext): Promise<GitTaskResult<RegistryJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["repos", "--deep"], commandLabel: "repos" };
  return runGitTask(registryJsonSchema, opts);
}

export function show(ctx: GitTaskContext, id: string): Promise<GitTaskResult<TaskJson>> {
  // `--` before the id: a task id/display_id is normally alnum-hyphen, but it's still
  // client-controlled input reaching argv, so it gets the same defensive treatment as
  // any other free-text positional (see docs/cli-json-contract.md argv rules).
  const opts: RunGitTaskOptions = { ...ctx, args: ["show", "--", id], commandLabel: "show" };
  return runGitTask(taskJsonSchema, opts);
}
