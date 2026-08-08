import type { PullRequestJson, PrPlatform } from "../../../shared/contract.js";
import type { ParsedRemote } from "./parser.js";

export interface PrProvider {
  platform: PrPlatform;
  providerName: "GitHub" | "GitLab";
  cliName: "gh" | "glab";
  checkCliAvailable(): Promise<boolean>;
  fetchPrs(repoPath: string, remote: ParsedRemote, taskId: string): Promise<PullRequestJson[]>;
  fetchOpenPrs(repoPath: string, remote: ParsedRemote): Promise<PullRequestJson[]>;
}
