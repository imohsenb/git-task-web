import { realpathSync, statSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  cloneRepo,
  projectCreate,
  projectDelete,
  projectRename,
  projectSetDefault,
  registerRepo,
  unregisterRepo,
} from "../gitTask/commands.js";
import { withRepoLock } from "../gitTask/locks.js";
import { DEFAULT_TIMEOUT_MS } from "../gitTask/executor.js";
import { invalidateRegistry, resolveRepoEntry } from "../gitTask/registry.js";
import { dataDirContext, repoContext } from "../gitTask/context.js";
import { GitTaskError } from "../gitTask/errors.js";
import { NAME_MAX_LEN } from "./paramSchemas.js";
import type { ResolvedEnv } from "../env.js";
import type { CloneAndRegisterJson, RegistryMutationJson } from "../../shared/contract.js";

const nameSchema = z.string().min(1).max(NAME_MAX_LEN);
const nameParamSchema = z.object({ name: nameSchema });

const registerBodySchema = z.object({
  path: z.string().min(1).max(4096),
  name: nameSchema.optional(),
  project: nameSchema.optional(),
});

const cloneBodySchema = z.object({
  url: z.string().min(1).max(2048),
  dir: z.string().min(1).max(NAME_MAX_LEN).optional(),
  name: nameSchema.optional(),
  project: nameSchema.optional(),
});

const moveBodySchema = z.object({ project: nameSchema });
const projectCreateBodySchema = z.object({ name: nameSchema });
const projectRenameBodySchema = z.object({ newName: nameSchema });

/** register/clone accept a server-filesystem path straight from the client — this is
 * a local, single-user admin tool (§3.2/§8 of PLAN.md: no auth, the operator already
 * has a shell), so there's no privilege boundary being crossed, only an existence
 * check: resolve symlinks/relative bits so it matches the registry's own path form
 * (and what withRepoLock keys its mutex on), and confirm it's actually a directory
 * before handing it to git-task as a cwd. */
function canonicalizeDir(rawPath: string): string {
  let resolved: string;
  try {
    resolved = realpathSync(rawPath);
  } catch {
    throw new GitTaskError({
      kind: "not_a_repo",
      message: `'${rawPath}' does not exist or is not accessible from the server`,
      context: { path: rawPath },
    });
  }
  if (!statSync(resolved).isDirectory()) {
    throw new GitTaskError({
      kind: "not_a_repo",
      message: `'${rawPath}' is not a directory`,
      context: { path: rawPath },
    });
  }
  return resolved;
}

/**
 * register's own "noop" action is ambiguous by design (PLAN.md §1.3): it covers both
 * "this exact repo is already registered under this name" (a real no-op, fine) and
 * "the name is taken by a *different* repo" (register.rs silently does nothing — the
 * repo we asked to register never joins the registry at all). The JSON envelope alone
 * can't tell them apart, so this reconstructs the distinction the only way available:
 * check whether the registry entry for the returned name actually points at the path
 * we just tried to register.
 */
function assertRegisteredAsRequested(result: RegistryMutationJson, canonicalPath: string): void {
  if (result.action !== "noop") return;
  const entry = result.registry.repos.find((r) => r.name === result.name);
  if (entry && entry.path !== canonicalPath) {
    throw new GitTaskError({
      kind: "conflict",
      message: `name '${result.name}' is already registered to a different repo (${entry.path})`,
      context: { name: result.name, existingPath: entry.path },
    });
  }
}

export function registerRegistryMutationsRoutes(rawApp: FastifyInstance, env: ResolvedEnv) {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  /** Registry mutations (register/unregister/project *) all rewrite the same
   * config.toml — one lock keyed on configDir, distinct from taskMutations.ts's
   * per-repo-path lock (which protects task refs, a different resource). */
  async function writeRegistry<T>(fn: () => Promise<T>): Promise<T> {
    const result = await withRepoLock(env.configDir, DEFAULT_TIMEOUT_MS, fn);
    invalidateRegistry(env.configDir);
    return result;
  }

  app.post("/api/repos", { schema: { body: registerBodySchema } }, async (request, reply) => {
    const { path, name, project } = request.body;
    const canonicalPath = canonicalizeDir(path);
    const { data, warnings } = await writeRegistry(() => registerRepo(repoContext(env, canonicalPath), name, project));
    assertRegisteredAsRequested(data, canonicalPath);
    reply.code(201);
    return { data, warnings };
  });

  app.post("/api/repos/clone", { schema: { body: cloneBodySchema } }, async (request, reply) => {
    const { url, dir, name, project } = request.body;
    const { data, warnings } = await writeRegistry(async () => {
      const cloned = await cloneRepo(dataDirContext(env), url, dir);
      const registered = await registerRepo(repoContext(env, cloned.data.dir), name, project);
      assertRegisteredAsRequested(registered.data, cloned.data.dir);
      const combined: CloneAndRegisterJson = { clone: cloned.data, register: registered.data };
      return { data: combined, warnings: [...cloned.warnings, ...registered.warnings] };
    });
    reply.code(201);
    return { data, warnings };
  });

  /** "Move between projects" — register overloads both create and move (PLAN.md §8.8),
   * so moving re-runs it with the repo's *existing* name, which is what makes register
   * take the move branch instead of trying to register a second entry. */
  app.patch("/api/repos/:name", { schema: { params: nameParamSchema, body: moveBodySchema } }, async (request) => {
    const repo = await resolveRepoEntry(dataDirContext(env), request.params.name);
    const { data, warnings } = await writeRegistry(() =>
      registerRepo(repoContext(env, repo.path), request.params.name, request.body.project),
    );
    return { data, warnings };
  });

  app.delete("/api/repos/:name", { schema: { params: nameParamSchema } }, async (request) => {
    const { data, warnings } = await writeRegistry(() => unregisterRepo(dataDirContext(env), request.params.name));
    return { data, warnings };
  });

  app.post("/api/projects", { schema: { body: projectCreateBodySchema } }, async (request, reply) => {
    const { data, warnings } = await writeRegistry(() => projectCreate(dataDirContext(env), request.body.name));
    reply.code(201);
    return { data, warnings };
  });

  app.patch(
    "/api/projects/:name",
    { schema: { params: nameParamSchema, body: projectRenameBodySchema } },
    async (request) => {
      const { data, warnings } = await writeRegistry(() =>
        projectRename(dataDirContext(env), request.params.name, request.body.newName),
      );
      return { data, warnings };
    },
  );

  app.put("/api/projects/:name/default", { schema: { params: nameParamSchema } }, async (request) => {
    const { data, warnings } = await writeRegistry(() => projectSetDefault(dataDirContext(env), request.params.name));
    return { data, warnings };
  });

  app.delete("/api/projects/:name", { schema: { params: nameParamSchema } }, async (request) => {
    const { data, warnings } = await writeRegistry(() => projectDelete(dataDirContext(env), request.params.name));
    return { data, warnings };
  });
}
