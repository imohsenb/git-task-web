<p align="center">
  <img src="src/web/public/favicon.svg" width="72" height="72" alt="Git Task logo" />
</p>
<h1 align="center">Git Task</h1>

<p align="center">A local web UI for <a href="https://github.com/">git-task</a> — board, list, and table views over tasks stored in <code>refs/tasks/*</code>. No database, no server-side state: every read and write goes through the real <code>git-task</code> CLI.</p>

## Get started

```sh
brew install imohsenb/tap/git-task   # the CLI this UI drives
npm install
npm run dev
```

Open `http://localhost:5173`. Vite (`:5173`) proxies `/api` to the Fastify server (`:4600`); both hot-reload.

Needs Node.js 20+ and `git-task` (or `gtask`) on `PATH` — resolved via `GIT_TASK_BIN` → `which git-task` →
`which gtask` → `~/.cargo/bin/git-task`.

For a production-style run:

```sh
npm run build   # tsc → dist/server, vite build → dist/web
npm start       # one process, one port: static UI + API
```

## What it does

- **Board / List / Table** — filters and search kept in the URL.
- **Milestones** — tasks grouped by `milestone`.
- **Members** — read-only directory of assignees/reporters/commenters, with per-person counts.
- **Home** — tasks assigned to you, and recent activity, across every registered repo.
- **Repo & project management** — register by path, clone by URL, move repos between projects.
- **Sync** — push/pull per repo, "pull first" on a rejected push, sync-all.
- **Live updates** — SSE invalidates the UI when a write lands, from this app or a terminal `git task`.

Keyboard: `c` new task, `/` search, `Esc` close dialog, arrow keys move focus on the board.

## Configuration

All environment variables, no CLI flags:

| Variable | Default | |
|---|---|---|
| `GIT_TASK_WEB_PORT` | `4600` | |
| `GIT_TASK_WEB_HOST` | `127.0.0.1` | Only bind `0.0.0.0` behind an authenticating proxy — see Security. |
| `GIT_TASK_WEB_DATA_DIR` | `~/.local/share/git-task-web` | UI prefs only, nothing task-related. |
| `GIT_TASK_CONFIG_DIR` | `~/.config/git-task` | git-task's own registry — set to match your terminal's `git task`. |
| `GIT_TASK_BIN` | discovered on `PATH` | Pin a specific binary. |
| `LOG_LEVEL` | `info` | Pino level. |

## Identity, credentials, security

Writes are attributed to whatever `git` resolves for the server process (repo `user.name`/`user.email`,
falling back to global config) — repos with no resolvable identity are blocked from writing rather than
committing as `nobody`. Push/pull reuse whatever credential helper or SSH agent the server already has;
tokens embedded in a remote URL are masked before reaching the browser.

This is a **single-user, no-auth** tool — anyone reaching the port can read/write every registered repo.
Keep `GIT_TASK_WEB_HOST` at `127.0.0.1` unless fronted by an authenticating proxy. All `git-task` calls go
through argv arrays, never shell interpolation. Writes to a repo are serialized behind a per-repo lock in
this process — a concurrent terminal `git task` isn't covered by that lock (see `PLAN.md` §8).

## Development

```sh
npm run typecheck   # tsc, server + web, no emit
npm run test         # vitest — server tests run the real git-task binary against throwaway repos
```

`PLAN.md` has the full design doc; `docs/cli-json-contract.md` has the JSON shape of every command this
app relies on.
