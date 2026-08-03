import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerErrorHandler } from "./errorHandler.js";
import { GitTaskError } from "../gitTask/errors.js";

function appWithBoomRoute(throwIt: () => never) {
  const app = Fastify();
  registerErrorHandler(app);
  app.get("/boom", async () => {
    throwIt();
  });
  return app;
}

describe("registerErrorHandler", () => {
  it("maps GitTaskError to its documented httpStatus", async () => {
    const app = appWithBoomRoute(() => {
      throw new GitTaskError({ kind: "not_found", message: "nope" });
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ ok: false, error: { kind: "not_found", message: "nope" } });
  });

  it("honors a plugin error's own statusCode instead of flattening to 500", async () => {
    // Regression: @fastify/static throws a 403 ForbiddenError on an encoded
    // path-traversal attempt (verified live against GET /%2e%2e/%2e%2e/%2e%2e/etc/passwd)
    // — the handler used to flatten every non-GitTaskError to 500, turning a correct
    // rejection into a false-looking server crash.
    const app = appWithBoomRoute(() => {
      const err = new Error("Forbidden") as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ ok: false, error: { kind: "validation", message: "Forbidden" } });
  });

  it("defaults to 500 with a generic message for errors with no statusCode", async () => {
    const app = appWithBoomRoute(() => {
      throw new Error("some internal detail that should not leak to clients");
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error.message).toBe("internal server error");
    expect(body.error.message).not.toContain("should not leak");
  });
});
