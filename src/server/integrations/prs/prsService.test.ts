import { describe, expect, it, vi } from "vitest";
import { PrService } from "./index.js";
import type { PrProvider } from "./types.js";
import type { ParsedRemote } from "./parser.js";
import type { PullRequestJson } from "../../../shared/contract.js";

class MockProvider implements PrProvider {
  platform = "github" as const;
  providerName = "GitHub" as const;
  cliName = "gh" as const;
  available = true;
  fetchCount = 0;
  fetchOpenCount = 0;

  async checkCliAvailable(): Promise<boolean> {
    return this.available;
  }

  async fetchPrs(_repoPath: string, _remote: ParsedRemote, _taskId: string): Promise<PullRequestJson[]> {
    this.fetchCount++;
    return [
      {
        id: "#101",
        title: "Test PR 101",
        url: "https://github.com/org/repo/pull/101",
        state: "open",
        provider: "github",
      },
    ];
  }

  async fetchOpenPrs(_repoPath: string, _remote: ParsedRemote): Promise<PullRequestJson[]> {
    this.fetchOpenCount++;
    return [
      {
        id: "#102",
        title: "Test PR 102",
        url: "https://github.com/org/repo/pull/102",
        state: "open",
        provider: "github",
      },
    ];
  }
}

describe("PrService", () => {
  it("returns cliAvailable = false when CLI tool is missing", async () => {
    const service = new PrService();
    const mock = new MockProvider();
    mock.available = false;
    service.registerProvider(mock);

    const remotes = [{ name: "origin", url: "git@github.com:org/repo.git" }];
    const res = await service.getTaskPrs("/tmp/repo", remotes, "t-1");

    expect(res.cliAvailable).toBe(false);
    expect(res.cliName).toBe("gh");
    expect(res.providerName).toBe("GitHub");
    expect(res.prs).toEqual([]);
    expect(mock.fetchCount).toBe(0);
  });

  it("caches PR results within TTL", async () => {
    const service = new PrService(60_000);
    const mock = new MockProvider();
    service.registerProvider(mock);

    const remotes = [{ name: "origin", url: "git@github.com:org/repo.git" }];
    
    // First call (miss)
    const res1 = await service.getTaskPrs("/tmp/repo", remotes, "t-1");
    expect(res1.prs).toHaveLength(1);
    expect(mock.fetchCount).toBe(1);

    // Second call (cached)
    const res2 = await service.getTaskPrs("/tmp/repo", remotes, "t-1");
    expect(res2.prs).toHaveLength(1);
    expect(mock.fetchCount).toBe(1);

    // Third call with force = true
    const res3 = await service.getTaskPrs("/tmp/repo", remotes, "t-1", { force: true });
    expect(res3.prs).toHaveLength(1);
    expect(mock.fetchCount).toBe(2);
  });
});

describe("PrService.getRepoPrs", () => {
  it("returns cliAvailable = false when CLI tool is missing", async () => {
    const service = new PrService();
    const mock = new MockProvider();
    mock.available = false;
    service.registerProvider(mock);

    const remotes = [{ name: "origin", url: "git@github.com:org/repo.git" }];
    const res = await service.getRepoPrs("/tmp/repo", remotes);

    expect(res.cliAvailable).toBe(false);
    expect(res.cliName).toBe("gh");
    expect(res.providerName).toBe("GitHub");
    expect(res.prs).toEqual([]);
    expect(mock.fetchOpenCount).toBe(0);
  });

  it("caches PR results within TTL, independently from task PR cache", async () => {
    const service = new PrService(60_000);
    const mock = new MockProvider();
    service.registerProvider(mock);

    const remotes = [{ name: "origin", url: "git@github.com:org/repo.git" }];

    // First call (miss)
    const res1 = await service.getRepoPrs("/tmp/repo", remotes);
    expect(res1.prs).toHaveLength(1);
    expect(res1.prs[0].id).toBe("#102");
    expect(mock.fetchOpenCount).toBe(1);

    // Second call (cached)
    const res2 = await service.getRepoPrs("/tmp/repo", remotes);
    expect(res2.prs).toHaveLength(1);
    expect(mock.fetchOpenCount).toBe(1);

    // Third call with force = true
    const res3 = await service.getRepoPrs("/tmp/repo", remotes, { force: true });
    expect(res3.prs).toHaveLength(1);
    expect(mock.fetchOpenCount).toBe(2);

    // A task-scoped call for the same repo is a separate cache entry
    await service.getTaskPrs("/tmp/repo", remotes, "t-1");
    expect(mock.fetchCount).toBe(1);
  });
});
