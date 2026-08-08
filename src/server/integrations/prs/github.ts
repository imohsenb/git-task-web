import { execa } from "execa";
import type { PullRequestJson, PrState } from "../../../shared/contract.js";
import type { ParsedRemote } from "./parser.js";
import type { PrProvider } from "./types.js";

interface GhPrItem {
  number: number;
  title: string;
  url: string;
  state: string;
}

export class GitHubProvider implements PrProvider {
  platform = "github" as const;
  providerName = "GitHub" as const;
  cliName = "gh" as const;

  async checkCliAvailable(): Promise<boolean> {
    try {
      const res = await execa("gh", ["--version"], { timeout: 3000, reject: false });
      return res.exitCode === 0;
    } catch {
      return false;
    }
  }

  async fetchPrs(repoPath: string, remote: ParsedRemote, taskId: string): Promise<PullRequestJson[]> {
    try {
      const repoArg = `${remote.owner}/${remote.repo}`;
      const res = await execa(
        "gh",
        ["pr", "list", "--repo", repoArg, "--search", taskId, "--state", "all", "--json", "number,title,url,state"],
        {
          cwd: repoPath,
          timeout: 10000,
          reject: false,
        },
      );

      if (res.exitCode !== 0 || !res.stdout) {
        return [];
      }

      const items: GhPrItem[] = JSON.parse(res.stdout);
      return items.map((item) => ({
        id: `#${item.number}`,
        title: item.title,
        url: item.url,
        state: this.normalizeState(item.state),
        provider: "github",
      }));
    } catch {
      return [];
    }
  }

  async fetchOpenPrs(repoPath: string, remote: ParsedRemote): Promise<PullRequestJson[]> {
    try {
      const repoArg = `${remote.owner}/${remote.repo}`;
      const res = await execa(
        "gh",
        ["pr", "list", "--repo", repoArg, "--state", "open", "--limit", "100", "--json", "number,title,url,state"],
        {
          cwd: repoPath,
          timeout: 10000,
          reject: false,
        },
      );

      if (res.exitCode !== 0 || !res.stdout) {
        return [];
      }

      const items: GhPrItem[] = JSON.parse(res.stdout);
      return items.map((item) => ({
        id: `#${item.number}`,
        title: item.title,
        url: item.url,
        state: this.normalizeState(item.state),
        provider: "github",
      }));
    } catch {
      return [];
    }
  }

  private normalizeState(rawState: string): PrState {
    const s = rawState.toUpperCase();
    if (s === "MERGED") return "merged";
    if (s === "CLOSED") return "closed";
    return "open";
  }
}
