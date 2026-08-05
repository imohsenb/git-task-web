import { runGitTask, type GitTaskResult, type RunGitTaskOptions } from "./executor.js";
import {
  cloneJsonSchema,
  dropJsonSchema,
  lsJsonSchema,
  mutationJsonSchema,
  registryJsonSchema,
  registryMutationJsonSchema,
  repoConfigJsonSchema,
  taskJsonSchema,
  whoamiJsonSchema,
} from "../../shared/contract.zod.js";
import type {
  CloneJson,
  DropJson,
  LinkKind,
  LsJson,
  MutationJson,
  Priority,
  RegistryJson,
  RegistryMutationJson,
  RepoConfigJson,
  TaskJson,
  TaskKind,
  WhoamiJson,
} from "../../shared/contract.js";

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
  fixedVersion?: string;
  affectedVersion?: string;
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
  if (filters.fixedVersion !== undefined) args.push(`--fixed-version=${filters.fixedVersion}`);
  if (filters.affectedVersion !== undefined) args.push(`--affected-version=${filters.affectedVersion}`);
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

export function fields(ctx: GitTaskContext): Promise<GitTaskResult<RepoConfigJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["fields"], commandLabel: "fields" };
  return runGitTask(repoConfigJsonSchema, opts);
}

/*
 * --- Mutations ---
 *
 * Argv rules below were verified live against the real binary, not assumed from
 * PLAN.md's prose (which describes a `config show` subcommand that does not exist —
 * the real CLI has `fields`/`key`/`automation` instead):
 *  - Every free-text *flag* value uses `--flag=value` (one token, immune to a leading
 *    '-' being misread as another flag — same fix as lsFilterArgs).
 *  - Every free-text *positional* (new's title, comment's text, label's value, a link's
 *    target id) sits after a `--` separator, with all flags before it.
 *  - `label`/`epic`/`link` are nested subcommands (`label <ID> add <LABEL>`) — putting
 *    `--` before the ID swallows the `add`/`rm` token as a positional and breaks
 *    dispatch ("unexpected argument 'add'"), so `--` there goes only immediately before
 *    the final free-text value, never before the ID/subcommand pair.
 */

export interface NewTaskInput {
  title: string;
  kind: TaskKind;
  description: string;
  assignee?: string;
  labels?: string[];
  fixedVersions?: string[];
  affectedVersions?: string[];
  priority?: Priority;
  due?: string;
  milestone?: string;
  parent?: string;
  status?: string;
}

export function newTask(ctx: GitTaskContext, input: NewTaskInput): Promise<GitTaskResult<MutationJson>> {
  const args: string[] = ["new", `--kind=${input.kind}`, `--desc=${input.description}`];
  if (input.assignee !== undefined) args.push(`--assignee=${input.assignee}`);
  for (const label of input.labels ?? []) args.push(`--label=${label}`);
  for (const version of input.fixedVersions ?? []) args.push(`--fixed-version=${version}`);
  for (const version of input.affectedVersions ?? []) args.push(`--affected-version=${version}`);
  if (input.priority !== undefined) args.push(`--priority=${input.priority}`);
  if (input.due !== undefined) args.push(`--due=${input.due}`);
  if (input.milestone !== undefined) args.push(`--milestone=${input.milestone}`);
  if (input.parent !== undefined) args.push(`--parent=${input.parent}`);
  if (input.status !== undefined) args.push(`--status=${input.status}`);
  args.push("--", input.title);
  const opts: RunGitTaskOptions = { ...ctx, args, commandLabel: "new" };
  return runGitTask(mutationJsonSchema, opts);
}

export interface EditTaskInput {
  title?: string;
  description?: string;
  kind?: TaskKind;
  /** `undefined` = leave alone, `null` = clear (--clear-*), a value = set. */
  priority?: Priority | null;
  assignee?: string | null;
  due?: string | null;
  milestone?: string | null;
}

/**
 * §3.5: "edit sends only genuinely changed fields — an unchanged --title writes a
 * redundant SetTitle op into permanent history. An empty diff never spawns." Diffs
 * against a fresh `show` rather than trusting the caller, since a form typically
 * submits its whole state, not just the fields the user actually touched. Returns
 * `null` (no spawn) when nothing actually changed.
 */
