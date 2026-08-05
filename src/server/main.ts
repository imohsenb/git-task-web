import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { registerStatic } from "./static.js";
import { resolveEnv } from "./env.js";
import { registerErrorHandler } from "./routes/errorHandler.js";
import { registerMetaRoute } from "./routes/meta.js";
import { registerRegistryRoute } from "./routes/registry.js";
import { registerRegistryMutationsRoutes } from "./routes/registryMutations.js";
import { registerTasksRoutes } from "./routes/tasks.js";
import { registerTaskMutationsRoutes } from "./routes/taskMutations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readPackageVersion(): string {
  // dist/server/main.js -> ../../package.json ; src/server/main.ts -> ../../package.json
  const pkgPath = join(__dirname, "..", "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return pkg.version as string;
}

export interface BuildServerOptions {
  serveStatic?: boolean;
}

export async function buildServer(opts: BuildServerOptions = {}) {
  const { serveStatic = true } = opts;
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  const env = resolveEnv();
  try {
    mkdirSync(env.dataDir, { recursive: true });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `could not create data directory '${env.dataDir}': ${reason}\n` +
        `Set GIT_TASK_WEB_DATA_DIR to a writable location and try again.`,
    );
  }

  const version = readPackageVersion();
  const mode = process.env.NODE_ENV === "production" ? "prod" : "dev";

  registerMetaRoute(app, env, { webVersion: version, mode });
  registerRegistryRoute(app, env);
  registerRegistryMutationsRoutes(app, env);
  registerTasksRoutes(app, env);
  registerTaskMutationsRoutes(app, env);

  if (serveStatic) {
    await registerStatic(app);
  }

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.GIT_TASK_WEB_PORT ?? 4600);
  const host = process.env.GIT_TASK_WEB_HOST ?? "127.0.0.1";

  try {
    const app = await buildServer();
    await app.listen({ port, host });
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
