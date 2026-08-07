import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** dist/server/static.js -> dist/web */
const webDist = join(__dirname, "..", "web");

export async function registerStatic(app: FastifyInstance) {
  await app.register(fastifyStatic, {
    root: webDist,
    index: "index.html",
  });

  app.setNotFoundHandler((req, reply) => {
    if (req.raw.method === "GET" && !req.url.startsWith("/api")) {
      reply.sendFile("index.html");
      return;
    }
    reply.code(404).send({ ok: false, error: { kind: "not_found", message: "not found" } });
  });
}
