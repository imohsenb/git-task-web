import Fastify from "fastify";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { registerStatic } from "./static.js";

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

  const version = readPackageVersion();
  const mode = process.env.NODE_ENV === "production" ? "prod" : "dev";

  app.get("/api/meta", async () => ({
    name: "git-task-web",
    version,
    mode,
  }));

  if (serveStatic) {
    await registerStatic(app);
  }

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.GIT_TASK_WEB_PORT ?? 4600);
  const host = process.env.GIT_TASK_WEB_HOST ?? "127.0.0.1";

  const app = await buildServer();
  await app.listen({ port, host });
}
