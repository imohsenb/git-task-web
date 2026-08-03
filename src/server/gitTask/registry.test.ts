import { describe, expect, it } from "vitest";
import { resolveBin } from "../env.js";
import { getRegistry, resolveRepo } from "./registry.js";
import { GitTaskError } from "./errors.js";
import { TestRepo } from "./testRepo.js";

const bin = resolveBin();

describe.skipIf(!bin)("registry cache", () => {
  it("caches within the TTL — same object reference on a second call", async () => {
    const repo = TestRepo.create();
    const ctx = { bin: bin!, cwd: repo.path, configDir: repo.configDir };

    const first = await getRegistry(ctx);
    const second = await getRegistry(ctx);
    // Same reference proves the second call didn't re-spawn and re-parse JSON.
    expect(second).toBe(first);
  });

  it("force bypasses the cache and returns a fresh object", async () => {
    const repo = TestRepo.create();
    const ctx = { bin: bin!, cwd: repo.path, configDir: repo.configDir };

    const first = await getRegistry(ctx);
    const second = await getRegistry(ctx, { force: true });
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });

  it("resolveRepo throws not_found (404) for an unregistered name", async () => {
    const repo = TestRepo.create();
    const ctx = { bin: bin!, cwd: repo.path, configDir: repo.configDir };

    await expect(resolveRepo(ctx, "does-not-exist")).rejects.toMatchObject({
      kind: "not_found",
      httpStatus: 404,
    } satisfies Partial<GitTaskError>);
  });
});
