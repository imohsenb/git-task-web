import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { fields, lsAll, lsProject, show, type LsFilters } from "../gitTask/commands.js";
import { cachedLsHere } from "../gitTask/lsCache.js";
import { resolveRepo } from "../gitTask/registry.js";
import { dataDirContext, repoContext } from "../gitTask/context.js";
import { taskKindSchema } from "../../shared/contract.zod.js";
import { booleanQueryParam, NAME_MAX_LEN, repoParamSchema, repoTaskParamSchema } from "./paramSchemas.js";
import type { ResolvedEnv } from "../env.js";
import type { LiteLsJson, LsJson } from "../../shared/contract.js";

/** Strips each task down to {id, display_id, title} before it leaves the
 * process — GTASK-7b322d51 tracks getting the CLI itself to skip building the
 * full payload; this is the interim fix so a caller that only needs id+title
 * (global search) isn't shipped every task's full description/comments/links
 * over HTTP just to throw them away client-side. */
function toLite(data: LsJson): LiteLsJson {
  return {
    repos: data.repos.map((r) => ({
      name: r.name,
      tasks: r.tasks.map((t) => ({ id: t.id, display_id: t.display_id, title: t.title })),
    })),
  };
}

const lsQuerySchema = z.object({
  status: z.string().min(1).max(NAME_MAX_LEN).optional(),
  assignee: z.string().min(1).max(NAME_MAX_LEN).optional(),
  label: z.string().min(1).max(NAME_MAX_LEN).optional(),
  fixedVersion: z.string().min(1).max(NAME_MAX_LEN).optional(),
  affectedVersion: z.string().min(1).max(NAME_MAX_LEN).optional(),
  kind: taskKindSchema.optional(),
  parent: z.string().min(1).max(NAME_MAX_LEN).optional(),
  mine: booleanQueryParam,
  deleted: booleanQueryParam,
  withHistory: booleanQueryParam,
});

const tasksAllQuerySchema = lsQuerySchema.extend({
  project: z.string().min(1).max(NAME_MAX_LEN).optional(),
  light: booleanQueryParam,
});

function toFilters(query: z.infer<typeof lsQuerySchema>): LsFilters {
  return {
    status: query.status,
    assignee: query.assignee,
    label: query.label,
    fixedVersion: query.fixedVersion,
    affectedVersion: query.affectedVersion,
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
    const { project, light, ...rest } = request.query;
    const filters = toFilters(rest);
    const ctx = dataDirContext(env);
    const { data, warnings } = project ? await lsProject(ctx, project, filters) : await lsAll(ctx, filters);
    return { data: light ? toLite(data) : data, warnings };
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

  // `fields` (not the `config show` the plan's prose assumes — verified live against
  // the real binary) is the required-field schema NewTaskDialog validates against
  // before submitting, so it fails in the form instead of at new.rs:76.
  app.get(
    "/api/repos/:name/fields",
    { schema: { params: repoParamSchema } },
    async (request) => {
      const repo = await resolveRepo(dataDirContext(env), request.params.name);
      const { data, warnings } = await fields(repoContext(env, repo.path));
      return { data, warnings };
    },
  );
}
