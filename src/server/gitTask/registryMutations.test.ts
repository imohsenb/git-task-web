import { describe, expect, it } from "vitest";
import { resolveBin } from "../env.js";
import {
  cloneRepo,
  newTask,
  projectCreate,
  projectDelete,
  projectRename,
  projectSetDefault,
  registerRepo,
  reposDeep,
  unregisterRepo,
  type GitTaskContext,
} from "./commands.js";
import { TestRepo } from "./testRepo.js";

const bin = resolveBin();

describe.skipIf(!bin)("repo/project registry commands against a real git-task binary", () => {
  function ctxFor(repo: TestRepo): GitTaskContext {
    return { bin: bin!, cwd: repo.path, configDir: repo.configDir };
  }

  it("registerRepo defaults the name to the directory basename and defaults to the default project", async () => {
    const repo = TestRepo.create();
    const { data } = await registerRepo(ctxFor(repo));
    expect(data.action).toBe("registered");
    expect(data.project).toBe("main");
    expect(data.registry.repos).toEqual([expect.objectContaining({ name: data.name, path: repo.path, project: "main" })]);
  });

  it("registerRepo with an explicit name and a not-yet-existing project creates the project too", async () => {
    const repo = TestRepo.create();
    const { data } = await registerRepo(ctxFor(repo), "custom-name", "custom-project");
    expect(data.action).toBe("registered");
    expect(data.name).toBe("custom-name");
    expect(data.project).toBe("custom-project");
    expect(data.registry.projects).toContain("custom-project");
  });

  it("registering the same repo again with the same name is a noop that still points at this repo's path", async () => {
    const repo = TestRepo.create();
    await registerRepo(ctxFor(repo), "dup-name");
    const { data } = await registerRepo(ctxFor(repo), "dup-name");
    expect(data.action).toBe("noop");
    const entry = data.registry.repos.find((r) => r.name === "dup-name");
    expect(entry?.path).toBe(repo.path);
  });

  it("registering a DIFFERENT repo under an already-taken name is a noop that leaves the new repo unregistered", async () => {
    const repoA = TestRepo.create();
    const repoB = TestRepo.createWithSharedConfig(repoA.configDir);
    await registerRepo(ctxFor(repoA), "taken-name");

    const { data } = await registerRepo(ctxFor(repoB), "taken-name");
    expect(data.action).toBe("noop");
    // The registry entry for "taken-name" still points at repoA, not repoB — this is
    // the ambiguity registryMutations.ts's assertRegisteredAsRequested() detects and
    // turns into a conflict at the route layer.
    const entry = data.registry.repos.find((r) => r.name === "taken-name");
    expect(entry?.path).toBe(repoA.path);
    expect(entry?.path).not.toBe(repoB.path);
    expect(data.registry.repos.some((r) => r.path === repoB.path)).toBe(false);
  });

  it("registerRepo then unregisterRepo round-trips a registration", async () => {
    const repo = TestRepo.create();
    await registerRepo(ctxFor(repo), "roundtrip");

    const dataDirCtx: GitTaskContext = { bin: bin!, cwd: repo.configDir, configDir: repo.configDir };
    const { data } = await unregisterRepo(dataDirCtx, "roundtrip");
    expect(data.action).toBe("unregistered");
    expect(data.registry.repos).toEqual([]);
  });

  it("unregisterRepo on an unknown name rejects with not_found", async () => {
    const repo = TestRepo.create();
    const ctx: GitTaskContext = { bin: bin!, cwd: repo.configDir, configDir: repo.configDir };
    await expect(unregisterRepo(ctx, "does-not-exist")).rejects.toMatchObject({ kind: "not_found" });
  });

  it("projectCreate/projectRename/projectSetDefault/projectDelete surface the CLI's real constraints", async () => {
    const repo = TestRepo.create();
    const ctx = ctxFor(repo);

    const created = await projectCreate(ctx, "teamx");
    expect(created.data.action).toBe("project_created");
    expect(created.data.registry.projects).toContain("teamx");

    // Can't delete a project that still has a repo registered under it.
    await registerRepo(ctx, "repo-in-teamx", "teamx");
    await expect(projectDelete(ctx, "teamx")).rejects.toMatchObject({ kind: "conflict" });

    // Can't delete the default project.
    await expect(projectDelete(ctx, "main")).rejects.toMatchObject({ kind: "conflict" });

    const renamed = await projectRename(ctx, "teamx", "teamy");
    expect(renamed.data.action).toBe("project_renamed");
    expect(renamed.data.registry.repos.find((r) => r.name === "repo-in-teamx")?.project).toBe("teamy");

    // set-default prunes "main": it's now neither the default nor holds any repos,
    // and git-task auto-removes empty non-default projects rather than leaving dead
    // entries around — verified live, not documented in PLAN.md's per-command table.
    const defaulted = await projectSetDefault(ctx, "teamy");
    expect(defaulted.data.action).toBe("default_set");
    expect(defaulted.data.registry.default_project).toBe("teamy");
    expect(defaulted.data.registry.projects).not.toContain("main");

    await expect(projectDelete(ctx, "main")).rejects.toMatchObject({ kind: "not_found" });
  });

  it("cloneRepo pulls refs/tasks/* from a bare remote into a fresh directory, without registering it", async () => {
    const source = TestRepo.create();
    const bareRemote = TestRepo.bareRemote();
    source.git(["remote", "add", "origin", bareRemote]);

    const seedCtx = ctxFor(source);
    await newTask(seedCtx, { title: "seed", kind: "task", description: "d" });
    source.git(["push", "-q", "origin", "refs/tasks/*:refs/tasks/*"]);

    const workspaceCtx: GitTaskContext = { bin: bin!, cwd: source.configDir, configDir: source.configDir };
    const { data } = await cloneRepo(workspaceCtx, bareRemote);
    expect(data.url).toBe(bareRemote);
    expect(data.task_count).toBe(1);
    expect(data.dir).toMatch(/^\//);

    // clone does not register — confirmed by asking the registry (cwd'd into the
    // freshly cloned dir, which register would need anyway) before ever registering it.
    const clonedCtx: GitTaskContext = { bin: bin!, cwd: data.dir, configDir: source.configDir };
    const beforeRegister = await reposDeep(clonedCtx);
    expect(beforeRegister.data.repos).toEqual([]);

    const { data: registered } = await registerRepo(clonedCtx);
    expect(registered.action).toBe("registered");
    expect(registered.registry.repos.some((r) => r.path === data.dir)).toBe(true);
  });
});
