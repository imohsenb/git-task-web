import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  addComment,
  addLabel,
  addLink,
  clearParentIfSet,
  deleteTask,
  dropTask,
  editComment,
  editTask,
  newTask,
  removeLabel,
  removeLink,
  setParent,
  setStatus,
} from "../gitTask/commands.js";
import { withRepoLock } from "../gitTask/locks.js";
import { DEFAULT_TIMEOUT_MS } from "../gitTask/executor.js";
import { invalidateLsCache } from "../gitTask/lsCache.js";
import { notifyRepoChanged } from "../gitTask/sse.js";
import { resolveRepo } from "../gitTask/registry.js";
import { dataDirContext, repoContext } from "../gitTask/context.js";
import { linkKindSchema, prioritySchema, taskKindSchema } from "../../shared/contract.zod.js";
import { NAME_MAX_LEN, booleanQueryParam, repoParamSchema, repoTaskParamSchema } from "./paramSchemas.js";
import type { ResolvedEnv } from "../env.js";
import type { GitTaskContext } from "../gitTask/commands.js";

const TITLE_MAX_LEN = 500;
const TEXT_MAX_LEN = 10_000;
const LABEL_MAX_LEN = 100;

/** §3.5: "rejected server-side if empty, whitespace-only, or containing newlines" —
 * status is otherwise free-form (workflows aren't enforced by the CLI). */
const statusValueSchema = z
  .string()
  .max(NAME_MAX_LEN)
  .refine((s) => s.trim().length > 0, { message: "status must not be empty or whitespace-only" })
  .refine((s) => !/[\r\n]/.test(s), { message: "status must not contain newlines" });

const newTaskBodySchema = z.object({
  title: z.string().min(1).max(TITLE_MAX_LEN),
  kind: taskKindSchema,
  description: z.string().max(TEXT_MAX_LEN),
  assignee: z.string().min(1).max(NAME_MAX_LEN).optional(),
  labels: z.array(z.string().min(1).max(LABEL_MAX_LEN)).max(50).optional(),
  fixedVersions: z.array(z.string().min(1).max(LABEL_MAX_LEN)).max(50).optional(),
  affectedVersions: z.array(z.string().min(1).max(LABEL_MAX_LEN)).max(50).optional(),
  priority: prioritySchema.optional(),
  due: z.string().min(1).max(NAME_MAX_LEN).optional(),
  milestone: z.string().min(1).max(NAME_MAX_LEN).optional(),
  parent: z.string().min(1).max(NAME_MAX_LEN).optional(),
  status: statusValueSchema.optional(),
});

const editTaskBodySchema = z.object({
  title: z.string().min(1).max(TITLE_MAX_LEN).optional(),
  description: z.string().max(TEXT_MAX_LEN).optional(),
  kind: taskKindSchema.optional(),
  priority: prioritySchema.nullable().optional(),
  assignee: z.string().min(1).max(NAME_MAX_LEN).nullable().optional(),
  due: z.string().min(1).max(NAME_MAX_LEN).nullable().optional(),
  milestone: z.string().min(1).max(NAME_MAX_LEN).nullable().optional(),
});

const statusBodySchema = z.object({ status: statusValueSchema });
const commentBodySchema = z.object({ text: z.string().min(1).max(TEXT_MAX_LEN) });
const labelBodySchema = z.object({ label: z.string().min(1).max(LABEL_MAX_LEN) });
const parentBodySchema = z.object({
  epicId: z.string().min(1).max(NAME_MAX_LEN),
  epicRepo: z.string().min(1).max(NAME_MAX_LEN).optional(),
});
const linkBodySchema = z.object({
  kind: linkKindSchema,
  target: z.string().min(1).max(NAME_MAX_LEN),
  targetRepo: z.string().min(1).max(NAME_MAX_LEN).optional(),
});
const linkDeleteQuerySchema = z.object({ repo: z.string().min(1).max(NAME_MAX_LEN).optional() });

const commentParamSchema = repoTaskParamSchema.extend({ n: z.coerce.number().int().positive() });
const labelParamSchema = repoTaskParamSchema.extend({ label: z.string().min(1).max(LABEL_MAX_LEN) });
const linkParamSchema = repoTaskParamSchema.extend({ kind: linkKindSchema, target: z.string().min(1).max(NAME_MAX_LEN) });
const deleteQuerySchema = z.object({
  hard: booleanQueryParam,
  remote: z.string().min(1).max(NAME_MAX_LEN).optional(),
});

