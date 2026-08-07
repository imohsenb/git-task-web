<p align="center">
  <img src="src/web/public/favicon.svg" width="72" height="72" alt="Git Task logo" />
</p>
<h1 align="center">Git Task</h1>

<p align="center">A local web app for managing tasks tracked in your git repos with <a href="https://github.com/">git-task</a>. Board, list, and table views, milestones, members, and sync, all backed by your own repo. No database, no account, nothing to host.</p>

<p align="center"><a href="https://www.npmjs.com/package/git-task-web">npm</a></p>

## Install

You'll need the `git-task` CLI first:

```sh
brew install imohsenb/tap/git-task
```

Then install Git Task itself:

```sh
npm install -g git-task-web
```

## Usage

```sh
git-task-web
```

Open `http://localhost:4600`. Register a repo from Settings (by local path, or clone one by URL), and
you're on the board.

## What you can do

- **Board, List, and Table views**, with filters and search.
- **Milestones**, tasks grouped by their milestone.
- **Members**, a directory of everyone who's shown up as an assignee, reporter, or commenter.
- **Home**, tasks assigned to you and recent activity, across every repo you've registered.
- **Sync**, push and pull per repo, with a one-click sync-all.
- **Live updates**, the UI stays current whether a change came from this app or from `git task` in a
  terminal.

Keyboard shortcuts: `c` for a new task, `/` to search, `Esc` to close a dialog, arrow keys to move
around the board.

## Configuration

Everything is an environment variable:

| Variable | Default | |
|---|---|---|
| `GIT_TASK_WEB_PORT` | `4600` | |
| `GIT_TASK_WEB_HOST` | `127.0.0.1` | Only bind `0.0.0.0` if you're putting an authenticating proxy in front of it. |
| `GIT_TASK_WEB_DATA_DIR` | `~/.local/share/git-task-web` | This app's own UI preferences, nothing task-related. |
| `GIT_TASK_CONFIG_DIR` | `~/.config/git-task` | git-task's own registry; set this to match your terminal's `git task`. |
| `GIT_TASK_BIN` | discovered on `PATH` | Pin a specific binary. |
| `LOG_LEVEL` | `info` | Pino level. |

## Security

This is a single-user tool with no login. Anyone who can reach the port can read and write every repo
you've registered, so keep `GIT_TASK_WEB_HOST` at `127.0.0.1` unless you've put a proper authenticating
proxy in front of it.

## License

MIT, see [LICENSE.md](LICENSE.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, tests, and design docs.