export async function editTask(
  ctx: GitTaskContext,
  id: string,
  input: EditTaskInput,
): Promise<GitTaskResult<MutationJson> | null> {
  const current = (await show(ctx, id)).data;
  const args: string[] = ["edit"];

  if (input.title !== undefined && input.title !== current.title) args.push(`--title=${input.title}`);
  if (input.description !== undefined && input.description !== current.description) {
    args.push(`--desc=${input.description}`);
  }
  if (input.kind !== undefined && input.kind !== current.kind) args.push(`--kind=${input.kind}`);

  if (input.priority === null) {
    if (current.priority !== null) args.push("--clear-priority");
  } else if (input.priority !== undefined && input.priority !== current.priority) {
    args.push(`--priority=${input.priority}`);
  }

  if (input.assignee === null) {
    if (current.assignee !== null) args.push("--clear-assignee");
  } else if (input.assignee !== undefined && input.assignee !== current.assignee) {
    args.push(`--assignee=${input.assignee}`);
  }

  if (input.due === null) {
    if (current.due !== null) args.push("--clear-due");
  } else if (input.due !== undefined && input.due !== current.due) {
    args.push(`--due=${input.due}`);
  }

  if (input.milestone === null) {
    if (current.milestone !== null) args.push("--clear-milestone");
  } else if (input.milestone !== undefined && input.milestone !== current.milestone) {
    args.push(`--milestone=${input.milestone}`);
  }

  if (args.length === 1) return null;

  args.push("--", id);
  const opts: RunGitTaskOptions = { ...ctx, args, commandLabel: "edit" };
  return runGitTask(mutationJsonSchema, opts);
}

export function setStatus(ctx: GitTaskContext, id: string, status: string): Promise<GitTaskResult<MutationJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["status", "--", id, status], commandLabel: "status" };
  return runGitTask(mutationJsonSchema, opts);
}

export function addComment(ctx: GitTaskContext, id: string, text: string): Promise<GitTaskResult<MutationJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["comment", "--", id, text], commandLabel: "comment" };
  return runGitTask(mutationJsonSchema, opts);
}

export function editComment(
  ctx: GitTaskContext,
  id: string,
  commentNumber: number,
  text: string,
): Promise<GitTaskResult<MutationJson>> {
  const opts: RunGitTaskOptions = {
    ...ctx,
    args: ["comment", `--edit=${commentNumber}`, "--", id, text],
    commandLabel: "comment",
  };
  return runGitTask(mutationJsonSchema, opts);
}

export function addLabel(ctx: GitTaskContext, id: string, label: string): Promise<GitTaskResult<MutationJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["label", id, "add", "--", label], commandLabel: "label" };
  return runGitTask(mutationJsonSchema, opts);
}

export function removeLabel(ctx: GitTaskContext, id: string, label: string): Promise<GitTaskResult<MutationJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["label", id, "rm", "--", label], commandLabel: "label" };
  return runGitTask(mutationJsonSchema, opts);
}

export function setParent(ctx: GitTaskContext, epicId: string, childId: string): Promise<GitTaskResult<MutationJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["epic", epicId, "add", "--", childId], commandLabel: "epic" };
  return runGitTask(mutationJsonSchema, opts);
}

export function clearParent(ctx: GitTaskContext, epicId: string, childId: string): Promise<GitTaskResult<MutationJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["epic", epicId, "rm", "--", childId], commandLabel: "epic" };
  return runGitTask(mutationJsonSchema, opts);
}

/**
 * `epic rm` needs the epic id as an argument, but "remove this task's parent" only
 * has the child id to go on — so this looks the current parent up first (same
 * fetch-then-maybe-spawn shape as editTask) and is a no-op (`null`, no spawn) when
 * the task has no parent to clear.
 */
export async function clearParentIfSet(ctx: GitTaskContext, id: string): Promise<GitTaskResult<MutationJson> | null> {
  const current = (await show(ctx, id)).data;
  if (current.parent === null) return null;
  return clearParent(ctx, current.parent, id);
}

/**
 * `--repo` (a registered repo name, local path, or remote URL — resolved by git-task
 * itself against this same GIT_TASK_CONFIG_DIR) makes the link cross-repo. It's a flag
 * scoped to `link <id> add`, so like every other flag it must land before the `--`
 * that guards the free-text target.
 */
export function addLink(
  ctx: GitTaskContext,
  id: string,
  kind: LinkKind,
  target: string,
  targetRepo?: string,
): Promise<GitTaskResult<MutationJson>> {
  const args = ["link", id, "add", kind];
  if (targetRepo !== undefined) args.push(`--repo=${targetRepo}`);
  args.push("--", target);
  const opts: RunGitTaskOptions = { ...ctx, args, commandLabel: "link" };
  return runGitTask(mutationJsonSchema, opts);
}

