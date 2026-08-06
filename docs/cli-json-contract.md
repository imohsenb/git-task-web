# git-task CLI JSON contract

This is the interface the `git-task-web` backend codes against. It mirrors
`git-task`'s `--format json` output exactly — verified live against
`git-task 1.0.0` on 2026-08-03. If the CLI changes shape, this file and the
zod schemas in `src/server/gitTask/` must change together.

## Global rules

Global `--format <text|json>` flag on `Cli`. When `json`:

- Only the JSON document goes to stdout. Hints, loggers, and automation
  console output are suppressed/captured into `data.automation`.
- Exit code stays 1 on error, but the error document is still printed to
  stdout as valid JSON. stderr may keep the human `✖ Error:` line.
- One envelope for every command, including `show` and `export`.

```ts
export type CliResponse<T> = CliOk<T> | CliErr;
export interface CliOk<T>  { ok: true;  command: string; version: string; data: T; warnings: CliWarning[] }
export interface CliErr    { ok: false; command: string; version: string; error: CliError; warnings: CliWarning[] }

export interface CliError {
  kind: CliErrorKind;
  message: string;                              // anyhow top-level, no "✖ Error:" prefix, no ANSI
  causes: string[];                              // err.chain().skip(1), outermost first
  context?: Record<string, string | string[]>;
}

export type CliErrorKind =
  | "not_a_repo"        // ctx: { path }
  | "identity_missing"  // ctx: { path, missing: ["user.name"] }
  | "not_found"         // ctx: { query, entity: "task"|"repo"|"project"|"remote"|"comment" }
  | "ambiguous_id"       // ctx: { query, matches: string[] }
  | "validation"         // ctx: { field?, missing?: string[] }
  | "conflict" | "rejected" | "remote" | "io" | "internal";

export interface CliWarning { message: string; detail?: string; scope?: string }
```

## Core shapes

```ts
export type TaskKind = "bug" | "story" | "task" | "epic" | "subtask";
export type Priority = "low" | "medium" | "high";
export type LinkKind = "blocks" | "relates" | "dup";

export interface CommentJson { id: number; author: string; author_name: string; timestamp: number; text: string; edited: boolean }
export interface LinkJson    { kind: LinkKind; target: string | null; target_display_id: string; target_repo: string | null }
// target is null and target_repo is the target repo's absolute path for a cross-repo
// link (`link ... add --repo <name|path|url>`); both null/absent-equivalent for same-repo.

export interface OpEnvelopeJson {
  author: { name: string; email: string };
  timestamp: number; op: string; [k: string]: unknown;
}

export interface TaskJson {
  id: string;                       // 40-hex creation-commit oid
  display_id: string;               // `${key}-${id.slice(0,8)}`
  key: string;                      // repo key from the refs/tasks/config chain
  title: string; description: string; kind: TaskKind;
  status: string;                   // free-form
  priority: Priority | null;
  assignee: string | null; assignee_name: string | null;
  reporter: string;        reporter_name: string;
  labels: string[];                 // sorted
  fixed_versions: string[];         // sorted, deduped; set-at-creation only, no edit/add/rm CLI path yet
  affected_versions: string[];      // sorted, deduped; set-at-creation only, no edit/add/rm CLI path yet
  due: string | null;               // opaque, unparsed
  parent: string | null; parent_display_id: string | null;
  // parent_repo: null for a same-repo parent (or none). For a cross-repo epic
  // (`epic <epic> add <child> --repo <name|path|url>`), the epic repo's origin remote URL
  // (preferred) or local path (fallback) — same shape as LinkJson.target_repo.
  parent_repo: string | null;
  links: LinkJson[]; milestone: string | null; comments: CommentJson[];
  deleted: boolean; created: number; updated: number;      // unix seconds
  history?: OpEnvelopeJson[];       // on `show`; on `ls` only with --with-history
  // children: only populated by `show` (a scan; nothing on the epic points at its
  // children). Absent/omitted on `ls`, mutation payloads, and `export`.
  children?: ChildJson[];
}

export interface ChildJson {
  id: string | null;                // resolved local id for a same-repo child; null cross-repo
  display_id: string;               // same-repo: under this repo's key. cross-repo: under its own repo's key
  title: string; kind: TaskKind; status: string;
  repo: string | null;              // null same-repo; cross-repo: the child's registered repo name
}
```

## Per-command payloads

**`ls --format json [--with-history]`**

