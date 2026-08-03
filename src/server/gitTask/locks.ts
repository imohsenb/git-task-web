import { Mutex, withTimeout } from "async-mutex";
import { GitTaskError } from "./errors.js";

/** Ground truth: Store::append has no compare-and-swap, so all writes to one repo
 * must serialise through this process. Not per-task — the config ref is repo-scoped
 * and epic/link ops touch two tasks. */
const MAX_QUEUE_DEPTH = 32;

interface RepoLock {
  mutex: Mutex;
  waiting: number;
}

const locks = new Map<string, RepoLock>();

function getLock(repoPath: string): RepoLock {
  let lock = locks.get(repoPath);
  if (!lock) {
    lock = { mutex: new Mutex(), waiting: 0 };
    locks.set(repoPath, lock);
  }
  return lock;
}

/**
 * Runs `fn` holding the write lock for `repoPath`. Caller must pass a canonical
 * absolute path — two different strings for the same repo would defeat the lock.
 */
export async function withRepoLock<T>(repoPath: string, timeoutMs: number, fn: () => Promise<T>): Promise<T> {
  const lock = getLock(repoPath);

  if (lock.waiting >= MAX_QUEUE_DEPTH) {
    throw new GitTaskError({
      kind: "queue_full",
      message: `too many pending writes for this repo (>${MAX_QUEUE_DEPTH} queued) — try again shortly`,
    });
  }

  lock.waiting++;
  let release: () => void;
  try {
    release = await withTimeout(lock.mutex, timeoutMs).acquire();
  } catch {
    throw new GitTaskError({
      kind: "lock_timeout",
      message: `timed out waiting for the write lock on this repo after ${timeoutMs}ms`,
    });
  } finally {
    lock.waiting--;
  }

  try {
    return await fn();
  } finally {
    release();
  }
}
