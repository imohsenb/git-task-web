# Contributing

## Setup

Prerequisites: Node.js 20+, and `git-task` (or `gtask`) on your `PATH`.

```sh
npm install
npm run dev
```

This starts the Fastify API on `:4600` and Vite on `:5173` (proxying `/api` to the backend), both
hot-reloading. Open `http://localhost:5173`.

For a production-style run:

```sh
npm run build   # tsc to dist/server, vite build to dist/web
npm start       # one process, one port: static UI + API
```

## Checks

```sh
npm run typecheck   # tsc, server + web, no emit
npm run test         # vitest; server tests run the real git-task binary against throwaway repos
```

`PLAN.md` has the full design doc; `docs/cli-json-contract.md` has the JSON shape of every `git-task`
command this app relies on.

## Architecture notes

- No database, no server-side task state: `refs/tasks/*` in your git repos is the source of truth.
  Every read is a `git-task --format json` call; every write goes through the same binary.
- Identity: writes are attributed to whatever `git` resolves for the server process
  (repo `user.name`/`user.email`, falling back to global config). A repo with no resolvable identity is
  blocked from writing rather than committing as `nobody`.
- Credentials: push/pull reuse whatever credential helper or SSH agent the server process already has;
  this app never prompts for or stores credentials itself. A remote URL with an embedded token is masked
  before it reaches the browser.
- Subprocess safety: all calls to `git-task` go through a single execa-based executor using argv arrays,
  never shell interpolation, so user-supplied text (titles, comments, paths) can't break out into a shell
  command.
- Locking: writes to a given repo are serialized behind a per-repo lock inside this process, but a
  `git task` command run concurrently in a terminal isn't covered by that lock. See `PLAN.md` §8 for the
  known gaps carried into v1.

## CI

- `verify.yml` runs typecheck, test, and build on every push and pull request, and requires the
  `package.json` version to be bumped above `main`'s on any PR targeting `main`.
- `publish.yml` runs on push to `main`. If the current `package.json` version isn't already on npm, it
  publishes it, then tags the commit and creates a GitHub Release.
