import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { registerTasksRoutes } from "./tasks.js";
import { registerErrorHandler } from "./errorHandler.js";
import type { ResolvedEnv } from "../env.js";
import * as commandsModule from "../gitTask/commands.js";
import type { LsJson } from "../../shared/contract.js";

const dummyEnv: ResolvedEnv = {
  dataDir: "/tmp/git-task-web-test-tasks",
  configDir: "/tmp/git-task-web-test-tasks-config",
  bin: "git-task",
  host: "127.0.0.1",
  port: 4600,
};

const fullLsJson: LsJson = {
  scope: { mode: "registry", repo_count: 1, branch: null },
  filters_applied: {
    status: null,
    assignee: null,
    label: null,
    fixed_version: null,
    affected_version: null,
    kind: null,
    parent: null,
    mine: false,
    deleted: false,
  },
  repos: [
    {
      name: "my-repo",
      project: "default",
      path: "/tmp/my-repo",
      key: "MR",
      branch: "main",
      tasks: [
        {
          id: "abc123",
          display_id: "MR-abc123",
          key: "MR",
          title: "Fix the thing",
          description: "a very long description that a lean caller shouldn't have to pay for",
          kind: "task",
          status: "todo",
          priority: null,
          assignee: null,
          assignee_name: null,
          reporter: "a@b.com",
          reporter_name: "A",
          labels: [],
          fixed_versions: [],
          affected_versions: [],
          due: null,
          parent: null,
          parent_display_id: null,
          parent_repo: null,
          links: [{ kind: "blocks", target: "other123", target_display_id: "MR-other", target_repo: null }],
          milestone: null,
          comments: [
            { id: 1, author: "a@b.com", author_name: "A", text: "a long comment body", timestamp: 1, edited: false },
          ],
          deleted: false,
          created: 1,
          updated: 2,
        },
      ],
    },
  ],
  contributors: {},
  statuses: ["todo"],
  total: 1,
};

describe("GET /api/tasks", () => {
  it("returns the full task shape by default", async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerErrorHandler(app);
    registerTasksRoutes(app, dummyEnv);

    vi.spyOn(commandsModule, "lsAll").mockResolvedValue({
      data: fullLsJson,
      warnings: [],
      command: "ls",
      version: "1.0.0",
    });

    const res = await app.inject({ method: "GET", url: "/api/tasks" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.repos[0].tasks[0].description).toBe(
      "a very long description that a lean caller shouldn't have to pay for",
    );
    expect(body.data.repos[0].tasks[0].comments).toHaveLength(1);
  });

  it("strips everything but id/display_id/title when light=true", async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerErrorHandler(app);
    registerTasksRoutes(app, dummyEnv);

    vi.spyOn(commandsModule, "lsAll").mockResolvedValue({
      data: fullLsJson,
      warnings: [],
      command: "ls",
      version: "1.0.0",
    });

    const res = await app.inject({ method: "GET", url: "/api/tasks?light=true" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.data.repos).toEqual([
      {
        name: "my-repo",
        tasks: [{ id: "abc123", display_id: "MR-abc123", title: "Fix the thing" }],
      },
    ]);
  });
});
