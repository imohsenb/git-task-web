# git-task-web — local web interface for the git-task CLI

## Context

`git-task` (`/Users/imohsenb/Workspace/Project/git-task`) is a Rust, git-native task manager. Tasks are event-sourced op-chains stored under `refs/tasks/<id>`; there are no working-tree files. A user-level TOML registry (`~/.config/git-task/config.toml`) maps repo names to absolute paths and groups them into projects, which is what makes `git task ls --all` span repos.

It is terminal-only. There is no HTTP layer, no daemon, no API. `git-task-web` (`/Users/imohsenb/Workspace/Project/git-task-web`, currently just a README) is the web front for it: you `npx git-task-web` on your laptop or run the Docker image, and get a browser UI over whatever repos are registered — plus the ability to add projects and repos from the UI. Under the hood it shells out to the `git-task` binary.

Design target is the reference screenshot: light neutral canvas, one big rounded white app shell, left sidebar with a project/repo tree, breadcrumb + very large title + a metadata row block, a Board/List/Table tab row with a blue "Add new task" button, and kanban columns of soft white cards with colored priority pills. Minimal, modern, neat — adapted honestly to git-task's real data (no attachments, no avatar images, free-form statuses).

## Locked decisions

| | |
|---|---|
| Backend | Node 20+ / TypeScript / Fastify 5, **shelling out** to the `git-task` binary |
| Frontend | React 19 + Vite 6 + TypeScript + Tailwind v4 |
| Packaging | One npm package (`npx git-task-web`) + a Docker image |
| v1 scope | Full task CRUD · Board + List + Table · repo/project management · push/pull sync UI |
| Docker | Repos added via `git task clone <url>` into a `/data` volume — no host filesystem dependency |
| Auth | **None in v1.** npx binds `127.0.0.1`, Docker binds `0.0.0.0`. README says don't expose it. |
| Identity | Resolved by git from the server's own environment. **Never request-supplied** — no `--author` flag, no HOME override, no in-app editor. |
| CLI changes | In scope — the CLI is still under development. §1 is the spec; `docs/cli-agent-prompt.md` is the runnable brief for an agent in the git-task repo. |

---

## Ground truth verified in the git-task source

These shape every decision below. Each was read, not assumed.

