import type { FastifyInstance } from "fastify";
import { getRegistry } from "../gitTask/registry.js";
import { dataDirContext } from "../gitTask/context.js";
import type { ResolvedEnv } from "../env.js";

export function registerRegistryRoute(app: FastifyInstance, env: ResolvedEnv) {
  app.get("/api/registry", async () => {
    const { data, warnings } = await getRegistry(dataDirContext(env));
    return { data, warnings };
  });
}
