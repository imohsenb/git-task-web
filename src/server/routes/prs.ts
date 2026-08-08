import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getRegistry, resolveRepo } from "../gitTask/registry.js";
import { dataDirContext } from "../gitTask/context.js";
import { booleanQueryParam, projectParamSchema, repoParamSchema, repoTaskParamSchema } from "./paramSchemas.js";
import type { ResolvedEnv } from "../env.js";
import { defaultPrService } from "../integrations/prs/index.js";

const prsQuerySchema = z.object({
  force: booleanQueryParam,
});

export function registerPrsRoutes(rawApp: FastifyInstance, env: ResolvedEnv) {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/api/repos/:name/tasks/:id/prs",
    { schema: { params: repoTaskParamSchema, querystring: prsQuerySchema } },
    async (request) => {
      const repo = await resolveRepo(dataDirContext(env), request.params.name);
      const prsResponse = await defaultPrService.getTaskPrs(
        repo.path,
        repo.remotes,
        request.params.id,
        { force: request.query.force },
      );
      return { data: prsResponse, warnings: [] };
    },
  );

  app.get(
    "/api/repos/:name/prs",
    { schema: { params: repoParamSchema, querystring: prsQuerySchema } },
    async (request) => {
      const repo = await resolveRepo(dataDirContext(env), request.params.name);
      const prsResponse = await defaultPrService.getRepoPrs(repo.path, repo.remotes, {
        force: request.query.force,
      });
      return { data: prsResponse, warnings: [] };
    },
  );

  app.get(
    "/api/projects/:project/prs",
    { schema: { params: projectParamSchema, querystring: prsQuerySchema } },
    async (request) => {
      const ctx = dataDirContext(env);
      const { data: registry } = await getRegistry(ctx);
      const repos = registry.repos.filter((r) => r.project === request.params.project && r.openable !== false);

      const results = await Promise.all(
        repos.map(async (repo) => {
          const prsResponse = await defaultPrService.getRepoPrs(repo.path, repo.remotes, {
            force: request.query.force,
          });
          return { repo: repo.name, ...prsResponse };
        }),
      );

      return { data: { repos: results }, warnings: [] };
    },
  );
}
