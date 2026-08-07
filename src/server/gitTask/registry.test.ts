import { describe, expect, it } from "vitest";
import { resolveBin } from "../env.js";
import { getRegistry, maskRegistry, resolveRepo } from "./registry.js";
import { GitTaskError } from "./errors.js";
import { TestRepo } from "./testRepo.js";
import type { RegistryJson } from "../../shared/contract.js";

const bin = resolveBin();

function repoFixture(remotes: { name: string; url: string | null; push_url: string | null }[]): RegistryJson {
  return {
    config_dir: "/cfg",
    default_project: "main",
    projects: ["main"],
    repos: [
      {
        name: "r",
        path: "/repo",
        project: "main",
        exists: true,
        openable: true,
        key: "R",
        branch: "main",
        task_count: 0,
        open_task_count: 0,
        remotes,
        identity: null,
        error: null,
      },
    ],
  };
}

describe("maskRegistry", () => {
  it("masks a PAT embedded in an https remote URL", () => {
    const masked = maskRegistry(
      repoFixture([{ name: "origin", url: "https://ghp_abc123secret@github.com/org/repo.git", push_url: null }]),
    );
    expect(masked.repos[0]?.remotes?.[0]?.url).toBe("https://***@github.com/org/repo.git");
  });

  it("masks user:pass form the same way", () => {
    const masked = maskRegistry(repoFixture([{ name: "origin", url: "https://user:hunter2@example.com/x.git", push_url: null }]));
    expect(masked.repos[0]?.remotes?.[0]?.url).toBe("https://***@example.com/x.git");
  });

  it("leaves a credential-free https URL and an SSH URL untouched", () => {
    const masked = maskRegistry(
      repoFixture([
        { name: "origin", url: "https://github.com/org/repo.git", push_url: null },
        { name: "backup", url: "git@github.com:org/repo.git", push_url: null },
      ]),
    );
    expect(masked.repos[0]?.remotes?.[0]?.url).toBe("https://github.com/org/repo.git");
    expect(masked.repos[0]?.remotes?.[1]?.url).toBe("git@github.com:org/repo.git");
  });

  it("passes through null remotes/urls without throwing", () => {
    const masked = maskRegistry(repoFixture([{ name: "origin", url: null, push_url: null }]));
    expect(masked.repos[0]?.remotes?.[0]?.url).toBeNull();

    const noRemotes: RegistryJson = { ...repoFixture([]), repos: [{ ...repoFixture([]).repos[0]!, remotes: null }] };
    expect(maskRegistry(noRemotes).repos[0]?.remotes).toBeNull();
  });
});

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
