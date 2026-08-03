import { computeRefDigest } from "./refDigest.js";
import { lsHere, type GitTaskContext, type LsFilters } from "./commands.js";
import type { GitTaskResult } from "./executor.js";
import type { LsJson } from "../../shared/contract.js";

/**
 * §3.4. Two layers:
 *  - digest cache: computeRefDigest does a filesystem read per call, so its result is
 *    itself cached for a couple seconds to absorb request bursts.
 *  - ls result cache: keyed by (repoPath, digest, filters). A digest change (a write,
 *    from this server or a concurrent terminal) discards that repo's whole filter-keyed
 *    submap immediately, rather than leaking old-digest entries indefinitely.
 * Only covers `ls --here` (single repo) — `--all`/`--project` span multiple repos'
 * digests at once and aren't cached here; see Known gap #4 in PLAN.md.
 */
const DIGEST_TTL_MS = 2_000;

interface DigestCacheEntry {
  digest: string;
  expiresAt: number;
}

const digestCache = new Map<string, DigestCacheEntry>();

function getDigest(repoPath: string): string {
  const now = Date.now();
  const cached = digestCache.get(repoPath);
  if (cached && cached.expiresAt > now) return cached.digest;
  const digest = computeRefDigest(repoPath);
  digestCache.set(repoPath, { digest, expiresAt: now + DIGEST_TTL_MS });
  return digest;
}

interface RepoLsCache {
  digest: string;
  entries: Map<string, GitTaskResult<LsJson>>;
}

const lsCache = new Map<string, RepoLsCache>();

function filtersKey(filters?: LsFilters): string {
  if (!filters) return "";
  const sortedEntries = Object.entries(filters)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(sortedEntries);
}

export async function cachedLsHere(ctx: GitTaskContext, filters?: LsFilters): Promise<GitTaskResult<LsJson>> {
  const repoPath = ctx.cwd;
  const digest = getDigest(repoPath);

  let repoCache = lsCache.get(repoPath);
  if (!repoCache || repoCache.digest !== digest) {
    repoCache = { digest, entries: new Map() };
    lsCache.set(repoPath, repoCache);
  }

  const key = filtersKey(filters);
  const cached = repoCache.entries.get(key);
  if (cached) return cached;

  const result = await lsHere(ctx, filters);
  repoCache.entries.set(key, result);
  return result;
}

/** Call after a write to repoPath, and on server boot per repo — writes invalidate
 * eagerly rather than waiting out the digest TTL. Omit repoPath to clear everything. */
export function invalidateLsCache(repoPath?: string): void {
  if (repoPath) {
    lsCache.delete(repoPath);
    digestCache.delete(repoPath);
  } else {
    lsCache.clear();
    digestCache.clear();
  }
}