1. **Every command resolves its repo from the CWD** — `Repository::discover(current_dir())`, [git/repo.rs:11](../git-task/src/git/repo.rs:11). There is no `--repo <path>` flag on any command. The backend must spawn with `cwd` set to the registered repo's absolute path.
2. **`Actor::from_repo` reads only git config** for `user.name`/`user.email` and hard-errors if unset ([actor.rs:14](../git-task/src/actor.rs:14)). It ignores `GIT_AUTHOR_*`. A `git task clone`d repo has neither set, so **every write fails** there until solved.
3. **`Store::append` has no compare-and-swap** — [git_store.rs:52](../git-task/src/store/git_store.rs:52) reads the tip, commits onto it, then `set_ref(force=true)`. Two concurrent appends to one task silently orphan one op package.
4. **Automation writes to stdout** — [automation/engine.rs:83](../git-task/src/automation/engine.rs:83) does `println!("automation: rule '{}' fired …")` after *every* mutating command, and appends further ops as a second actor. It will corrupt JSON output and make a naive response stale.
5. **Hints write to stdout** — [hints.rs:34](../git-task/src/hints.rs:34). `GIT_TASK_NO_HINTS=1` must be set on every spawn.
6. **`GIT_CONFIG_GLOBAL` is inert.** libgit2 only honors it when the repo was opened with `GIT_REPOSITORY_OPEN_FROM_ENV`, which `Repository::discover` does not set. The fallback is `$HOME`. But overriding `HOME` also relocates the registry, because `config_dir()` falls through to `directories::BaseDirs` ([global.rs:192](../git-task/src/config/global.rs:192)).
7. **Interactive prompts are TTY-gated** (`stdin.isTTY && stdout.isTTY`, [prompt.rs:5](../git-task/src/prompt.rs:5)). Spawned from a server both are pipes, so commands **fail fast instead of hanging** — but every mutation must be fully flag-specified.
8. **`status` is a free-form `String`** — no vocabulary, no workflow enforcement. Kanban columns cannot be hardcoded.
9. **`ls` warns to stderr and skips** any registered repo it can't open ([ls.rs:133](../git-task/src/cli/ls.rs:133)), still exiting 0.
10. **`new` prints only a human line** — there is no machine-readable way to get the created task's id today.
11. **No `Clear*` ops** except `ClearParent`. Assignee, priority, due and milestone can be set but never unset.
12. **No `RestoreTask`** — soft delete is terminal. `drop` is hard, local-only, and non-syncing (a peer's pull resurrects it).

---

## 1. Deliverable A — the CLI JSON contract

Write this to `docs/cli-json-contract.md` in git-task-web as the first commit, then hand it to an agent working in the git-task repo. It is the interface both sides code against, and the fixtures in §3.6 are its acceptance tests.

### 1.1 Global rules

Add a **global** `--format <text|json>` flag on `Cli` (next to `--no-hints`). When `json`:

- **Only the JSON document goes to stdout.** `hints::print` no-ops; `Logger::info`/`plain` are suppressed; `automation::engine`'s `println!`/`eprintln!` are captured into `data.automation` instead of printed.
- **Exit code stays 1 on error**, but the error document is printed to stdout as valid JSON. stderr may keep the human `✖ Error:` line.
- **One envelope for every command**, including `show` and `export` (which today emit a bare `Task`/`Task[]`). Take the break — the alternative is per-command special-casing in the backend forever.
- `automation::engine::run` changes from `Result<()>` to `Result<Vec<AutomationEvent>>`; the caller decides how to render. Mutation payloads are built **after** automation settles, so the returned task is never stale.

```ts
export type CliResponse<T> = CliOk<T> | CliErr;
export interface CliOk<T>  { ok: true;  command: string; version: string; data: T; warnings: CliWarning[] }
export interface CliErr    { ok: false; command: string; version: string; error: CliError; warnings: CliWarning[] }

export interface CliError {
  kind: CliErrorKind;
  message: string;                              // anyhow top-level, no "✖ Error:" prefix, no ANSI
  causes: string[];                             // err.chain().skip(1), outermost first
  context?: Record<string, string | string[]>;
}

export type CliErrorKind =
  | "not_a_repo"        // ctx: { path }
  | "identity_missing"  // ctx: { path, missing: ["user.name"] }
  | "not_found"         // ctx: { query, entity: "task"|"repo"|"project"|"remote"|"comment" }
  | "ambiguous_id"      // ctx: { query, matches: string[] }   ← store.resolve, git_store.rs:112
  | "validation"        // ctx: { field?, missing?: string[] }
  | "conflict" | "rejected" | "remote" | "io" | "internal";

export interface CliWarning { message: string; detail?: string; scope?: string }
```

`kind` is the highest-value field here — string-matching `anyhow` messages across CLI versions is what would break this integration. `thiserror` is already a dependency; a `#[derive(Error)]` enum plus `anyhow::Error::downcast_ref` at the top of [lib.rs:39](../git-task/src/lib.rs:39) is the cheapest implementation. Minimum acceptable v1: classify `not_a_repo`, `identity_missing`, `not_found`, `ambiguous_id`, `validation` correctly; everything else may be `internal`.

### 1.2 Core shapes

```ts
export type TaskKind = "bug" | "story" | "task" | "epic" | "subtask";
export type Priority = "low" | "medium" | "high";
export type LinkKind = "blocks" | "relates" | "dup";     // Duplicates serialises as "dup"

export interface CommentJson { id: number; author: string; author_name: string; timestamp: number; text: string; edited: boolean }
export interface LinkJson    { kind: LinkKind; target: string; target_display_id: string }

export interface OpEnvelopeJson {          // KEEP the existing flat shape: #[serde(flatten)] + tag="op"
  author: { name: string; email: string }; // → { author, timestamp, op: "SetStatus", status: "doing" }
  timestamp: number; op: string; [k: string]: unknown;
}

export interface TaskJson {
  id: string;                       // 40-hex creation-commit oid
  display_id: string;               // NEW — `${key}-${id.slice(0,8)}`; backend cannot compute this
  key: string;                      // NEW — repo key from the refs/tasks/config chain
  title: string; description: string; kind: TaskKind;
  status: string;                   // FREE-FORM
  priority: Priority | null;
  assignee: string | null; assignee_name: string | null;   // *_name NEW
  reporter: string;        reporter_name: string;
  labels: string[];                 // BTreeSet → already sorted
  due: string | null;               // opaque, unparsed
  parent: string | null; parent_display_id: string | null; // NEW
  links: LinkJson[]; milestone: string | null; comments: CommentJson[];
  deleted: boolean; created: number; updated: number;      // unix seconds
  history?: OpEnvelopeJson[];       // on `show`; on `ls` only with --with-history
}
```

The `*_name` and `display_id` fields exist because the web layer **physically cannot derive them** — display names resolve from git commit signatures via `identity::contributor_directory`, and the key comes from the event-sourced config ref. `contributor_directory` is already built once per repo inside `ls::collect_rows`, so this is free.

### 1.3 Per-command payloads

**`ls --format json [--with-history]` — P0.** Grouped by repo, not a flat row list.

```ts
interface LsJson {
  scope: { mode: "here" | "registry"; repo_count: number; branch: string | null };
  filters_applied: { status?, assignee?, label?, kind?, parent?, mine?, deleted? };
  repos: { name: string; project: string; path: string; key: string; branch: string | null; tasks: TaskJson[] }[];
  contributors: Record<string, string>;   // email → display name, unioned across repos
  statuses: string[];                     // distinct observed, sorted — drives kanban columns
  total: number;
}
```
The two `Logger::warn("skipping '<name>'")` sites become `warnings[]` entries with `scope: name`; `ls` still exits 0.

**Mutations — `new`, `edit`, `status`, `comment`, `label`, `epic`, `link`, `delete` — P0.** One shape:
```ts
interface MutationJson {
  task: TaskJson;                    // state AFTER automation settles; history omitted
  ops: string[];                     // op tags from the user's action, e.g. ["SetStatus"]
  automation: { rule: string; actions: string[]; ops: string[]; error?: string }[];
  created?: boolean;                 // `new` only
}
```
This is what fixes ground-truth #10 — `new --format json` returns the created task including `display_id`.

`drop` is the exception (the task is gone afterwards):
```ts
interface DropJson { id: string; display_id: string; title: string; kind: TaskKind; remote_deleted: string | null }
```

**`repos --format json [--deep]` — P0.**
```ts
interface RegistryJson {
  config_dir: string; default_project: string; projects: string[];
  repos: {
    name: string; path: string; project: string;
    // --deep only, null when shallow:
    exists: boolean | null; openable: boolean | null; key: string | null; branch: string | null;
    task_count: number | null; open_task_count: number | null;
    remotes: { name: string; url: string | null; push_url: string | null }[] | null;
    identity: { name: string | null; email: string | null; ok: boolean; source: "repo"|"global"|"system"|"none" } | null;
    error: string | null;
  }[];
}
```
`--deep` must never fail on an unopenable repo — set `openable:false` + `error` + a `warnings[]` entry.

**`projects --format json` — P1.** `{ default_project: string; projects: { name: string; repos: string[] }[] }`

**Registry mutations — `register`, `unregister`, `project *` — P0.** Return the complete new (shallow) registry so the UI refreshes in one round trip:
```ts
interface RegistryMutationJson {
  action: "registered"|"moved"|"noop"|"unregistered"|"project_created"|"project_renamed"|"project_deleted"|"default_set";
  name: string; project?: string; previous_project?: string; registry: RegistryJson;
}
```
`"noop"` covers [register.rs:34](../git-task/src/cli/register.rs:34)'s "already in project X" and non-interactive "pass --project to move it" paths, which today both exit 0 with an info message and are indistinguishable.

**`config show|key|field|rule --format json` — P1.**
```ts
interface RepoConfigJson {
  key: string; key_source: "config" | "derived";
  fields: Record<"priority"|"assignee"|"due", { required: boolean; source: "repo"|"global"|"default" }>;
  rules: { scope: "global"|"repo"; name: string; on: string; when: string | null; actions: string[] }[];
}
```

**Sync — P0.**
```ts
interface PushJson { remote: string; attempted: number; pushed: number; refs: RefResultJson[];
                     rejected: RefResultJson[]; config_ref_pushed: boolean; nothing_to_push: boolean }
interface RefResultJson { ref: string; task_id: string | null; display_id: string | null;
                          status: "ok" | "rejected"; message: string | null }
interface PullJson { remote: string;
                     counts: { new: number; fast_forwarded: number; merged: number; up_to_date: number };
                     config: "new"|"fast_forwarded"|"merged"|"up_to_date"|null;
                     tasks: { id: string; display_id: string; outcome: string }[] }
interface CloneJson { url: string; dir: string; task_count: number; key: string | null }  // dir ABSOLUTE
```
Push rejection → `ok:false, kind:"rejected", context.refs` (a partial push genuinely needs a user decision). `nothing_to_push` still exits 0. `CloneJson.dir` must be absolute and canonicalised — the CLI resolves the default `<repo>-tasks` name, so the backend has to be told what it picked.

**`whoami --format json` — P0, new command.** `{ repo?: IdentityJson; global: IdentityJson; effective: IdentityJson }`. Promoted to P0 by the identity decision in §3.2 — it is the *only* way the UI learns who writes are attributed to, shows "committing as X", and pre-flights a 412 before a write fails.

`log` needs no JSON — `show`'s `history` is strictly richer than `render::to_log`.

### 1.4 Behavioural CLI changes (not just output)

| # | Change | Why |
|---|---|---|
| C1 | **`ClearAssignee`, `ClearPriority`, `ClearDueDate`, `ClearMilestone` ops** + `edit --clear-assignee\|--clear-priority\|--clear-due\|--clear-milestone` | Ground truth #11. Assign-but-never-unassign is the most user-visible hole in a board. Fold arms set the field to `None`. **Rank above some of the JSON work.** |
| C2 | **`new --status <s>`** | Otherwise "create directly in this column" is two round trips and two op packages. |
| C3 | Suppress `Logger`/`hints`/automation stdout under `--format json` | Ground truth #4/#5 — otherwise every mutation's JSON is corrupt. |
| C4 | **`whoami` command + rich `identity_missing` error context** (`{path, missing[], config_files[]}`) | §3.2 — the web app can neither supply nor override identity, so it must be able to *report* it precisely and tell the user which file to fix. |
| C5 | *(recommended, real fix for #3)* CAS in `Store::append` — `reference_matching` instead of `reference(force=true)` | ~10 lines. Makes concurrent writes safe across processes, not just within the web server. Higher value now that identity is process-level and a terminal is a first-class concurrent writer. |

**Explicitly rejected: a `--author "Name <email>"` flag.** Identity must come from real git credentials, not from anything a request can assert. See §3.2.

---

## 2. Repo layout

**One npm package, no workspaces.** `npx git-task-web` must resolve one published package; workspaces mean publishing three or bundling at release, for zero benefit at this size. Shared contract types are imported directly by both halves with no build ordering. The usual objection (React and Fastify in one dependency list) is solved by placement: **every frontend dep is a `devDependency`** — Vite bundles them into `dist/web` and they are never needed at runtime, so `dependencies` holds ~8 packages and `npx` install stays fast.

```
git-task-web/
├── package.json              bin: { "git-task-web": "dist/server/cli.js" }, files: ["dist"]
├── tsconfig.json  tsconfig.server.json  tsconfig.web.json
├── vite.config.ts            root src/web, outDir dist/web, proxy /api → :4600
├── Dockerfile  docker-compose.yml  .dockerignore
├── docs/cli-json-contract.md         ← §1, the deliverable for the git-task repo
└── src/
    ├── shared/           contract.ts · contract.zod.ts · api.ts · status.ts · ids.ts
    ├── server/
    │   ├── cli.ts        #!/usr/bin/env node — argv, port, open browser, preflight
    │   ├── main.ts       buildServer() → Fastify (also the dev entry)
    │   ├── env.ts        resolved paths, bin discovery, identity, mode
    │   ├── gitTask/      executor.ts · errors.ts · locks.ts · commands.ts · registry.ts
    │   │                 __fixtures__/   ← recorded JSON, doubles as the Rust acceptance tests
    │   ├── routes/       meta · registry · tasks · config · sync · prefs · events
    │   ├── prefs/store.ts  ui.json (board columns, colours, filters, default views)
    │   └── static.ts     @fastify/static + SPA fallback (prod only)
    └── web/
        ├── styles/tokens.css        THE design-token source of truth (@theme)
        ├── lib/          api · queryKeys · format · avatar · columns
        ├── components/   shell/ · meta/ · ui/ · board/ · list/ · table/ · task/ · forms/ · sync/
        └── pages/        Home · ProjectPage · RepoBoard/List/Table · TaskPage · Settings*
```

Dev: `concurrently "tsx watch src/server/main.ts" "vite"` — Vite on `:5173` proxies `/api` (and `/api/events` with buffering disabled for SSE) to Fastify on `:4600`. Prod: `dist/server/cli.js` boots Fastify with `@fastify/static` on `dist/web` plus a `setNotFoundHandler` returning `index.html` for non-`/api` GETs. One port, one process.

---

## 3. Backend

**Stack:** Fastify 5 · `execa` 9 (timeouts, no shell → no quoting/injection surface) · `zod` + `fastify-type-provider-zod` (one schema validates request bodies *and* CLI responses, so contract drift is a 502 with a diff, not a runtime `undefined`) · `async-mutex` · `@fastify/static` · `open` · pino.

### 3.1 Executor — `src/server/gitTask/executor.ts`

Single choke point. No other file may spawn a process.

- **`cwd` is a required argument**, validated absolute-and-existing. Ground truth #1: there is no `--repo` flag. Repo-name → path resolution happens once in `registry.ts`. `clone` is the exception — `cwd` is the data dir, and the resolved dir comes back in `CloneJson.dir`.
- **Env is constructed, not inherited:** `PATH`/`LANG`/`TZ` inherited; `GIT_TASK_NO_HINTS=1`; `NO_COLOR=1`; `GIT_TASK_CONFIG_DIR` **always set explicitly**; `SSH_AUTH_SOCK` forwarded when present; `GIT_TERMINAL_PROMPT=0`.
- **stdio fully piped, `stdin: "ignore"`.** This is what makes ground truth #7 safe — two pipes make `prompt::is_interactive()` false, so `edit` with no flags and `new` with missing required fields error fast instead of hanging. Timeout (15 s default, 120 s for sync) is the hard backstop.
- **Parse:** `CliResponse<T>` → zod-validate `data` → return, or throw `GitTaskError`. Unparseable falls back to a legacy path: bare-JSON sniff on exit 0, else a stderr parser (strip ANSI, match `/^✖ Error:\s*(.+)$/m` and `/^└─\s*Cause:\s*(.+)$/m`, then a small regex table to guess `kind`). This exists only for CLI builds predating the contract — it is exactly what `CliError.kind` lets us delete.
- **Error → HTTP:** `not_found`→404 · `ambiguous_id`→409 *(with `matches` so the UI offers a disambiguation picker)* · `conflict`/`rejected`→409 · `validation`→422 · `identity_missing`→**412** *(dedicated dialog)* · `not_a_repo`→400 · `remote`→502 · `io`/`internal`→500 · timeout→504.
- **Warnings pass through** on every response as `{ data, warnings }`; the frontend renders a shared `<WarningStrip>`. That is ground truth #9's home.

### 3.2 Identity and credentials — two separate problems

**Author identity** (who the op is attributed to). **The web app never supplies, overrides, or accepts an identity.** With no auth in v1, anything a request could assert would be trivially forgeable — so identity is resolved entirely by git itself, from the environment the *server process* runs in. There is no `--author` flag and no `HOME` override.

| Deployment | How git resolves `user.name`/`user.email` | Web app's role |
|---|---|---|
| npx on a laptop | Spawn inherits the real `HOME`. git-task resolves exactly as the user's own terminal would: repo-local `.git/config` wins, else `~/.gitconfig`. | none — zero involvement |
| Docker, host config mounted | `~/.gitconfig` mounted read-only at `/home/node/.gitconfig` | none |
| Docker, env-configured | `GT_USER_NAME`/`GT_USER_EMAIL` are written **once at boot** to the container user's own `/home/node/.gitconfig` | writes the file at startup only; the values come from container env, i.e. from the operator, never from a request |
| Nothing resolvable | — | writes return **412** *before* spawning, with the repo path and the exact `git config` command to run |

Consequences, deliberate: a registered dev repo commits under **your real identity** for that repo; a `git task clone`d tasks-only repo has no local config and falls through to the global one. The Settings page shows identity **read-only** ("committing as X, from `<file>`") — there is no editor, because an editor is the forgeable path. `whoami --format json` (C4) is how the UI learns all of this, which is why it is P0.

`HOME` is never overridden, so ground truth #6's registry-relocation trap never fires. `GIT_TASK_CONFIG_DIR` is still set explicitly on every spawn as defence in depth, with the boot self-test asserting the `config_dir` returned by `repos --format json` matches.

**Remote credentials** (push/pull/clone transport) — a separate layer. `remote_callbacks` ([git/repo.rs:45](../git-task/src/git/repo.rs:45)) tries the SSH agent, then libgit2's default lookup. Locally that already works. In Docker, three documented options: (A) forward the host agent via `SSH_AUTH_SOCK` — pre-wired in `docker-compose.yml`; (B) a PAT in the clone URL, accepted by the Add-Repo dialog, **stored only inside the cloned repo's `origin` URL**, never in `ui.json`, and masked to `https://***@host/…` at the API boundary; (C) macOS `/run/host-services/ssh-auth.sock`. The sync panel detects `kind:"remote"` and links to the right one.

### 3.3 Write serialisation

Ground truth #3, confirmed exactly. It is worse than per-task: `automation::engine::run` appends more ops to the same task after the caller's write from a different actor in the same process, and `new` writes the config ref on the first task in a repo ([new.rs:135](../git-task/src/cli/new.rs:135)).

**Per-repo-path `Mutex`** (`async-mutex`), keyed on the canonical absolute path, held for the entire spawn of any `write: true` command. Per-repo not per-task because the config ref is repo-scoped, `epic add`/`link add` touch two tasks, and a command is 20–150 ms — one user's UI generates no meaningful contention. Reads take no lock. Plus a queue-depth cap (503 above ~32 waiters) and an acquisition timeout equal to the command timeout, so a wedged spawn can't deadlock a repo forever.

This protects *this process only*. A terminal `git task status` can still race it. That is inherent until C5 lands; the README says so.

### 3.4 Caching

`ls --all` is O(repos × tasks) and each fold walks the task's whole commit DAG ([`topological_order`, git_store.rs:161](../git-task/src/store/git_store.rs:161)), plus a revwalk per repo for the contributor directory. **Invalidation signal: a ref digest** — `sha256(sorted("<refname> <oid>" for refs/tasks/*))`, read directly from `.git/refs/tasks/**` + `.git/packed-refs` in Node (a few ms, no subprocess). Cache key is `(repoPath, digest, normalisedFilters)`. Writes invalidate eagerly; the digest catches out-of-band terminal edits. Digest itself gets a 2 s TTL; the deep registry 5 s.

### 3.5 Routes

`R` = registry lookup `name → path`. **W** = per-repo write lock.

| Method | Route | cwd | invocation |
|---|---|---|---|
| GET | `/api/meta` | — | `--version`, `whoami --format json` |
| GET | `/api/registry` | dataDir | `repos --format json --deep` |
| POST/PATCH/DELETE | `/api/projects[/:name]` | dataDir | `project create\|rename\|set-default\|delete` |
| POST | `/api/repos` `{mode:"register",path,…}` | **`path`** | `register [name] [--project p]` |
| POST | `/api/repos` `{mode:"clone",url,…}` | dataDir | ① `clone <url> [dir]` → `data.dir` ② cwd=`data.dir`: `register <name> --project <p>` |
| PATCH | `/api/repos/:name` `{project}` | `R.path` | `register <name> --project <p>` (moves) |
| DELETE | `/api/repos/:name` | dataDir | `unregister <name>` |
| GET | `/api/repos/:name/tasks?…` | `R.path` | `ls --here [--status][--assignee][--label][--kind][--parent][--deleted]` |
| GET | `/api/tasks?project=&…` | dataDir | `ls --all\|--project <p> …` |
| GET | `/api/repos/:name/tasks/:id` | `R.path` | `show <id>` |
| POST | `/api/repos/:name/tasks` **W** | `R.path` | `new "<title>" --kind --desc [--priority][--assignee][--label …][--due][--milestone][--parent][--status]` |
| PATCH | `/api/repos/:name/tasks/:id` **W** | `R.path` | `edit <id> <only changed flags> [--clear-*]` |
| PUT | `…/tasks/:id/status` **W** | `R.path` | `status <id> "<status>"` |
| DELETE | `…/tasks/:id[?hard=1&remote=r]` **W** | `R.path` | `delete <id>` / `drop <id> --force [--remote r]` |
| POST/PATCH | `…/tasks/:id/comments[/:n]` **W** | `R.path` | `comment <id> "<text>" [--edit n]` |
| POST/DELETE | `…/tasks/:id/labels[/:label]` **W** | `R.path` | `label <id> add\|rm "<label>"` |
| POST/DELETE | `…/tasks/:id/links` **W** | `R.path` | `link <id> add\|rm <kind> <other>` |
| PUT/DELETE | `…/tasks/:id/parent` **W** | `R.path` | `epic <epic> add\|rm <id>` |
| GET/PUT/POST/DELETE | `…/config[/key\|/fields/:f\|/rules[/:r]]` | `R.path` | `config show\|key\|field\|rule` |
| POST | `…/push` · `…/pull` **W** | `R.path` | `push\|pull [remote]` (120 s) |
| POST | `/api/sync` `{repos[],op}` | each | fan out sequentially, stream results over SSE |
| GET/PUT | `/api/identity` · `/api/prefs` | — | `whoami` + local `identity.json` / `ui.json` |
| GET | `/api/events` | — | SSE `{type:"repo-changed", repo, digest}` |

Argv rules, all enforced in `commands.ts` (the only argv builder):
- **`--` before any positional that could start with `-`** — a title like `--fix crash` would otherwise parse as a flag.
- **`ls --here` for single-repo listing**, not `--repo <name>` — uniform "cwd is the repo" semantics, and it sidesteps `ls.rs`'s bail when `--here` meets registry selectors.
- **`edit` sends only genuinely changed fields** — an unchanged `--title` writes a redundant `SetTitle` op into permanent history. An empty diff never spawns (returns 204), since `edit` with no flags hard-errors off-TTY.
- **Free-form `status` values pass verbatim** but are rejected server-side if empty, whitespace-only, or containing newlines.

### 3.6 Fixtures

`src/server/gitTask/__fixtures__/` holds recorded JSON for every command in §1, validated by the same zod schemas the runtime uses. The backend develops against them while the Rust work is in flight, and they double as the acceptance tests for the CLI implementation.

---

## 4. Frontend

**Stack:** React 19 · Vite 6 · **Tailwind v4** via `@tailwindcss/vite` (its CSS-first `@theme` block *is* the token system — tokens become both custom properties and utilities from one declaration, no config duplication) · React Router 7 (data routers, URL-as-state) · TanStack Query v5 (entire server cache, optimistic mutations) · Zustand for the little that isn't server state · **dnd-kit** (accessible, keyboard drag) · TanStack Table v8 · Radix primitives (unstyled, no visual opinions to fight) · lucide-react · sonner · react-hook-form + zod (schemas shared with the server).

### 4.1 Routes

```
/                            Home — assigned to me, recently updated, per-repo sync strip
/p/:project                  Project — repos in it, aggregated read-only board
/r/:repo/{board,list,table}  share one <RepoWorkspace>: breadcrumb + title + meta block + tabs
/r/:repo/:view/t/:displayId  task detail as a right drawer over the current view
/t/:repo/:displayId          task as a full page (deep links, narrow viewports)
/settings/{repos,identity,appearance}
```
Filters, search and grouping live in the query string (`?status=doing&label=api&q=…`) → a `useTaskFilters()` hook → the TanStack Query key. One source of truth, every board state linkable, back/forward works.

### 4.2 Design tokens — `src/web/styles/tokens.css`

The single source of truth; **nothing in the component tree may hold a raw hex**. Realises the reference look:

- **Surfaces** — `canvas` `oklch(.973 .003 265)` (warm-cool neutral page bg), `shell` white, `surface` white, `surface-sunk` for kanban column wells, `line`/`line-strong` hairlines.
- **Ink** — four steps from `oklch(.21 .015 265)` (the very large title) down to `oklch(.70 .01 265)` (placeholders).
- **Brand** — `oklch(.575 .205 262)`, the blue "+ Add new task", plus hover/soft/ink/focus variants.
- **Semantic tint+ink pairs** — neutral / info / warn / danger / success / accent. One pair per bucket, mirroring `color.rs::Semantic` so terminal and browser agree.
- **Radii** — shell 28px, card 14px, control 10px, pill 999px, well 18px.
- **Elevation** — soft, wide, low-alpha; **no hard borders on cards**. `shell` / `card` / `lift` (hover) / `pop` (overlays).
- **Type** — Inter var, tabular numerals on counts and dates; JetBrains Mono for `display_id` and hashes. `display` 2.125rem/700/-0.022em down to `micro` 0.6875rem.
- **Layout** — sidebar 268px, topbar 64px, column 304px, drawer 480px.

Two derived helpers, never raw values:
- `semanticClasses(sem)` → `{tint, ink}`. Every pill goes through it. `sem` comes from `src/shared/status.ts`, a **direct port of `color.rs::status_semantic`** (`done|closed|resolved|completed`→success, `doing|in-progress|started|wip|review`→warn, `blocked|stuck`→danger, `todo|open|backlog|new|planned`→info, else neutral). Porting rather than inventing means a status is the same colour in both surfaces.
- `avatarFor(email, name)` → deterministic initials + hue. `hue = fnv1a(email) % 360`, bg `oklch(.93 .045 h)`, text `oklch(.45 .14 h)`. **No images** — git-task has none, and calling Gravatar would leak emails from a self-hosted tool.

### 4.3 Honest substitutions from the reference

| Reference | git-task reality | Rendered as |
|---|---|---|
| Timeline tab | no real dates (`due` is opaque) | **dropped** — three tabs: Board / List / Table |
| Calendar nav | — | **Milestones** — groups by the `milestone` string |
| Members nav | `contributors` map | read-only directory + per-person task counts (no invites — nothing to invite to) |
| avatar images | none | deterministic initial-avatars |
| visibility pill | no such concept | **repo key pill** (`SRV`) + branch pill |
| attachment count | none | **comment count** `💬 n` |
| subtask count | `links` + children | **link count** `🔗 n` + child count when `kind==="epic"` |
| deadline chevron | opaque `due` | render as-is; chevron opens a date picker only if it parses as ISO-8601 |
| promo card | — | keep the slot: sync health / "N repos, M tasks" / CLI docs link |

**TaskCard** — `surface` / `radius-card` / `shadow-card`, `shadow-lift` on hover. Row 1: priority pill + kind badge (bug=danger, epic=info, story=accent, task/subtask=neutral) + `display_id` in mono/micro/ink-4. Row 2: title, 600 weight, 2-line clamp. Row 3: description, ink-3, 1-line clamp, omitted when empty. Row 4: up to 2 label pills + `+n` · spacer · avatar stack (assignee then commenters, max 3) · `💬 n` · `🔗 n`. Soft-deleted: 55% opacity, strikethrough, `DELETED` danger pill, visible only with the deleted filter on.

### 4.4 Kanban columns — derived, not hardcoded

Ground truth #8. `columns = ordered(union(pinned, observed))` where `observed` = `LsJson.statuses` and `pinned` = `prefs.boards[repo].columns` (persisted server-side in `ui.json`).

- A **pinned** column persists at zero tasks — that's how you get an empty "Done" lane and pre-create a workflow.
- An **observed-but-unpinned** status auto-appends (a terminal `git task status X shipped` shows up immediately) and auto-pins on first sight so its position is then stable.
- **Seed order** for a repo with no prefs, so the first render already looks deliberate: rank by `status_semantic` — info (todo/open/backlog) → neutral (alphabetical) → warn (doing/review/wip) → danger (blocked) → success (done/closed), with `"todo"` forced first as `DEFAULT_STATUS`. This reproduces the reference's gray/blue/amber/green run for a conventional workflow **without hardcoding those four names**.
- `ColumnSettingsMenu`: rename display label (cosmetic — the status string is immutable), override colour bucket, hide, WIP hint, delete (unpins, only when empty). Reorder by dragging the header.
- **Typo guard:** new-column input is a Combobox over `observed ∪ pinned`, free entry allowed but with an inline "creates a new status" warning and a Levenshtein-1 "did you mean `doing`?" nudge. A typo is a permanent column *and* a permanent op in history.

**Drag → status change:**
1. `fromStatus === toStatus` → reorder only, **no server call**; git-task stores no intra-status ordering. Position persists locally in `prefs.boards[repo].order[status]`, an advisory list (unknown ids sort by `updated` desc). Cross-client card order is explicitly **not** synced — there is nowhere in the data model to put it.
2. Otherwise optimistic `setQueryData` + snapshot → `PUT …/status` → `status <id> "<toStatus>"`.
3. Success replaces the optimistic task with `MutationJson.task`. **If `automation[]` is non-empty the returned task may differ from what was applied** — a rule can bounce the status elsewhere. The card animates to wherever the server says and a toast names the rule. This is precisely why the response carries post-automation state.
4. Failure rolls back with a mapped toast; `identity_missing` (412) opens the identity dialog instead.
5. `onDragStart` cancels in-flight refetches for that repo so a background poll can't yank the card mid-drag.

Card kebab menu and detail drawer hit the same `useSetStatus()` hook — one code path, three affordances.

### 4.5 Data layer

Keys: `["registry"]` · `["tasks", repo, filters]` · `["task", repo, displayId]` · `["config", repo]` · `["prefs"]` · `["identity"]`. `staleTime` 10 s lists / 30 s registry, `refetchOnWindowFocus: true` (you edited in a terminal, you alt-tab back, it's fresh). SSE `/api/events` invalidates on `repo-changed`; server emits after any write and on a 5 s ref-digest poll for repos with an open subscriber, falling back to interval refetch if `EventSource` fails. Every mutation hook: optimistic → rollback on error → invalidate on settle; drawer and list share cache entries so the drawer updates the card behind it for free. Search is client-side over the loaded set (title + description + labels + display_id), debounced 150 ms — `ls` has no full-text filter. Above ~2000 tasks, virtualise before adding server-side search.

---

## 5. Docker + distribution

The git-task release workflow publishes **generated notes only, no compiled artifacts**, so there is nothing to download.

- **Docker builds git-task from source** in a pinned Rust stage.
- **npx does not bundle it** — it requires `git-task` (or `gtask`) on `PATH`, discovered via `GIT_TASK_BIN` → `which git-task` → `which gtask` → `~/.cargo/bin/git-task`. If absent, exit with the actual install command, not a stack trace. Boot runs `--version` and warns (doesn't block) on a version outside the supported range.
- *Worth requesting upstream:* `cross`-built tarballs in `release.yml` would let Docker skip a ~4-minute Rust build and let the npm package ship an optional postinstall downloader. Not a blocker.

**Dockerfile — three stages.** ① `rust:1-bookworm`: `pkg-config libssl-dev cmake`, clone git-task at `$GIT_TASK_REF`, `cargo build --release --locked --bin git-task`, strip. ② `node:22-bookworm-slim`: `npm ci`, `npm run build` (tsc → `dist/server`, vite → `dist/web`), `npm prune --omit=dev` (frontend deps are devDeps, so they vanish here). ③ `node:22-bookworm-slim` runtime: `ca-certificates openssh-client libssl3 zlib1g`, copy binary + `dist` + pruned `node_modules`. **No `git` binary needed at runtime** — git-task speaks libgit2 for everything including `clone`. `USER node`, `EXPOSE 4600`, healthcheck on `/api/meta`.

**`/data` is the only mount:** `config/config.toml` + `automation.toml` (registry, via `GIT_TASK_CONFIG_DIR`) · `repos/<name>-tasks/` (clone targets) · `ui.json`. Identity is **not** stored here — it lives in the container user's own `/home/node/.gitconfig`, either bind-mounted from the host or written once at boot from env (§3.2).

| Env | Default | |
|---|---|---|
| `GIT_TASK_WEB_PORT` | 4600 | |
| `GIT_TASK_WEB_HOST` | `127.0.0.1` npx / `0.0.0.0` docker | never bind 0.0.0.0 on a laptop |
| `GIT_TASK_WEB_DATA_DIR` | `~/.local/share/git-task-web` / `/data` | |
| `GIT_TASK_CONFIG_DIR` | inherited / `/data/config` | **set explicitly on every spawn** |
| `GIT_TASK_BIN` | discovered | |
| `GT_USER_NAME` / `GT_USER_EMAIL` | — | written once at boot to `/home/node/.gitconfig`; ignored if that file is bind-mounted |
| `SSH_AUTH_SOCK` | — | forwarded to every spawn |

`docker-compose.yml` ships with SSH agent forwarding pre-wired — it is the #1 support question.

**npm package:** `"bin": {"git-task-web": "dist/server/cli.js"}`, `"files": ["dist"]`, 8 runtime deps (fastify, @fastify/static, execa, zod, fastify-type-provider-zod, async-mutex, open, pino). Flags `--port --data-dir --bin --no-open`, all env-settable. Boot prints the URL, opens the browser, runs preflight.

---

## 6. Build order

Each phase ends in something runnable.

| # | Phase | Ends with |
|---|---|---|
| **0** | Scaffold (½d) — tsconfigs, Vite + Tailwind v4 + `tokens.css`, Fastify `GET /api/meta`, static+SPA serving, dev proxy. **Write `docs/cli-json-contract.md` here.** | `npm run dev` and `npm run build && npm start` both render a styled page. No CLI involved. |
| **1** | Executor + preflight (1d) — `executor.ts`, `errors.ts` (incl. stderr fallback), `commands.ts`, `env.ts`, `locks.ts`. Binary discovery + version check. Unit tests against a temp fixture repo (mirror `git-task/tests/common/mod.rs`). | `curl /api/meta` reports version/mode/dataDir. Unset identity → clean 412. |
| **2** | Read-only slice (2d) — *needs `ls` + `repos --deep` JSON*. Registry cache + ref-digest. AppShell, Sidebar tree, TopBar, Breadcrumb, MetaBlock, tab row, **ListView first**, read-only TaskDrawer. | Your real repos and tasks on screen; the reference layout is recognisable. First honest checkpoint on the design. |
| **3** | Board + table (2d) — `columns.ts` derivation, BoardView/TaskCard, TanStack Table, URL filters, client search, avatars, WarningStrip. Still read-only. | Three views, filters survive reload, a terminal `git task status X shipped` produces a sensible new column. |
| **4** | Writes (2–3d) — *needs mutation JSON + C1 (Clear ops) + C4 (whoami)*. All write routes behind the lock, optimistic hooks, NewTaskDialog (respects `config show` required fields so it blocks *before* `new.rs:76` errors), EditTaskForm, drag-to-status, comments, labels, links, epic parent, delete/drop with a confirm spelling out the difference. | Create in UI → `git task show` matches. Drag → `git task log` shows the `SetStatus`. Two concurrent status changes serialise with no lost op. |
| **5** | Repo & project management (1–2d) — *needs `register`/`project`/`clone` JSON*. AddRepoDialog (register a path / clone a URL), move between projects, unregister, project CRUD surfacing the real constraints (can't delete the default or a non-empty project). Identity settings. | **In a fresh container with an empty volume: clone from the UI, set identity, create a task, push.** That's the whole Docker story. |
| **6** | Sync UI + SSE (1–2d) — *needs `push`/`pull` JSON*. Per-repo push/pull with a per-ref result report, rejection → "pull first" CTA, sync-all, ahead/behind, SSE invalidation, credential-error guidance. | Two clones of one bare repo, edit in both, pull, both converge. |
| **7** | Polish (2d) — empty/error/loading states, keyboard shortcuts (`c` new, `/` search, `esc`, arrow column nav), dnd-kit a11y announcements, Members, Milestones, appearance settings, Dockerfile + compose + CI, README with the three SSH options. | Shippable. |

**CLI work sequence** (each unblocks the phase named): envelope + error taxonomy + `ls` + `repos --deep` + `whoami` → **P2**; mutations + Clear ops + `new --status` → **P4**; `register`/`project`/`clone` → **P5**; `push`/`pull` → **P6**. Until each lands the backend develops against `__fixtures__/`, so the frontend is never blocked.

---

## 7. Verification

- **Executor unit tests** — build a fixture repo in a temp dir, `GIT_TASK_CONFIG_DIR` pointed at a temp config, then assert each command's parsed shape against the zod schemas.
- **Round-trip against the terminal** — every write done in the UI is verified with `git task show <id>` / `git task log <id>` in a shell, and every terminal write appears in the UI within one refetch.
- **Concurrency** — fire two simultaneous `PUT …/status` at the same task; assert both ops land in `git task log` (proves the lock). Then do the same with one from a terminal to demonstrate the *unprotected* case, and document it.
- **Docker end-to-end (the real acceptance test)** — fresh container, empty volume: set identity → clone a repo by URL from the UI → create a task → change status → push → verify from a second clone.
- **Sync convergence** — two tasks-only clones of one bare repo, divergent edits, pull both, assert identical `ls` output.
- **Contract drift** — CI runs the zod schemas over `__fixtures__/` *and*, when a git-task binary is present, over live output. A mismatch fails the build with a diff.

---

## 8. Known gaps carried into v1

1. **No cross-process write safety.** The per-repo mutex protects only this server; a terminal `git task status` can still race it. Real fix is C5 (CAS in `Store::append`). Shipping with the mutex + a README note.
2. **Soft delete is terminal, `drop` is louder.** The delete confirm says so plainly; the drop confirm additionally warns that a peer's push resurrects it.
3. **Free-form status has no undo** — a typo is a permanent column *and* a permanent op. The Combobox + Levenshtein nudge is mitigation, not prevention.
4. **`ls` cost is untested above a few hundred tasks.** Every listing folds every task's full DAG. The ref-digest cache makes repeats free; the cold path is linear. Measure in Phase 2; if needed, request `ls --limit`/`--since`.
5. **Cross-repo board is read-only.** `/p/:project` aggregates via `ls --project`, but two repos can have colliding statuses with different meanings, so drag is disabled and cards deep-link into their own repo board.
6. **Card ordering is per-installation.** Nothing in the data model stores intra-column rank; it lives in `ui.json`. Would need an upstream `SetRank` op to fix properly.
7. **No auth, single identity.** Per the decision. Every write commits as whatever identity git resolves for the server process — the web app cannot vary it per user, by design (§3.2). Multi-user attribution would require real auth first, then a trusted way to map a session to a git identity; a request-supplied author is never that. README actively discourages exposing the port.
8. **Repo name collisions.** `POST /api/repos` (create) and `PATCH /api/repos/:name` (move) are deliberately distinct routes because `register` overloads both. A clone landing on a taken `<repo>-tasks` name auto-suffixes `-2`, with the final name shown in the success toast.
