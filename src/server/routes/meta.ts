import type { FastifyInstance } from "fastify";
import { getVersion } from "../gitTask/executor.js";
import { whoami } from "../gitTask/commands.js";
import { GitTaskError } from "../gitTask/errors.js";
import { dataDirContext, requireBin } from "../gitTask/context.js";
import type { ResolvedEnv } from "../env.js";
import type { IdentityInfoJson } from "../../shared/contract.js";

export interface MetaRouteOptions {
  webVersion: string;
  mode: "dev" | "prod";
}

export function registerMetaRoute(app: FastifyInstance, env: ResolvedEnv, opts: MetaRouteOptions) {
  app.get("/api/meta", async () => {
    const bin = requireBin(env);
    const cliVersion = await getVersion(bin);
    const { data: identity, warnings } = await whoami(dataDirContext(env));

    if (!identity.effective.ok) {
      throw new GitTaskError({
        kind: "identity_missing",
        message: "git identity is not configured for the server process — set user.name and user.email",
        context: { missing: missingIdentityFields(identity.effective) },
      });
    }

    return {
      data: {
        name: "git-task-web",
        version: opts.webVersion,
        mode: opts.mode,
        dataDir: env.dataDir,
        configDir: env.configDir,
        cli: { bin, version: cliVersion },
        identity: identity.effective,
      },
      warnings,
    };
  });
}

function missingIdentityFields(identity: IdentityInfoJson): string[] {
  const missing: string[] = [];
  if (!identity.name) missing.push("user.name");
  if (!identity.email) missing.push("user.email");
  return missing;
}
