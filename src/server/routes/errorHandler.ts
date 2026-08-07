import type { FastifyError, FastifyInstance } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { GitTaskError } from "../gitTask/errors.js";

/**
 * Route handlers throw GitTaskError (from the executor, registry, or their own
 * validation) instead of catching it themselves — this is the one place that maps it
 * to an HTTP response, so every route gets the §3.1 kind->status table for free.
 */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, request, reply) => {
    if (err instanceof GitTaskError) {
      reply.code(err.httpStatus).send(err.toJSON());
      return;
    }

    if (hasZodFastifySchemaValidationErrors(err)) {
      reply.code(422).send({
        ok: false,
        error: {
          kind: "validation",
          message: `invalid ${err.validation[0]?.instancePath || "request"}: ${err.validation
            .map((v) => v.message)
            .join(", ")}`,
          causes: [],
        },
      });
      return;
    }

    // Fastify/plugin errors that already carry a deliberate HTTP status — e.g.
    // @fastify/static returns 403 Forbidden on an encoded path-traversal attempt
    // (verified live: GET /%2e%2e/%2e%2e/%2e%2e/etc/passwd). Honor it instead of
    // flattening every non-GitTaskError to 500, which would mask a correct rejection
    // as a server crash.
    const fastifyErr = err as FastifyError;
    const statusCode = typeof fastifyErr.statusCode === "number" ? fastifyErr.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error(err);
    }
    reply.code(statusCode).send({
      ok: false,
      error: {
        kind: statusCode < 500 ? "validation" : "internal",
        message: statusCode < 500 ? fastifyErr.message : "internal server error",
        causes: [],
      },
    });
  });
}
