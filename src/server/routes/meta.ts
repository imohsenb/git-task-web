import type { FastifyInstance } from "fastify";
import { getVersion } from "../gitTask/executor.js";
import { whoami } from "../gitTask/commands.js";
import { GitTaskError } from "../gitTask/errors.js";
import type { ResolvedEnv } from "../env.js";
import type { IdentityInfoJson } from "../../shared/contract.js";

export interface MetaRouteOptions {
  webVersion: string;
  mode: "dev" | "prod";
}

export function registerMetaRoute(app: FastifyInstance, env: ResolvedEnv, opts: MetaRouteOptions) {
  app.get("/api/meta", async (_request, reply) => {
    if (!env.bin) {
      reply.code(500);
      return errorBody(
        new GitTaskError({
          kind: "internal",
          message: "git-task binary not found on PATH — install it or set GIT_TASK_BIN",
        }),
      );
    }

    let cliVersion: string;
    try {
      cliVersion = await getVersion(env.bin);
    } catch (err) {
      reply.code(err instanceof GitTaskError ? err.httpStatus : 500);
      return errorBody(err);
    }

    let identity;
    try {
      identity = await whoami({ bin: env.bin, cwd: env.dataDir, configDir: env.configDir });
    } catch (err) {
      reply.code(err instanceof GitTaskError ? err.httpStatus : 500);
      return errorBody(err);
    }

    if (!identity.effective.ok) {
      reply.code(412);
      return errorBody(
        new GitTaskError({
          kind: "identity_missing",
          message: "git identity is not configured for the server process — set user.name and user.email",
          context: { missing: missingIdentityFields(identity.effective) },
        }),
      );
    }

    return {
      name: "git-task-web",
      version: opts.webVersion,
      mode: opts.mode,
      dataDir: env.dataDir,
      configDir: env.configDir,
      cli: { bin: env.bin, version: cliVersion },
      identity: identity.effective,
    };
  });
}

function missingIdentityFields(identity: IdentityInfoJson): string[] {
  const missing: string[] = [];
  if (!identity.name) missing.push("user.name");
  if (!identity.email) missing.push("user.email");
  return missing;
}

function errorBody(err: unknown) {
  if (err instanceof GitTaskError) return err.toJSON();
  return {
    ok: false as const,
    error: { kind: "internal", message: err instanceof Error ? err.message : String(err), causes: [] },
  };
}
