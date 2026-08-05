import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { registerStatic } from "./static.js";
import { resolveEnv } from "./env.js";
import { dataDirContext } from "./gitTask/context.js";
import { getRegistry } from "./gitTask/registry.js";
import { hasSubscribers, pollForChanges } from "./gitTask/sse.js";
import { registerErrorHandler } from "./routes/errorHandler.js";
import { registerEventsRoute } from "./routes/events.js";
import { registerMetaRoute } from "./routes/meta.js";
import { registerRegistryRoute } from "./routes/registry.js";
import { registerRegistryMutationsRoutes } from "./routes/registryMutations.js";
import { registerSyncRoutes } from "./routes/sync.js";
import { registerTasksRoutes } from "./routes/tasks.js";
import { registerTaskMutationsRoutes } from "./routes/taskMutations.js";

const SSE_POLL_MS = 5_000;

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
  registerSyncRoutes(app, env);
  registerEventsRoute(app);

  // §3.4/§4.5: catches a repo change this server didn't make itself (a concurrent
  // terminal `git task status`, another git-task-web instance). No-ops with no open
  // SSE connections, so an idle app costs nothing beyond one interval tick.
  const pollTimer = setInterval(() => {
    if (!hasSubscribers()) return;
    getRegistry(dataDirContext(env))
      .then(({ data }) => pollForChanges(data.repos.map((r) => ({ name: r.name, path: r.path }))))
      .catch((err) => app.log.warn({ err }, "sse ref-digest poll failed"));
  }, SSE_POLL_MS);
  app.addHook("onClose", (_instance, done) => {
    clearInterval(pollTimer);
    done();
  });

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
