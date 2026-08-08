import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { registerPrsRoutes } from "./prs.js";
import { registerErrorHandler } from "./errorHandler.js";
import type { ResolvedEnv } from "../env.js";
import * as registryModule from "../gitTask/registry.js";
import { defaultPrService } from "../integrations/prs/index.js";

const dummyEnv: ResolvedEnv = {
  dataDir: "/tmp/git-task-web-test-prs",
  configDir: "/tmp/git-task-web-test-prs-config",
  bin: "git-task",
  host: "127.0.0.1",
  port: 4600,
};

describe("GET /api/repos/:name/tasks/:id/prs", () => {
  it("returns PR response from defaultPrService", async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerErrorHandler(app);
    registerPrsRoutes(app, dummyEnv);

    vi.spyOn(registryModule, "resolveRepo").mockResolvedValue({
      name: "my-repo",
      path: "/tmp/my-repo-path",
      project: "default",
      exists: true,
      openable: true,
      key: "MR",
      branch: "main",
      task_count: 5,
      open_task_count: 2,
      remotes: [{ name: "origin", url: "git@github.com:owner/my-repo.git", push_url: null }],
      identity: null,
      error: null,
    });

    vi.spyOn(defaultPrService, "getTaskPrs").mockResolvedValue({
      platform: "github",
      providerName: "GitHub",
      cliAvailable: true,
      cliName: "gh",
      prs: [
        {
          id: "#42",
          title: "Fix bug (t-1)",
          url: "https://github.com/owner/my-repo/pull/42",
          state: "open",
          provider: "github",
        },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/repos/my-repo/tasks/t-1/prs",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.platform).toBe("github");
    expect(body.data.cliAvailable).toBe(true);
    expect(body.data.prs).toHaveLength(1);
    expect(body.data.prs[0].id).toBe("#42");
  });
});

describe("GET /api/repos/:name/prs", () => {
  it("returns open PRs for the repo from defaultPrService", async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerErrorHandler(app);
    registerPrsRoutes(app, dummyEnv);

    vi.spyOn(registryModule, "resolveRepo").mockResolvedValue({
      name: "my-repo",
      path: "/tmp/my-repo-path",
      project: "default",
      exists: true,
      openable: true,
      key: "MR",
      branch: "main",
      task_count: 5,
      open_task_count: 2,
      remotes: [{ name: "origin", url: "git@github.com:owner/my-repo.git", push_url: null }],
      identity: null,
      error: null,
    });

    vi.spyOn(defaultPrService, "getRepoPrs").mockResolvedValue({
      platform: "github",
      providerName: "GitHub",
      cliAvailable: true,
      cliName: "gh",
      prs: [
        {
          id: "#42",
          title: "Open PR",
          url: "https://github.com/owner/my-repo/pull/42",
          state: "open",
          provider: "github",
        },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/repos/my-repo/prs",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.cliAvailable).toBe(true);
    expect(body.data.prs).toHaveLength(1);
    expect(body.data.prs[0].id).toBe("#42");
  });
});

describe("GET /api/projects/:project/prs", () => {
  it("aggregates open PRs across all repos in the project", async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerErrorHandler(app);
    registerPrsRoutes(app, dummyEnv);

    const repoA = {
      name: "repo-a",
      path: "/tmp/repo-a",
      project: "my-project",
      exists: true,
      openable: true,
      key: "A",
      branch: "main",
      task_count: 1,
      open_task_count: 1,
      remotes: [{ name: "origin", url: "git@github.com:owner/repo-a.git", push_url: null }],
      identity: null,
      error: null,
    };
    const repoB = {
      ...repoA,
      name: "repo-b",
      path: "/tmp/repo-b",
      remotes: [{ name: "origin", url: "git@github.com:owner/repo-b.git", push_url: null }],
    };
    const repoOther = { ...repoA, name: "repo-other", project: "other-project", path: "/tmp/repo-other" };

    vi.spyOn(registryModule, "getRegistry").mockResolvedValue({
      data: { config_dir: "/tmp", default_project: "default", projects: ["my-project"], repos: [repoA, repoB, repoOther] },
      warnings: [],
      command: "repos --deep",
      version: "test",
    });

    const getRepoPrsSpy = vi.spyOn(defaultPrService, "getRepoPrs").mockImplementation(async (repoPath) => ({
      platform: "github",
      providerName: "GitHub",
      cliAvailable: true,
      cliName: "gh",
      prs: [
        {
          id: `#${repoPath}`,
          title: `PR for ${repoPath}`,
          url: "https://github.com/owner/repo/pull/1",
          state: "open",
          provider: "github",
        },
      ],
    }));

    const res = await app.inject({
      method: "GET",
      url: "/api/projects/my-project/prs",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.repos).toHaveLength(2);
    expect(body.data.repos.map((r: { repo: string }) => r.repo).sort()).toEqual(["repo-a", "repo-b"]);
    expect(getRepoPrsSpy).toHaveBeenCalledTimes(2);
  });
});
