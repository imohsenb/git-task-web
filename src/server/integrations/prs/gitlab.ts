import { execa } from "execa";
import type { PullRequestJson, PrState } from "../../../shared/contract.js";
import type { ParsedRemote } from "./parser.js";
import type { PrProvider } from "./types.js";

interface GlabMrItem {
  iid: number;
  id?: number;
  title: string;
  web_url: string;
  state: string;
}

export class GitLabProvider implements PrProvider {
  platform = "gitlab" as const;
  providerName = "GitLab" as const;
  cliName = "glab" as const;

  async checkCliAvailable(): Promise<boolean> {
    try {
      const res = await execa("glab", ["--version"], { timeout: 3000, reject: false });
      return res.exitCode === 0;
    } catch {
      return false;
    }
  }

  async fetchPrs(repoPath: string, remote: ParsedRemote, taskId: string): Promise<PullRequestJson[]> {
    try {
      const repoArg = `${remote.owner}/${remote.repo}`;
      // Try glab mr list -F json first
      let res = await execa(
        "glab",
        ["mr", "list", "--repo", repoArg, "--search", taskId, "-F", "json"],
        {
          cwd: repoPath,
          timeout: 10000,
          reject: false,
        },
      );

      if (res.exitCode !== 0 || !res.stdout) {
        // Fallback to glab mr list --output json
        res = await execa(
          "glab",
          ["mr", "list", "--repo", repoArg, "--search", taskId, "--output", "json"],
          {
            cwd: repoPath,
            timeout: 10000,
            reject: false,
          },
        );
      }

      if (res.exitCode !== 0 || !res.stdout) {
        return [];
      }

      const items: GlabMrItem[] = JSON.parse(res.stdout);
      return items.map((item) => ({
        id: `!${item.iid ?? item.id}`,
        title: item.title,
        url: item.web_url,
        state: this.normalizeState(item.state),
        provider: "gitlab",
      }));
    } catch {
      return [];
    }
  }

  async fetchOpenPrs(repoPath: string, remote: ParsedRemote): Promise<PullRequestJson[]> {
    try {
      const repoArg = `${remote.owner}/${remote.repo}`;
      // Try glab mr list -F json first
      let res = await execa(
        "glab",
        ["mr", "list", "--repo", repoArg, "--state", "opened", "--per-page", "100", "-F", "json"],
        {
          cwd: repoPath,
          timeout: 10000,
          reject: false,
        },
      );

      if (res.exitCode !== 0 || !res.stdout) {
        // Fallback to glab mr list --output json
        res = await execa(
          "glab",
          ["mr", "list", "--repo", repoArg, "--state", "opened", "--per-page", "100", "--output", "json"],
          {
            cwd: repoPath,
            timeout: 10000,
            reject: false,
          },
        );
      }

      if (res.exitCode !== 0 || !res.stdout) {
        return [];
      }

      const items: GlabMrItem[] = JSON.parse(res.stdout);
      return items.map((item) => ({
        id: `!${item.iid ?? item.id}`,
        title: item.title,
        url: item.web_url,
        state: this.normalizeState(item.state),
        provider: "gitlab",
      }));
    } catch {
      return [];
    }
  }

  private normalizeState(rawState: string): PrState {
    const s = rawState.toLowerCase();
    if (s === "merged") return "merged";
    if (s === "closed") return "closed";
    return "open";
  }
}