```ts
interface LsJson {
  scope: { mode: "here" | "registry"; repo_count: number; branch: string | null };
  filters_applied: {
    status: string | null; assignee: string | null; label: string | null;
    fixed_version: string | null; affected_version: string | null;
    kind: string | null; parent: string | null; mine: boolean; deleted: boolean;
  };
  repos: { name: string; project: string; path: string; key: string; branch: string | null; tasks: TaskJson[] }[];
  contributors: Record<string, string>;   // email -> display name
  statuses: string[];                     // distinct observed, sorted
  total: number;
}
```

**Mutations — `new`, `edit`, `status`, `comment`, `label`, `epic`, `link`, `delete`**

```ts
interface MutationJson {
  task: TaskJson;                    // state AFTER automation settles; history omitted
  ops: string[];
  automation: { rule: string; actions: string[]; ops: string[]; error?: string }[];
  created?: boolean;                 // `new` only
}
```

`drop` is the exception (the task is gone afterwards):

```ts
interface DropJson { id: string; display_id: string; title: string; kind: TaskKind; remote_deleted: string | null }
```

**`repos --format json [--deep]`**

```ts
interface RegistryJson {
  config_dir: string; default_project: string; projects: string[];
  repos: {
    name: string; path: string; project: string;
    exists: boolean | null; openable: boolean | null; key: string | null; branch: string | null;
    task_count: number | null; open_task_count: number | null;
    remotes: { name: string; url: string | null; push_url: string | null }[] | null;
    identity: { name: string | null; email: string | null; ok: boolean; source: "repo"|"global"|"system"|"none" } | null;
    error: string | null;
  }[];
}
```

**`projects --format json`**

`{ default_project: string; projects: { name: string; repos: string[] }[] }`

**Registry mutations — `register`, `unregister`, `project *`**

```ts
interface RegistryMutationJson {
  action: "registered"|"moved"|"noop"|"unregistered"|"project_created"|"project_renamed"|"project_deleted"|"default_set";
  name: string; project?: string; previous_project?: string; registry: RegistryJson;
}
```

**`config show|key|field|rule --format json`**

```ts
interface RepoConfigJson {
  key: string; key_source: "config" | "derived";
  fields: Record<"priority"|"assignee"|"due", { required: boolean; source: "repo"|"global"|"default" }>;
  rules: { scope: "global"|"repo"; name: string; on: string; when: string | null; actions: string[] }[];
}
```

**Sync**

```ts
interface PushJson { remote: string; attempted: number; pushed: number; refs: RefResultJson[];
                     rejected: RefResultJson[]; config_ref_pushed: boolean; nothing_to_push: boolean }
interface RefResultJson { ref: string; task_id: string | null; display_id: string | null;
                          status: "ok" | "rejected"; message: string | null }
interface PullJson { remote: string;
                     counts: { new: number; fast_forwarded: number; merged: number; up_to_date: number };
                     config: "new"|"fast_forwarded"|"merged"|"up_to_date"|null;
                     tasks: { id: string; display_id: string; outcome: string }[] }
interface CloneJson { url: string; dir: string; task_count: number; key: string | null }  // dir absolute
```

**`whoami --format json`**

`{ repo?: IdentityJson; global: IdentityJson; effective: IdentityJson }`

`log` needs no JSON — `show`'s `history` is strictly richer than `render::to_log`.

## Verified live

Ran against `git-task 1.0.0` in a scratch repo on 2026-08-03:

- `new "Test task" --format json --desc "desc"` -> `CliOk<MutationJson>` with `created: true`, matches shape above.
- `ls --format json` -> `CliOk<LsJson>`, `scope.mode: "here"`, `statuses: ["todo"]`.
- `repos --format json` -> `CliOk<RegistryJson>`, shallow fields null as documented.
- Validation error (`new` missing `--desc`) -> `CliErr` with `kind: "validation"`, `context.missing: ["description"]`, exit 1, still valid JSON on stdout.

Ran against `git-task 1.0.0` (post cross-repo-epic feature) on 2026-08-06:

- `epic <epic> add <child> --repo <name>` from the child's repo -> `CliOk<MutationJson>`, `task.parent_repo` set to the epic repo's resolved identifier, `task.parent_display_id` the raw epic id as typed.
- `show <epic> --format json` -> `children[]` includes same-repo children (`repo: null`) and, when this repo is registered, cross-repo children too (`repo: "<registered name>"`, `id: null`).
- `ls --parent=<epic> --format json` (even `--all`) does **not** surface cross-repo children — it filters same-repo only; `show`'s scan is the only way to list them.

Backend and frontend code against these shapes directly; no fixture recording
needed since the live binary already implements the contract.
