/**
 * TypeScript types for the git-task CLI JSON contract.
 * Mirrors docs/cli-json-contract.md exactly — keep both in sync.
 */

export type CliResponse<T> = CliOk<T> | CliErr;
export interface CliOk<T> {
  ok: true;
  command: string;
  version: string;
  data: T;
  warnings: CliWarning[];
}
export interface CliErr {
  ok: false;
  command: string;
  version: string;
  error: CliError;
  warnings: CliWarning[];
}

export interface CliError {
  kind: CliErrorKind;
  message: string;
  causes: string[];
  context?: Record<string, string | string[]>;
}

export type CliErrorKind =
  | "not_a_repo"
  | "identity_missing"
  | "not_found"
  | "ambiguous_id"
  | "validation"
  | "conflict"
  | "rejected"
  | "remote"
  | "io"
  | "internal";

export interface CliWarning {
  message: string;
  detail?: string;
  scope?: string;
}

export type TaskKind = "bug" | "story" | "task" | "epic" | "subtask";
export type Priority = "low" | "medium" | "high";
export type LinkKind = "blocks" | "relates" | "dup";

export interface CommentJson {
  id: number;
  author: string;
  author_name: string;
  timestamp: number;
  text: string;
  edited: boolean;
}

export interface LinkJson {
  kind: LinkKind;
  /** null for a cross-repo link — the target task isn't a local git object, only
   * addressable via target_repo + target_display_id. */
  target: string | null;
  target_display_id: string;
  /** Absolute path of the target repo, or null for a same-repo link. */
  target_repo: string | null;
}

export interface OpEnvelopeJson {
  author: { name: string; email: string };
  timestamp: number;
  op: string;
  [k: string]: unknown;
}

export interface TaskJson {
  id: string;
  display_id: string;
  key: string;
  title: string;
  description: string;
  kind: TaskKind;
  status: string;
  priority: Priority | null;
  assignee: string | null;
  assignee_name: string | null;
  reporter: string;
  reporter_name: string;
  labels: string[];
  fixed_versions: string[];
  affected_versions: string[];
  due: string | null;
  parent: string | null;
  parent_display_id: string | null;
  links: LinkJson[];
  milestone: string | null;
  comments: CommentJson[];
  deleted: boolean;
  created: number;
  updated: number;
  history?: OpEnvelopeJson[];
}

export interface LsJson {
  scope: { mode: "here" | "registry"; repo_count: number; branch: string | null };
  filters_applied: {
    status: string | null;
    assignee: string | null;
    label: string | null;
    fixed_version: string | null;
    affected_version: string | null;
    kind: string | null;
    parent: string | null;
    mine: boolean;
    deleted: boolean;
  };
  repos: {
    name: string;
    project: string;
    path: string;
    key: string;
    branch: string | null;
    tasks: TaskJson[];
  }[];
  contributors: Record<string, string>;
  statuses: string[];
  total: number;
}

export interface MutationJson {
  task: TaskJson;
  ops: string[];
  automation: { rule: string; actions: string[]; ops: string[]; error?: string }[];
  created?: boolean;
}

export interface DropJson {
  id: string;
  display_id: string;
  title: string;
  kind: TaskKind;
  remote_deleted: string | null;
}

export interface RegistryRepoJson {
  name: string;
  path: string;
  project: string;
  exists: boolean | null;
  openable: boolean | null;
  key: string | null;
  branch: string | null;
  task_count: number | null;
  open_task_count: number | null;
  remotes: { name: string; url: string | null; push_url: string | null }[] | null;
  identity: IdentityInfoJson | null;
  error: string | null;
}

export interface IdentityInfoJson {
  name: string | null;
  email: string | null;
  ok: boolean;
  source: "repo" | "global" | "system" | "none";
}

export interface RegistryJson {
  config_dir: string;
  default_project: string;
  projects: string[];
  repos: RegistryRepoJson[];
}

export interface ProjectsJson {
  default_project: string;
  projects: { name: string; repos: string[] }[];
}

export type RegistryMutationAction =
  | "registered"
  | "moved"
  | "noop"
  | "unregistered"
  | "project_created"
  | "project_renamed"
  | "project_deleted"
  | "default_set";

export interface RegistryMutationJson {
  action: RegistryMutationAction;
  name: string;
  project?: string;
  previous_project?: string;
  registry: RegistryJson;
}

export interface RepoConfigJson {
  key: string;
  key_source: "config" | "derived";
  fields: Record<"priority" | "assignee" | "due", { required: boolean; source: "repo" | "global" | "default" }>;
  rules: { scope: "global" | "repo"; name: string; on: string; when: string | null; actions: string[] }[];
}

export interface RefResultJson {
  ref: string;
  task_id: string | null;
  display_id: string | null;
  status: "ok" | "rejected";
  message: string | null;
}

export interface PushJson {
  remote: string;
  attempted: number;
  pushed: number;
  refs: RefResultJson[];
  rejected: RefResultJson[];
  config_ref_pushed: boolean;
  nothing_to_push: boolean;
}

export interface PullJson {
  remote: string;
  counts: { new: number; fast_forwarded: number; merged: number; up_to_date: number };
  config: "new" | "fast_forwarded" | "merged" | "up_to_date" | null;
  tasks: { id: string; display_id: string; outcome: string }[];
}

export interface CloneJson {
  url: string;
  dir: string;
  task_count: number;
  key: string | null;
}

export interface WhoamiJson {
  repo?: IdentityInfoJson;
  global: IdentityInfoJson;
  effective: IdentityInfoJson;
}

/** git-task-web's own composite for the "clone a URL" flow (POST /api/repos/clone) —
 * not part of the CLI contract. `clone` and `register` are two separate git-task
 * invocations under the hood; the UI wants both results in one response. */
export interface CloneAndRegisterJson {
  clone: CloneJson;
  register: RegistryMutationJson;
}

/** git-task-web's own /api/meta shape — not part of the CLI contract. */
export interface MetaJson {
  name: string;
  version: string;
  mode: "dev" | "prod";
  dataDir: string;
  configDir: string;
  cli: { bin: string; version: string };
  identity: IdentityInfoJson;
}
