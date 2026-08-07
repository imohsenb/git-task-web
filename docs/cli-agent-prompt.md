# Agent brief — machine-readable output for `git-task`

Run this against `/Users/imohsenb/Workspace/Project/git-task`. Everything below the line is the prompt; paste it verbatim.

---

You are working in the `git-task` repo (Rust, clap 4, git2/libgit2). Task: make the CLI fully machine-readable so a web frontend can drive it by shelling out, plus four behavioural fixes that the frontend needs.

Read `CLAUDE.md` first — it explains the architecture and the invariants (especially the DAG ordering in `store/git_store.rs` and the "no `.gittask/` working-tree file" rule). Do not violate them.

## Non-negotiable constraints

1. **`text` stays the default format.** Every existing human-facing output must be byte-identical when `--format` is absent or `text`. The existing test suite must pass untouched.
2. **Under `--format json`, stdout carries exactly one JSON document and nothing else.** No hints, no `Logger` lines, no automation chatter, no stray `println!`.
3. **Do not add an `--author` flag or any other way to supply an identity from outside.** Identity must keep coming from git config via `Actor::from_repo`. This is deliberate: the web frontend runs without auth, so a caller-supplied author would be forgeable. If you think a command needs an identity override, the answer is no — report the friction instead of working around it.
4. **No new runtime dependencies** unless genuinely unavoidable. `serde`, `serde_json`, `thiserror`, `anyhow`, `clap` are already present.

## Work items, in dependency order

### 1. Error taxonomy + response envelope (foundation — do this first)

Add a typed error classification and a single response envelope used by every command.

```rust
// suggested: src/output/mod.rs
#[derive(Serialize)]
#[serde(untagged)]
pub enum CliResponse<T> { Ok(CliOk<T>), Err(CliErr) }

pub struct CliOk<T> { ok: bool /* always true */, command: String, version: String,
                      data: T, warnings: Vec<CliWarning> }
pub struct CliErr   { ok: bool /* always false */, command: String, version: String,
                      error: CliError, warnings: Vec<CliWarning> }

pub struct CliError {
    kind: CliErrorKind,
    message: String,        // anyhow top-level, no "✖ Error:" prefix, no ANSI
    causes: Vec<String>,    // err.chain().skip(1), outermost first
    #[serde(skip_serializing_if = "Option::is_none")]
    context: Option<BTreeMap<String, ContextValue>>,  // string or string[]
}

#[derive(Serialize)] #[serde(rename_all = "snake_case")]
pub enum CliErrorKind {
    NotARepo,        // ctx: { path }
    IdentityMissing, // ctx: { path, missing: ["user.name", …], config_files: [...] }
    NotFound,        // ctx: { query, entity: "task"|"repo"|"project"|"remote"|"comment" }
    AmbiguousId,     // ctx: { query, matches: [full ids] }
    Validation,      // ctx: { field?, missing?: [...] }
    Conflict, Rejected, Remote, Io, Internal,
}

pub struct CliWarning { message: String, detail: Option<String>, scope: Option<String> }
```

`version` is the crate version. `command` is the invoked path, space-joined: `"ls"`, `"config show"`, `"project create"`.

**Classification.** Define a `thiserror` enum for the classifiable failures and attach it via `anyhow::Context`, so `lib.rs::run` can `downcast_ref` at the top level. Wire it at least at these sites:

- `git::repo::discover_current` / `open` failure → `NotARepo` with `context.path`
- `Actor::from_repo` failure (`src/actor.rs:14`) → `IdentityMissing`. Populate `missing` with whichever of `user.name`/`user.email` is absent, and `config_files` with the paths libgit2 actually consulted (`git2::Config::find_global`, `find_system`, plus `<workdir>/.git/config`). The frontend shows the user the exact file to edit, so this context is the whole point.
- `Store::resolve` ambiguity (`src/store/git_store.rs:112`) → `AmbiguousId` with every matching full id
- `Store::resolve` no-match → `NotFound` with `entity: "task"`
- registry lookups in `ls.rs`, `unregister.rs`, `project.rs` → `NotFound` with the right `entity`
- `identity::validate_email`, priority/kind parse failures, `new.rs`'s missing-required-fields bail → `Validation` (populate `missing` for the latter)
- duplicate-name and already-exists bails (`GlobalConfig::register`, `create_project`, `rename_project`) → `Conflict`
- `find_remote` failure and any transport/auth error → `Remote`

Anything unclassified is `Internal`. That is acceptable — do not contort the code to classify exhaustively.

**Error path.** On error with `--format json`: print the `CliErr` document to **stdout** as valid JSON and **still exit 1**. stderr may keep the existing human `✖ Error:` line. Without `--format json`, behaviour is unchanged.

