import type { TaskPrsResponseJson } from "../../../shared/contract.js";
import { detectRemotePlatform, type ParsedRemote } from "./parser.js";
import type { PrProvider } from "./types.js";
import { GitHubProvider } from "./github.js";
import { GitLabProvider } from "./gitlab.js";

const DEFAULT_TTL_MS = 120_000; // 2 minutes cache TTL

interface CacheEntry {
  expiresAt: number;
  data: TaskPrsResponseJson;
}

export class PrService {
  private providers: Map<string, PrProvider> = new Map();
  private cache = new Map<string, CacheEntry>();
  private ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
    this.registerProvider(new GitHubProvider());
    this.registerProvider(new GitLabProvider());
  }

  registerProvider(provider: PrProvider) {
    this.providers.set(provider.platform, provider);
  }

  clearCache() {
    this.cache.clear();
  }

  async getTaskPrs(
    repoPath: string,
    remotes: { name: string; url: string | null }[] | null | undefined,
    taskId: string,
    opts: { force?: boolean } = {},
  ): Promise<TaskPrsResponseJson> {
    const remote = detectRemotePlatform(remotes);
    if (!remote || remote.platform === "unknown") {
      return {
        platform: remote?.platform ?? null,
        providerName: remote?.providerName ?? null,
        cliAvailable: false,
        cliName: null,
        prs: [],
      };
    }

    const provider = this.providers.get(remote.platform);
    if (!provider) {
      return {
        platform: remote.platform,
        providerName: remote.providerName,
        cliAvailable: false,
        cliName: remote.cliName,
        prs: [],
      };
    }

    const cliAvailable = await provider.checkCliAvailable();
    if (!cliAvailable) {
      return {
        platform: remote.platform,
        providerName: remote.providerName,
        cliAvailable: false,
        cliName: remote.cliName,
        prs: [],
      };
    }

    const cacheKey = `${repoPath}:${taskId}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (!opts.force && cached && cached.expiresAt > now) {
      return cached.data;
    }

    const prs = await provider.fetchPrs(repoPath, remote, taskId);

    const response: TaskPrsResponseJson = {
      platform: remote.platform,
      providerName: remote.providerName,
      cliAvailable: true,
      cliName: remote.cliName,
      prs,
    };

    this.cache.set(cacheKey, {
      expiresAt: now + this.ttlMs,
      data: response,
    });

    return response;
  }
}

export const defaultPrService = new PrService();
