<p align="center">
  <img src="src/web/public/favicon.svg" width="72" height="72" alt="Git Task logo" />
</p>
<h1 align="center">Git Task</h1>

A local web interface for [git-task](https://github.com/) — the git-native task manager. It's a thin
Fastify + React layer over the real `git-task` CLI: every read is a `--format json` invocation, every
write goes through the same binary you'd run in a terminal, so the UI and the CLI never disagree about
what a repo's tasks look like.

There's no database and no server-side task state — `refs/tasks/*` in your git repos is the only source
of truth. git-task-web just gives it a board.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [`git-task`](https://github.com/) (or `gtask`) on your `PATH`. git-task-web discovers it via, in order:
  `GIT_TASK_BIN` → `which git-task` → `which gtask` → `~/.cargo/bin/git-task`. If none of those resolve,
  the server refuses to start rather than fail confusingly on the first request.

## Quickstart

```sh
npm install
npm run dev
```

This starts the Fastify API on `:4600` and Vite on `:5173` (proxying `/api` to the backend), with both
processes hot-reloading. Open `http://localhost:5173`.

For a production-style run:

```sh
npm run build   # tsc → dist/server, vite build → dist/web
npm start       # serves dist/web statically + the API from dist/server, one process, one port
```

## Configuration

Everything is an environment variable — there are no CLI flags yet.

| Variable | Default | |
|---|---|---|
| `GIT_TASK_WEB_PORT` | `4600` | |
| `GIT_TASK_WEB_HOST` | `127.0.0.1` | Only bind `0.0.0.0` if you know what's reaching this port — see Security below. |
| `GIT_TASK_WEB_DATA_DIR` | `~/.local/share/git-task-web` | This app's own state: UI prefs (`ui.json`), nothing task-related. |
| `GIT_TASK_CONFIG_DIR` | `$XDG_CONFIG_HOME/git-task` or `~/.config/git-task` | git-task's own registry (`config.toml`) — set this explicitly if you want git-task-web to see the same registered repos as your terminal's `git task`. |
| `GIT_TASK_BIN` | discovered on `PATH` | Set this to pin a specific binary instead of relying on discovery. |
| `LOG_LEVEL` | `info` | Pino level (`debug`, `warn`, …). |

## What it does

- **Board / List / Table** — three views over one repo's tasks, filters and search kept in the URL.
- **Milestones** — groups a repo's tasks by their `milestone` field.
- **Members** — a read-only directory of everyone `ls` has seen as an assignee, reporter, or commenter,
  with per-person task counts. There's nothing to invite — git-task has no membership concept, just
  whoever shows up in the data.
- **Home** — tasks assigned to you and recently updated tasks, aggregated across every registered repo.
- **Repo & project management** — register a repo by path, clone one by URL, move repos between
  projects, all from Settings.
- **Sync** — push/pull per repo with a per-ref result report, a "pull first" prompt on a rejected push,
  and a sync-all shortcut.
- **Live updates** — an SSE stream invalidates the UI's cache when a write lands, whether it came from
  this app or a `git task` command run directly in a terminal.

Keyboard: `c` opens "new task" from a repo workspace, `/` focuses the current view's search box, `Esc`
closes the open dialog, and arrow keys move focus between cards on the board.

## Identity and credentials

git-task-web never asks who you are — every write is attributed to whatever `git` resolves for the
server process (repo-level `user.name`/`user.email`, falling back to global config). If a repo has no
resolvable identity, writes to it are blocked with a clear error instead of committing as `nobody`.

Similarly, push/pull use whatever credential helper or SSH agent the server process already has access
to — git-task-web doesn't prompt for or store credentials itself. Any remote embedding a token in its URL
is masked before it's ever sent to the browser.

## Security notes

- This is a **single-user, no-auth** tool by design — anyone who can reach the port can read and write
  every registered repo. Keep `GIT_TASK_WEB_HOST` at `127.0.0.1` (the default) unless you've put a proper
  authenticating proxy in front of it.
- All subprocess calls to `git-task` go through a single execa-based executor with argv arrays, never
  shell interpolation — user-supplied text (titles, comments, paths) can't break out into a shell command.
- Writes to a given repo are serialized behind a per-repo lock inside this process, but a `git task`
  command run concurrently in a terminal is not covered by that lock — see `PLAN.md` §8 for the known
  gaps carried into v1.

## Development

```sh
npm run typecheck   # tsc, both server and web tsconfigs, no emit
npm run test         # vitest — server tests run the real git-task binary against throwaway repos
```

See `PLAN.md` for the full design doc (CLI JSON contract, architecture, build order) and
`docs/cli-json-contract.md` for the JSON shape of every command this app relies on.
