import { describe, expect, it } from "vitest";
import { resolveBin } from "../env.js";
import { lsHere, reposDeep, show } from "./commands.js";
import { runGitTask } from "./executor.js";
import { GitTaskError } from "./errors.js";
import { mutationJsonSchema } from "../../shared/contract.zod.js";
import { TestRepo } from "./testRepo.js";

const bin = resolveBin();

describe.skipIf(!bin)("commands against a real git-task binary", () => {
  it("lsHere lists tasks created in the repo", async () => {
    const repo = TestRepo.create();
    const ctx = { bin: bin!, cwd: repo.path, configDir: repo.configDir };
    const seeded = await runGitTask(mutationJsonSchema, {
      ...ctx,
      args: ["new", "seed task", "--desc=seed"],
      commandLabel: "new",
    });
    expect(seeded.data.task.title).toBe("seed task");

    const { data: ls } = await lsHere(ctx);
    expect(ls.total).toBe(1);
    expect(ls.repos[0]?.tasks[0]?.title).toBe("seed task");
  });

  it("lsHere with a dash-prefixed filter value does not misparse as a flag", async () => {
    const repo = TestRepo.create();
    const ctx = { bin: bin!, cwd: repo.path, configDir: repo.configDir };

    // A status value starting with '-' would break under "--status value" (clap reads
    // it as another flag); the =-joined form in lsFilterArgs must survive this.
    const { data: ls } = await lsHere(ctx, { status: "-weird" });
    expect(ls.filters_applied.status).toBe("-weird");
  });

  it("show with a dash-prefixed id resolves to not_found, not an argv parse error", async () => {
    const repo = TestRepo.create();
    const ctx = { bin: bin!, cwd: repo.path, configDir: repo.configDir };

    await expect(show(ctx, "-weirdid")).rejects.toMatchObject({ kind: "not_found" } satisfies Partial<GitTaskError>);
  });

  it("reposDeep returns the registry envelope shape", async () => {
    const repo = TestRepo.create();
    const ctx = { bin: bin!, cwd: repo.path, configDir: repo.configDir };
    const { data: registry } = await reposDeep(ctx);
    expect(registry).toHaveProperty("config_dir");
    expect(registry).toHaveProperty("repos");
  });
});
