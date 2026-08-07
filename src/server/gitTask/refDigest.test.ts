import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolveBin } from "../env.js";
import { computeRefDigest } from "./refDigest.js";
import { TestRepo } from "./testRepo.js";

const bin = resolveBin();

function newTask(repo: TestRepo, title: string) {
  const result = spawnSync(bin!, ["new", title, `--desc=${title} description`, "--format", "json"], {
    cwd: repo.path,
    env: { ...process.env, GIT_TASK_CONFIG_DIR: repo.configDir },
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`git-task new failed: ${result.stderr}`);
}

describe.skipIf(!bin)("computeRefDigest", () => {
  it("is stable across repeated calls with no ref changes", () => {
    const repo = TestRepo.create();
    newTask(repo, "task one");

    const a = computeRefDigest(repo.path);
    const b = computeRefDigest(repo.path);
    expect(a).toBe(b);
  });

  it("changes when a new task ref is created", () => {
    const repo = TestRepo.create();
    newTask(repo, "task one");
    const before = computeRefDigest(repo.path);

    newTask(repo, "task two");
    const after = computeRefDigest(repo.path);

    expect(after).not.toBe(before);
  });

  it("is empty-repo stable and non-throwing when there are no tasks yet", () => {
    const repo = TestRepo.create();
    expect(() => computeRefDigest(repo.path)).not.toThrow();
    expect(computeRefDigest(repo.path)).toBe(computeRefDigest(repo.path));
  });

  it("matches after packing refs (loose vs packed-refs must agree)", () => {
    const repo = TestRepo.create();
    newTask(repo, "task one");
    const beforePack = computeRefDigest(repo.path);

    const pack = spawnSync("git", ["pack-refs", "--all"], { cwd: repo.path, encoding: "utf8" });
    expect(pack.status).toBe(0);

    const afterPack = computeRefDigest(repo.path);
    expect(afterPack).toBe(beforePack);
  });
});
