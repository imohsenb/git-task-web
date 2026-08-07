import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { pullRepo, pushRepo, type GitTaskContext } from "../gitTask/commands.js";
import { withRepoLock } from "../gitTask/locks.js";
import { DEFAULT_TIMEOUT_MS } from "../gitTask/executor.js";
import { invalidateLsCache } from "../gitTask/lsCache.js";
import { notifyRepoChanged } from "../gitTask/sse.js";
import { resolveRepo } from "../gitTask/registry.js";
import { dataDirContext, repoContext } from "../gitTask/context.js";
import { GitTaskError } from "../gitTask/errors.js";
import { NAME_MAX_LEN, repoParamSchema } from "./paramSchemas.js";
import type { ResolvedEnv } from "../env.js";
import type { PullJson, PushJson } from "../../shared/contract.js";

const remoteBodySchema = z.object({ remote: z.string().min(1).max(NAME_MAX_LEN).optional() });

const syncBodySchema = z.object({
  repos: z.array(z.string().min(1).max(NAME_MAX_LEN)).min(1).max(100),
  op: z.enum(["push", "pull"]),
  remote: z.string().min(1).max(NAME_MAX_LEN).optional(),
});

interface SyncItemResult {
  repo: string;
  ok: boolean;
  data?: PushJson | PullJson;
  error?: { kind: string; message: string };
}

export function registerSyncRoutes(rawApp: FastifyInstance, env: ResolvedEnv) {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  /** Same **W** per-repo write lock as taskMutations.ts's write() (push/pull touch
   * the same refs a task write would), plus the SSE notify every other write route
   * already does — a pull can change what `ls` returns just as much as an edit can. */
  async function writeRepo<T>(name: string, fn: (ctx: GitTaskContext) => Promise<T>): Promise<T> {
    const repo = await resolveRepo(dataDirContext(env), name);
    const ctx = repoContext(env, repo.path);
    const result = await withRepoLock(repo.path, DEFAULT_TIMEOUT_MS, () => fn(ctx));
    invalidateLsCache(repo.path);
    notifyRepoChanged(repo.name, repo.path);
    return result;
  }

  app.post("/api/repos/:name/push", { schema: { params: repoParamSchema, body: remoteBodySchema } }, async (request) => {
    const { data, warnings } = await writeRepo(request.params.name, (ctx) => pushRepo(ctx, request.body.remote));
    return { data, warnings };
  });

  app.post("/api/repos/:name/pull", { schema: { params: repoParamSchema, body: remoteBodySchema } }, async (request) => {
    const { data, warnings } = await writeRepo(request.params.name, (ctx) => pullRepo(ctx, request.body.remote));
    return { data, warnings };
  });

  /** "sync-all" (PLAN.md §6 Phase 6) — sequential, not parallel: these already
   * serialise per-repo via writeRepo's lock, and running N repos' git subprocesses at
   * once for a single-user local tool buys nothing but a confusing interleaved log.
   * One repo's failure doesn't stop the rest; each gets its own ok/error entry. */
  app.post("/api/sync", { schema: { body: syncBodySchema } }, async (request) => {
    const { repos, op, remote } = request.body;
    const results: SyncItemResult[] = [];

    for (const name of repos) {
      try {
        const data =
          op === "push"
            ? (await writeRepo(name, (ctx) => pushRepo(ctx, remote))).data
            : (await writeRepo(name, (ctx) => pullRepo(ctx, remote))).data;
        results.push({ repo: name, ok: true, data });
      } catch (err) {
        const kind = err instanceof GitTaskError ? err.kind : "internal";
        const message = err instanceof Error ? err.message : "sync failed";
        results.push({ repo: name, ok: false, error: { kind, message } });
      }
    }

    return { data: { op, results }, warnings: [] };
  });
}
