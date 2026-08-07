import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { resolveRepo } from "../gitTask/registry.js";
import { dataDirContext } from "../gitTask/context.js";
import { booleanQueryParam, repoTaskParamSchema } from "./paramSchemas.js";
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
}
