import type { FastifyInstance } from "fastify";
import { subscribe, unsubscribe } from "../gitTask/sse.js";

const HEARTBEAT_MS = 25_000;

/**
 * §3.5 GET /api/events — a long-lived SSE stream, `{type:"repo-changed", repo,
 * digest}` per §4.5. `reply.hijack()` tells Fastify to stop managing this response
 * (no auto-send, no timeout) so the connection can stay open indefinitely; the
 * heartbeat comment line keeps intermediate proxies/load balancers from timing out
 * an apparently-idle connection, and is invisible to EventSource (comment lines
 * aren't dispatched as messages).
 */
export function registerEventsRoute(app: FastifyInstance) {
  app.get("/api/events", (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write(": connected\n\n");
    subscribe(reply);

    const heartbeat = setInterval(() => reply.raw.write(": hb\n\n"), HEARTBEAT_MS);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe(reply);
    });
  });
}
