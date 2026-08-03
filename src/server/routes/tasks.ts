import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { lsAll, lsProject, show, type LsFilters } from "../gitTask/commands.js";
import { cachedLsHere } from "../gitTask/lsCache.js";
import { resolveRepo } from "../gitTask/registry.js";
import { dataDirContext, repoContext } from "../gitTask/context.js";
import { taskKindSchema } from "../../shared/contract.zod.js";
import type { ResolvedEnv } from "../env.js";

/** Query strings arrive as strings; this normalises the handful of truthy/falsy
 * spellings a browser or curl might send ("", "1", "true") into a real boolean
 * without the z.coerce.boolean() footgun (which treats "false" as truthy — any
 * non-empty string coerces to true). Anything else fails validation instead of
 * silently guessing. */
const booleanQueryParam = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === "" || value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return value;
}, z.boolean().optional());

const NAME_MAX_LEN = 200;

const lsQuerySchema = z.object({
  status: z.string().min(1).max(NAME_MAX_LEN).optional(),
  assignee: z.string().min(1).max(NAME_MAX_LEN).optional(),
  label: z.string().min(1).max(NAME_MAX_LEN).optional(),
  kind: taskKindSchema.optional(),
  parent: z.string().min(1).max(NAME_MAX_LEN).optional(),
  mine: booleanQueryParam,
  deleted: booleanQueryParam,
  withHistory: booleanQueryParam,
});

const tasksAllQuerySchema = lsQuerySchema.extend({
  project: z.string().min(1).max(NAME_MAX_LEN).optional(),
});

const repoParamSchema = z.object({
  name: z.string().min(1).max(NAME_MAX_LEN),
});

const repoTaskParamSchema = repoParamSchema.extend({
  id: z.string().min(1).max(NAME_MAX_LEN),
});

function toFilters(query: z.infer<typeof lsQuerySchema>): LsFilters {
  return {
    status: query.status,
    assignee: query.assignee,
    label: query.label,
    kind: query.kind,
    parent: query.parent,
    mine: query.mine,
    deleted: query.deleted,
    withHistory: query.withHistory,
  };
}

export function registerTasksRoutes(rawApp: FastifyInstance, env: ResolvedEnv) {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/api/repos/:name/tasks",
    { schema: { params: repoParamSchema, querystring: lsQuerySchema } },
    async (request) => {
      const repo = await resolveRepo(dataDirContext(env), request.params.name);
      const { data, warnings } = await cachedLsHere(repoContext(env, repo.path), toFilters(request.query));
      return { data, warnings };
    },
  );

  app.get("/api/tasks", { schema: { querystring: tasksAllQuerySchema } }, async (request) => {
    const { project, ...rest } = request.query;
    const filters = toFilters(rest);
    const ctx = dataDirContext(env);
    const { data, warnings } = project ? await lsProject(ctx, project, filters) : await lsAll(ctx, filters);
    return { data, warnings };
  });

  app.get(
    "/api/repos/:name/tasks/:id",
    { schema: { params: repoTaskParamSchema } },
    async (request) => {
      const repo = await resolveRepo(dataDirContext(env), request.params.name);
      const { data, warnings } = await show(repoContext(env, repo.path), request.params.id);
      return { data, warnings };
    },
  );
}
