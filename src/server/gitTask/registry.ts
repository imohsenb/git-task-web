import { reposDeep, type GitTaskContext } from "./commands.js";
import type { GitTaskResult } from "./executor.js";
import { GitTaskError } from "./errors.js";
import type { RegistryJson, RegistryRepoJson } from "../../shared/contract.js";

/** §3.4: "the deep registry 5s" TTL. Keyed by configDir — that's the registry's real
 * identity (one config.toml per configDir). In production there's exactly one
 * configDir for the process lifetime, but keying defends against ever mixing two
 * registries' results, and it's what makes this module testable in isolation. */
const TTL_MS = 5_000;

interface CacheEntry {
  result: GitTaskResult<RegistryJson>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const CREDENTIAL_URL_PATTERN = /^(https?:\/\/)([^@/]+)@(.+)$/i;

/** §3.2 option B: a PAT (or user:pass) embedded in a remote URL must never reach the
 * client unmasked — it'd sit in every /api/registry response body, visible in devtools'
 * network tab and browser history, indefinitely. SSH URLs (`git@host:...`,
 * `ssh://...`) carry no embedded credential — auth goes through the agent — so they
 * pass through untouched. Nothing server-side needs the raw URL back: push/pull always
 * address a remote by its configured *name* ("origin"), never by URL. */
function maskRemoteUrl(url: string | null): string | null {
  if (!url) return url;
  const match = url.match(CREDENTIAL_URL_PATTERN);
  return match ? `${match[1]}***@${match[3]}` : url;
}

/** Applied to every RegistryJson before it leaves the server — both here and in
 * registryMutations.ts, which gets its own copy of the registry back from each
 * register/unregister/project mutation rather than through getRegistry(). */
export function maskRegistry(registry: RegistryJson): RegistryJson {
  return {
    ...registry,
    repos: registry.repos.map((repo) => ({
      ...repo,
      remotes: repo.remotes?.map((r) => ({ ...r, url: maskRemoteUrl(r.url), push_url: maskRemoteUrl(r.push_url) })) ?? null,
    })),
  };
}

/** Caches the full result (data + warnings) — §3.5: "--deep must never fail on an
 * unopenable repo — set openable:false + error + a warnings[] entry", and that
 * warnings entry needs to reach the HTTP response same as the data does. */
export async function getRegistry(
  ctx: GitTaskContext,
  opts: { force?: boolean } = {},
): Promise<GitTaskResult<RegistryJson>> {
  const now = Date.now();
  const cached = cache.get(ctx.configDir);
  if (!opts.force && cached && cached.expiresAt > now) {
    return cached.result;
  }
  const raw = await reposDeep(ctx);
  const result = { ...raw, data: maskRegistry(raw.data) };
  cache.set(ctx.configDir, { result, expiresAt: now + TTL_MS });
  return result;
}

/** Call after any registry mutation (register/unregister/project *) once those routes
 * exist — writes must invalidate eagerly rather than waiting out the TTL. Omit
 * configDir to clear everything (used by tests). */
export function invalidateRegistry(configDir?: string): void {
  if (configDir) cache.delete(configDir);
  else cache.clear();
}

/**
 * Registry lookup by name, without the openable gate — registry mutations (move
 * project, unregister) only need the registered path, not a working task store, so a
 * repo whose task store is broken can still be re-pathed or removed from the registry.
 */
export async function resolveRepoEntry(ctx: GitTaskContext, name: string): Promise<RegistryRepoJson> {
  const { data: registry } = await getRegistry(ctx);
  const repo = registry.repos.find((r) => r.name === name);
  if (!repo) {
    throw new GitTaskError({
      kind: "not_found",
      message: `no repo registered as '${name}'`,
      context: { query: name, entity: "repo" },
    });
  }
  return repo;
}

/**
 * The "R" lookup from the route table: repo name -> registered entry. Every per-repo
 * task route resolves through here — a route never accepts a filesystem path from the
 * client, only a registered name, so there is no path-traversal surface at this layer.
 */
export async function resolveRepo(ctx: GitTaskContext, name: string): Promise<RegistryRepoJson> {
  const repo = await resolveRepoEntry(ctx, name);
  if (repo.openable === false) {
    throw new GitTaskError({
      kind: "not_a_repo",
      message: repo.error ?? `repo '${name}' could not be opened`,
      context: { path: repo.path },
    });
  }
  return repo;
}