**Warnings.** Anywhere the code currently calls `Logger::warn` and continues (notably the two skip-a-repo sites in `src/cli/ls.rs:133` and `:139`), collect a `CliWarning` instead when in JSON mode and emit it in the envelope. The command still exits 0.

### 2. Global `--format` flag + output suppression

Add `--format <text|json>` as a **global** arg on `Cli` alongside `--no-hints`. The per-command `--format` on `show` and `export` should be folded into the global one (keep accepting it positionally-compatible if that's cheap; a breaking change here is acceptable — see item 8).

Route it through a process-wide output mode (a `OnceLock<Format>` set in `lib.rs::run` before dispatch is fine — this is a CLI, not a library server).

Then plug every stdout leak:

- `hints::print` (`src/hints.rs:34`) — no-op in JSON mode.
- `Logger::info` / `Logger::plain` (`src/logger.rs:59,73`) — suppressed in JSON mode. `warn` becomes a collected `CliWarning`; `error` is superseded by the error envelope.
- **`automation::engine`** (`src/automation/engine.rs:46,61,75,83`) — this is the sharpest edge. Change `run` from `Result<()>` to `Result<Vec<AutomationEvent>>` and let the caller decide how to render:
  ```rust
  pub struct AutomationEvent { rule: String, actions: Vec<String>, ops: Vec<String>, error: Option<String> }
  ```
  Text mode prints exactly what it prints today, from the caller. JSON mode puts it in `MutationJson.automation`.
- `render::*` and `table::*` are only reached in text mode — leave them alone.

Verify by grepping for `println!`/`eprintln!` outside `logger.rs`, `hints.rs`, `render/`, `table.rs`, `banner.rs`, `prompt.rs`, and the wizard modules. Every remaining hit must be unreachable in JSON mode.

### 3. Enriched task payload

Every command returning a task returns this shape. Four fields are new; the frontend **cannot derive any of them**, which is why they belong here.

```jsonc
{
  "id": "<40-hex creation-commit oid>",
  "display_id": "SRV-1a2b3c4d",     // NEW — id::display(&key, &id)
  "key": "SRV",                     // NEW — from the refs/tasks/config chain
  "title": "…", "description": "…",
  "kind": "bug|story|task|epic|subtask",
  "status": "…",                    // free-form, unchanged
  "priority": "low|medium|high|null",
  "assignee": "a@b.com|null",
  "assignee_name": "Ada L.|null",   // NEW — identity::display_name, null iff assignee null
  "reporter": "a@b.com",
  "reporter_name": "Ada L.",        // NEW
  "labels": ["…"],                  // BTreeSet → array, already sorted
  "due": "…|null", "milestone": "…|null",
  "parent": "<40-hex>|null",
  "parent_display_id": "SRV-9f8e7d6c|null",  // NEW
  "links": [{ "kind": "blocks|relates|dup", "target": "<40-hex>",
              "target_display_id": "SRV-…" }],   // target_display_id NEW
  "comments": [{ "id": 1, "author": "a@b.com", "author_name": "Ada L.",  // author_name NEW
                 "timestamp": 1785691774, "text": "…", "edited": false }],
  "deleted": false, "created": 1785691774, "updated": 1785691870,
  "history": [ /* only where stated below */ ]
}
```

`history` keeps its current flat shape — `#[serde(tag = "op")]` + `#[serde(flatten)]` on `OpEnvelope`, producing `{ author, timestamp, op: "SetStatus", status: "doing" }`. **Do not nest it.**

`identity::contributor_directory` is already built once per repo inside `ls::collect_rows`, so the `*_name` resolutions are nearly free — build it once per repo and thread it through.

### 4. Per-command JSON payloads

Priority order is P0 → P1. `data` is the envelope's payload field.

**`ls --format json [--with-history]` — P0.** Grouped by repo, not a flat row list.
```jsonc
{ "scope": { "mode": "here|registry", "repo_count": 3, "branch": "main|null" },
  "filters_applied": { "status": "…", "assignee": "…", "label": "…",
                       "kind": "…", "parent": "…", "mine": true, "deleted": false },
  "repos": [ { "name": "api", "project": "main", "path": "/abs/path",
               "key": "SRV", "branch": "main|null", "tasks": [ /* TaskJson */ ] } ],
  "contributors": { "a@b.com": "Ada L." },   // unioned across repos
  "statuses": ["todo","doing","done"],       // distinct observed, sorted, across ALL repos
  "total": 42 }
```
`--with-history` (default off) controls whether `tasks[].history` is included; keep `ls` payloads small by default. `statuses` drives the frontend's kanban columns — it must be the distinct set actually observed, not a guess. Unopenable repos become `warnings[]` entries with `scope` set to the repo name, and `ls` still exits 0.

**Mutations — `new`, `edit`, `status`, `comment`, `label`, `epic`, `link`, `delete` — P0.** One shape for all:
```jsonc
{ "task": { /* TaskJson, history omitted, state AFTER automation settles */ },
  "ops": ["SetStatus"],                    // op tags from the user's action
  "automation": [ { "rule": "auto-assign", "actions": ["set_assignee a@b.com"],
                    "ops": ["SetAssignee"], "error": null } ],
  "created": true }                        // present only on `new`
```
Build `task` by re-loading **after** automation has run — a rule can change the status you just set, and the caller must see the final state.

This is also what makes `new` usable at all from a program: today it prints only `Created #SRV-9057e58a [TASK] "…"`, so there is no way to learn the new task's id. Returning the full task fixes that.

`drop` is the exception (the task no longer exists):
```jsonc
{ "id": "<40-hex>", "display_id": "SRV-…", "title": "…", "kind": "task",
  "remote_deleted": "origin|null" }
```

**`repos --format json [--deep]` — P0.**
```jsonc
{ "config_dir": "/abs/resolved/path", "default_project": "main",
  "projects": ["main","infra"],
  "repos": [ { "name": "api", "path": "/abs", "project": "main",
    // --deep only; null when shallow:
    "exists": true, "openable": true, "key": "SRV", "branch": "main",
    "task_count": 42, "open_task_count": 30,
    "remotes": [ { "name": "origin", "url": "git@…", "push_url": null } ],
    "identity": { "name": "Ada L.", "email": "a@b.com", "ok": true,
                  "source": "repo|global|system|none" },
    "error": null } ] }
```
`--deep` must **never fail** because one repo is unopenable — set `openable: false`, fill `error`, add a `warnings[]` entry, continue. `config_dir` must be the actually-resolved path (the frontend asserts it at boot to catch env misconfiguration).

**`whoami --format json` — P0, new command.**
```jsonc
{ "repo": { "name": …, "email": …, "ok": true, "source": "repo" },   // omitted outside a repo
  "global": { … },
  "effective": { … } }   // exactly what Actor::from_repo would produce; ok:false if it would error
```
This is how the frontend shows "committing as X" and blocks a write *before* it fails. Since there is no `--author` flag (constraint 3), this is the only identity surface — treat it as P0, not a nicety. `IdentityJson.source` says which config file won.

**Registry mutations — `register`, `unregister`, `project create|rename|set-default|delete` — P0.** Each returns the complete new (shallow) registry so a caller refreshes in one round trip:
```jsonc
{ "action": "registered|moved|noop|unregistered|project_created|project_renamed|project_deleted|default_set",
  "name": "api", "project": "main", "previous_project": "infra",
  "registry": { /* RegistryJson, shallow */ } }
```
`"noop"` matters: `src/cli/register.rs:34` has two paths that exit 0 with only an info message — "already in project X, nothing to do", and the non-interactive "pass `--project` to move it". A caller currently cannot distinguish either from a real change. Also make sure `--format json` never re-enters `wizard::prompt_project`.

**Sync — `push`, `pull`, `clone` — P0.**
```jsonc
// push
{ "remote": "origin", "attempted": 12, "pushed": 12, "config_ref_pushed": true,
  "nothing_to_push": false,
  "refs":     [ { "ref": "refs/tasks/<40hex>", "task_id": "…", "display_id": "SRV-…",
                  "status": "ok|rejected", "message": null } ],
  "rejected": [ /* same shape, from the push_update_reference callback */ ] }
// pull
{ "remote": "origin",
  "counts": { "new": 2, "fast_forwarded": 1, "merged": 1, "up_to_date": 8 },
  "config": "new|fast_forwarded|merged|up_to_date|null",
  "tasks": [ { "id": "…", "display_id": "SRV-…", "outcome": "merged" } ] }
// clone
{ "url": "…", "dir": "/ABSOLUTE/canonicalised/path", "task_count": 42, "key": "SRV|null" }
```
`clone`'s `dir` **must be absolute and canonicalised** — the CLI derives the default `<repo>-tasks` name itself (`src/cli/clone.rs:52`), so a caller has no way to know where the clone landed. Push rejection stays an error (`ok:false`, `kind:"rejected"`, `context.refs` listing the rejected refs) because it needs a user decision. `nothing_to_push` still exits 0.

**`projects --format json` — P1.** `{ "default_project": "main", "projects": [ { "name": "main", "repos": ["api","web"] } ] }`

**`config show|key|field|rule --format json` — P1.**
```jsonc
{ "key": "SRV", "key_source": "config|derived",
  "fields": { "priority": { "required": true, "source": "repo|global|default" },
              "assignee": { … }, "due": { … } },
  "rules": [ { "scope": "global|repo", "name": "…", "on": "…",
               "when": "…|null", "actions": ["…"] } ] }
```
`config key`, `config field`, and `config rule add|remove` return `{ "config": { …same… } }`.

**`log`** needs no JSON — `show`'s `history` is strictly richer than `render::to_log`.

### 5. `Clear*` operations (highest-value behavioural fix)

There is currently **no way to unset `assignee`, `priority`, `due`, or `milestone`** — only `ClearParent` exists. A task board where you can assign but never unassign is broken, so this ranks above some of the JSON work.

- Add `ClearAssignee`, `ClearPriority`, `ClearDueDate`, `ClearMilestone` to `Operation` (`src/domain/op.rs`), following `ClearParent`'s existing pattern exactly.
- Add the fold arms in `src/domain/fold.rs` setting each field to `None`.
- Add `edit --clear-assignee --clear-priority --clear-due --clear-milestone`. Setting and clearing the same field in one invocation is a `Validation` error.
- Old op-chains must still fold identically. Add a test that a chain written before this change loads unchanged.

### 6. `new --status <STATUS>`

`new` always lands on `DEFAULT_STATUS` ("todo"), so "create a task directly in this column" is currently two commands and two op packages — two chances for an interleaved write. Add `--status`, emitting `SetStatus` in the same op package as `CreateTask`. Free-form, same validation as the `status` command.

### 7. Compare-and-swap in `Store::append` (recommended)

`src/store/git_store.rs:52` reads the tip, builds a commit on it, then calls `set_ref(force = true)`. Two concurrent appends to the same task both parent off tip `A` and the second force-overwrites the first — one op package is silently orphaned: unreachable, unmerged, absent from `load`.

Fix: use `Repository::reference_matching` with the observed tip as the expected current value, so a racing write fails loudly instead of vanishing. Retry once by re-reading the tip and rebuilding, then surface a `Conflict` error. Roughly ten lines, and it is the only real fix — a caller-side mutex can't protect against a concurrent terminal invocation.

Note this affects `append_chain` (the config ref) the same way, and that `automation::engine` is itself a second writer to the same task within one process.

### 8. Tests and compatibility

- Every existing test must pass with no modification. If one needs changing, stop and explain why before changing it.
- Add integration tests under `tests/` following the existing `tests/common/mod.rs` fixture pattern: for each command, run with `--format json`, parse with `serde_json`, and assert the documented shape and key values.
- Add a test asserting stdout is **exactly one** parseable JSON document for a mutation on a repo **with an automation rule that fires** — that is the regression that item 2 exists to prevent.
- Add error-path tests: ambiguous id prefix, missing task, missing identity, missing required field. Assert `ok:false`, exit code 1, and the correct `kind`.
- `show --format json` and `export --format json` currently emit a bare `Task` / `Task[]`. Wrapping them in the envelope **is a breaking change** and is intended — one shape everywhere beats a permanent two-format tax. Note it in the README and in the release notes.

## Suggested commit sequence

Each commit should build and pass tests on its own.

1. `feat(output): error taxonomy and response envelope`
2. `feat(cli): global --format flag, suppress non-JSON stdout`  (includes the `automation::engine` return-type change)
3. `feat(json): enrich task payload with display_id, key, resolved names`
4. `feat(json): ls --format json`  ·  5. `feat(json): repos --format json --deep`  ·  6. `feat(cli): whoami command`
7. `feat(json): mutation payloads`  ·  8. `feat(json): registry and project mutations`
9. `feat(json): push, pull, clone`  ·  10. `feat(json): config show and mutations`
11. `feat(domain): ClearAssignee/ClearPriority/ClearDueDate/ClearMilestone ops`
12. `feat(cli): new --status`  ·  13. `fix(store): compare-and-swap on ref update`

Commits 1–6 unblock the frontend's read path; 7–8 unblock writes. If you have to stop early, stop on a numbered boundary.

## Report back

- Anything you could not classify into a `CliErrorKind` without contorting the code.
- Any stdout leak you found that this brief did not list.
- Whether `reference_matching` in item 7 interacts badly with the merge path in `store/merge.rs` (`pull` writes two-parent merge commits — confirm the CAS doesn't break reconciliation).
- Anything in this brief that conflicts with `CLAUDE.md`. `CLAUDE.md` wins; tell me what you changed.