export function registerTaskMutationsRoutes(rawApp: FastifyInstance, env: ResolvedEnv) {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  /** Resolves the repo, then runs `fn` under that repo's write lock, invalidating
   * the ls cache on the way out. The one place every write route funnels through. */
  async function write<T>(name: string, fn: (ctx: GitTaskContext) => Promise<T>): Promise<T> {
    const repo = await resolveRepo(dataDirContext(env), name);
    const ctx = repoContext(env, repo.path);
    const result = await withRepoLock(repo.path, DEFAULT_TIMEOUT_MS, () => fn(ctx));
    invalidateLsCache(repo.path);
    notifyRepoChanged(repo.name, repo.path);
    return result;
  }

  app.post(
    "/api/repos/:name/tasks",
    { schema: { params: repoParamSchema, body: newTaskBodySchema } },
    async (request, reply) => {
      const { data, warnings } = await write(request.params.name, (ctx) => newTask(ctx, request.body));
      reply.code(201);
      return { data, warnings };
    },
  );

  app.patch(
    "/api/repos/:name/tasks/:id",
    { schema: { params: repoTaskParamSchema, body: editTaskBodySchema } },
    async (request, reply) => {
      const result = await write(request.params.name, (ctx) => editTask(ctx, request.params.id, request.body));
      if (result === null) {
        reply.code(204);
        return;
      }
      return { data: result.data, warnings: result.warnings };
    },
  );

  app.put(
    "/api/repos/:name/tasks/:id/status",
    { schema: { params: repoTaskParamSchema, body: statusBodySchema } },
    async (request) => {
      const { data, warnings } = await write(request.params.name, (ctx) =>
        setStatus(ctx, request.params.id, request.body.status),
      );
      return { data, warnings };
    },
  );

  app.delete(
    "/api/repos/:name/tasks/:id",
    { schema: { params: repoTaskParamSchema, querystring: deleteQuerySchema } },
    async (request) => {
      const { hard, remote } = request.query;
      if (hard) {
        const { data, warnings } = await write(request.params.name, (ctx) =>
          dropTask(ctx, request.params.id, remote),
        );
        return { data, warnings };
      }
      const { data, warnings } = await write(request.params.name, (ctx) => deleteTask(ctx, request.params.id));
      return { data, warnings };
    },
  );

  app.post(
    "/api/repos/:name/tasks/:id/comments",
    { schema: { params: repoTaskParamSchema, body: commentBodySchema } },
    async (request, reply) => {
      const { data, warnings } = await write(request.params.name, (ctx) =>
        addComment(ctx, request.params.id, request.body.text),
      );
      reply.code(201);
      return { data, warnings };
    },
  );

  app.patch(
    "/api/repos/:name/tasks/:id/comments/:n",
    { schema: { params: commentParamSchema, body: commentBodySchema } },
    async (request) => {
      const { data, warnings } = await write(request.params.name, (ctx) =>
        editComment(ctx, request.params.id, request.params.n, request.body.text),
      );
      return { data, warnings };
    },
  );

  app.post(
    "/api/repos/:name/tasks/:id/labels",
    { schema: { params: repoTaskParamSchema, body: labelBodySchema } },
    async (request, reply) => {
      const { data, warnings } = await write(request.params.name, (ctx) =>
        addLabel(ctx, request.params.id, request.body.label),
      );
      reply.code(201);
      return { data, warnings };
    },
  );

  app.delete(
    "/api/repos/:name/tasks/:id/labels/:label",
    { schema: { params: labelParamSchema } },
    async (request) => {
      const { data, warnings } = await write(request.params.name, (ctx) =>
        removeLabel(ctx, request.params.id, request.params.label),
      );
      return { data, warnings };
    },
  );

  app.put(
    "/api/repos/:name/tasks/:id/parent",
    { schema: { params: repoTaskParamSchema, body: parentBodySchema } },
    async (request) => {
      const { data, warnings } = await write(request.params.name, (ctx) =>
        setParent(ctx, request.body.epicId, request.params.id, request.body.epicRepo),
      );
      return { data, warnings };
    },
  );

  app.delete(
    "/api/repos/:name/tasks/:id/parent",
    { schema: { params: repoTaskParamSchema } },
    async (request, reply) => {
      const result = await write(request.params.name, (ctx) => clearParentIfSet(ctx, request.params.id));
      if (result === null) {
        reply.code(204);
        return;
      }
      return { data: result.data, warnings: result.warnings };
    },
  );

  app.post(
    "/api/repos/:name/tasks/:id/links",
    { schema: { params: repoTaskParamSchema, body: linkBodySchema } },
    async (request, reply) => {
      const { data, warnings } = await write(request.params.name, (ctx) =>
        addLink(ctx, request.params.id, request.body.kind, request.body.target, request.body.targetRepo),
      );
      reply.code(201);
      return { data, warnings };
    },
  );

  app.delete(
    "/api/repos/:name/tasks/:id/links/:kind/:target",
    { schema: { params: linkParamSchema, querystring: linkDeleteQuerySchema } },
    async (request) => {
      const { data, warnings } = await write(request.params.name, (ctx) =>
        removeLink(ctx, request.params.id, request.params.kind, request.params.target, request.query.repo),
      );
      return { data, warnings };
    },
  );
}
