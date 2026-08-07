import { describe, expect, it } from "vitest";
import { resolveBin } from "../env.js";
import { cachedLsHere, invalidateLsCache } from "./lsCache.js";
import { runGitTask } from "./executor.js";
import { mutationJsonSchema } from "../../shared/contract.zod.js";
import { TestRepo } from "./testRepo.js";

const bin = resolveBin();

async function seedTask(ctx: { bin: string; cwd: string; configDir: string }, title: string) {
  await runGitTask(mutationJsonSchema, {
    ...ctx,
    args: ["new", title, `--desc=${title} description`],
    commandLabel: "new",
  });
}

describe.skipIf(!bin)("cachedLsHere", () => {
  it("returns the same object on repeated calls with no ref changes", async () => {
    const repo = TestRepo.create();
    const ctx = { bin: bin!, cwd: repo.path, configDir: repo.configDir };
    await seedTask(ctx, "task one");

    const first = await cachedLsHere(ctx);
    const second = await cachedLsHere(ctx);
    expect(second).toBe(first);
    expect(first.data.total).toBe(1);
  });

  it("busts the cache when a new task changes the ref digest", async () => {
    const repo = TestRepo.create();
    const ctx = { bin: bin!, cwd: repo.path, configDir: repo.configDir };
    await seedTask(ctx, "task one");

    const first = await cachedLsHere(ctx);
    expect(first.data.total).toBe(1);

    await seedTask(ctx, "task two");
    // The digest TTL is 2s, so within that window a write needs an explicit invalidate
    // for immediate consistency — the write routes do this (phase 4); simulate it here.
    invalidateLsCache(repo.path);
    const second = await cachedLsHere(ctx);
    expect(second.data.total).toBe(2);
    expect(second).not.toBe(first);
  });

  it("caches different filter combinations separately", async () => {
    const repo = TestRepo.create();
    const ctx = { bin: bin!, cwd: repo.path, configDir: repo.configDir };
    await seedTask(ctx, "task one");

    const unfiltered = await cachedLsHere(ctx);
    const filtered = await cachedLsHere(ctx, { status: "doing" });

    expect(unfiltered.data.total).toBe(1);
    expect(filtered.data.total).toBe(0);
    expect(filtered.data.filters_applied.status).toBe("doing");
  });
});