export function removeLink(
  ctx: GitTaskContext,
  id: string,
  kind: LinkKind,
  target: string,
  targetRepo?: string,
): Promise<GitTaskResult<MutationJson>> {
  const args = ["link", id, "rm", kind];
  if (targetRepo !== undefined) args.push(`--repo=${targetRepo}`);
  args.push("--", target);
  const opts: RunGitTaskOptions = { ...ctx, args, commandLabel: "link" };
  return runGitTask(mutationJsonSchema, opts);
}

export function deleteTask(ctx: GitTaskContext, id: string): Promise<GitTaskResult<MutationJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["delete", "--", id], commandLabel: "delete" };
  return runGitTask(mutationJsonSchema, opts);
}

export function dropTask(ctx: GitTaskContext, id: string, remote?: string): Promise<GitTaskResult<DropJson>> {
  const args = ["drop", "--force"];
  if (remote !== undefined) args.push(`--remote=${remote}`);
  args.push("--", id);
  const opts: RunGitTaskOptions = { ...ctx, args, commandLabel: "drop" };
  return runGitTask(dropJsonSchema, opts);
}

/*
 * --- Repos & projects ---
 *
 * `register`/`project *` resolve entirely from `ctx.cwd` (register) or `ctx.configDir`
 * (project) — never from a name-to-path lookup the caller supplies, so these read no
 * differently, argv-safety-wise, than the mutations above. Verified live against the
 * real binary, including the executor's actual `[subcommand, --format, json, ...rest]`
 * insertion point: for a nested command the "subcommand" token is the *first* word
 * (`project`, not `create`), so `--format json` lands between `project` and `create`,
 * not after `--`.
 */

export function registerRepo(
  ctx: GitTaskContext,
  name?: string,
  project?: string,
): Promise<GitTaskResult<RegistryMutationJson>> {
  const args = ["register"];
  if (project !== undefined) args.push(`--project=${project}`);
  if (name !== undefined) args.push("--", name);
  const opts: RunGitTaskOptions = { ...ctx, args, commandLabel: "register" };
  return runGitTask(registryMutationJsonSchema, opts);
}

export function unregisterRepo(ctx: GitTaskContext, name: string): Promise<GitTaskResult<RegistryMutationJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["unregister", "--", name], commandLabel: "unregister" };
  return runGitTask(registryMutationJsonSchema, opts);
}

export function projectCreate(ctx: GitTaskContext, name: string): Promise<GitTaskResult<RegistryMutationJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["project", "create", "--", name], commandLabel: "project" };
  return runGitTask(registryMutationJsonSchema, opts);
}

export function projectSetDefault(ctx: GitTaskContext, name: string): Promise<GitTaskResult<RegistryMutationJson>> {
  const opts: RunGitTaskOptions = {
    ...ctx,
    args: ["project", "set-default", "--", name],
    commandLabel: "project",
  };
  return runGitTask(registryMutationJsonSchema, opts);
}

export function projectRename(
  ctx: GitTaskContext,
  oldName: string,
  newName: string,
): Promise<GitTaskResult<RegistryMutationJson>> {
  const opts: RunGitTaskOptions = {
    ...ctx,
    args: ["project", "rename", "--", oldName, newName],
    commandLabel: "project",
  };
  return runGitTask(registryMutationJsonSchema, opts);
}

export function projectDelete(ctx: GitTaskContext, name: string): Promise<GitTaskResult<RegistryMutationJson>> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["project", "delete", "--", name], commandLabel: "project" };
  return runGitTask(registryMutationJsonSchema, opts);
}

/**
 * `dir` is where clone puts checkout — a filesystem path/name, not a git ref or flag
 * value, so it goes after `--` alongside `url` rather than as a `--flag=value` (a
 * leading '-' in a directory name is a legitimate, if unusual, request here).
 */
export function cloneRepo(ctx: GitTaskContext, url: string, dir?: string): Promise<GitTaskResult<CloneJson>> {
  const args = ["clone", "--", url];
  if (dir !== undefined) args.push(dir);
  const opts: RunGitTaskOptions = { ...ctx, args, commandLabel: "clone" };
  return runGitTask(cloneJsonSchema, opts);
}
