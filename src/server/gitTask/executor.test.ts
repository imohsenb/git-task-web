import { describe, expect, it } from "vitest";
import { resolveBin } from "../env.js";
import { whoami } from "./commands.js";
import { runGitTask } from "./executor.js";
import { mutationJsonSchema } from "../../shared/contract.zod.js";
import { GitTaskError } from "./errors.js";
import { TestRepo } from "./testRepo.js";

const bin = resolveBin();

// Skips instead of failing when no git-task binary is on this machine — these are
// integration tests against the real compiled binary, mirroring git-task's own
// tests/common/mod.rs fixture pattern.
describe.skipIf(!bin)("executor against a real git-task binary", () => {
  it("whoami reports repo + global + effective identity when git config is set", async () => {
    const repo = TestRepo.create();
    const identity = await whoami({ bin: bin!, cwd: repo.path, configDir: repo.configDir });

    expect(identity.repo?.ok).toBe(true);
    expect(identity.repo?.email).toBe("test@example.com");
    expect(identity.effective.email).toBe("test@example.com");
    expect(identity.effective.source).toBe("repo");
  });

  it("whoami reports ok:false with source 'none' when no identity is configured anywhere", async () => {
    const repo = TestRepo.bare();
    const identity = await whoami({
      bin: bin!,
      cwd: repo.path,
      configDir: repo.configDir,
      env: repo.noGlobalIdentityEnv(),
    });

    expect(identity.repo?.ok).toBe(false);
    expect(identity.global.ok).toBe(false);
    expect(identity.effective.ok).toBe(false);
    expect(identity.effective.source).toBe("none");
  });

  it("a mutating command throws GitTaskError(identity_missing) with clean context when identity is unset", async () => {
    const repo = TestRepo.bare();

    const attempt = runGitTask(mutationJsonSchema, {
      bin: bin!,
      cwd: repo.path,
      configDir: repo.configDir,
      env: repo.noGlobalIdentityEnv(),
      args: ["new", "a task", "--desc", "description"],
      commandLabel: "new",
    });

    await expect(attempt).rejects.toThrow(GitTaskError);
    try {
      await attempt;
      expect.unreachable("expected identity_missing to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(GitTaskError);
      const gitErr = err as GitTaskError;
      expect(gitErr.kind).toBe("identity_missing");
      expect(gitErr.httpStatus).toBe(412);
      expect(gitErr.context?.missing).toEqual(["user.name", "user.email"]);
    }
  });

  it("a successful mutation returns the created task via the executor's zod-validated data", async () => {
    const repo = TestRepo.create();

    const result = await runGitTask(mutationJsonSchema, {
      bin: bin!,
      cwd: repo.path,
      configDir: repo.configDir,
      args: ["new", "a task", "--desc", "description"],
      commandLabel: "new",
    });

    expect(result.data.created).toBe(true);
    expect(result.data.task.title).toBe("a task");
    expect(result.data.task.display_id).toMatch(/^[A-Z0-9]+-[0-9a-f]{8}$/);
  });
});
