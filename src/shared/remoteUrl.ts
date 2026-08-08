import type { PrPlatform } from "./contract.js";

export interface ParsedRemote {
  platform: PrPlatform;
  providerName: "GitHub" | "GitLab" | null;
  cliName: "gh" | "glab" | null;
  owner: string;
  repo: string;
  domain: string;
  rawUrl: string;
}

/**
  Extract host, owner, and repository name from git remote URLs.
  Supports SSH (git@..., ssh://...), HTTPS (including masked credentials https://***@...), and .git suffixes.
 */
export function parseRemoteUrl(url: string): ParsedRemote | null {
  if (!url) return null;

  // 1. SSH format: git@domain:owner/repo.git or ssh://git@domain/owner/repo.git
  const sshScpMatch = url.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i);
  const sshUriMatch = url.match(/^ssh:\/\/(?:git@)?([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i);

  // 2. HTTP(S) format: https://[user:pass@]domain/owner/repo.git or https://***@domain/owner/repo.git
  const httpMatch = url.match(/^https?:\/\/(?:[^@/]+@)?([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i);

  const match = sshScpMatch || sshUriMatch || httpMatch;
  if (!match) return null;

  const domain = match[1].toLowerCase();
  const owner = match[2];
  const repo = match[3];

  let platform: PrPlatform = "unknown";
  let providerName: ParsedRemote["providerName"] = null;
  let cliName: ParsedRemote["cliName"] = null;

  if (domain.includes("github")) {
    platform = "github";
    providerName = "GitHub";
    cliName = "gh";
  } else if (domain.includes("gitlab")) {
    platform = "gitlab";
    providerName = "GitLab";
    cliName = "glab";
  }

  return {
    platform,
    providerName,
    cliName,
    owner,
    repo,
    domain,
    rawUrl: url,
  };
}

export function detectRemotePlatform(
  remotes: { name: string; url: string | null }[] | null | undefined,
): ParsedRemote | null {
  if (!remotes || remotes.length === 0) return null;

  // Prefer "origin" remote if available
  const origin = remotes.find((r) => r.name === "origin" && r.url);
  if (origin?.url) {
    const parsed = parseRemoteUrl(origin.url);
    if (parsed) return parsed;
  }

  // Fallback to any valid remote
  for (const remote of remotes) {
    if (remote.url) {
      const parsed = parseRemoteUrl(remote.url);
      if (parsed) return parsed;
    }
  }

  return null;
}

/** The browsable https URL for a parsed remote — github.com/gitlab.com repo page,
 * for a "view on GitHub/GitLab" link. Only meaningful for a recognized platform;
 * an unrecognized host still has owner/repo/domain, so this still returns a
 * best-effort https URL rather than forcing every caller to null-check platform. */
export function remoteWebUrl(remote: ParsedRemote): string {
  return `https://${remote.domain}/${remote.owner}/${remote.repo}`;
}
