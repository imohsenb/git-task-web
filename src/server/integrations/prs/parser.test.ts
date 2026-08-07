import { describe, expect, it } from "vitest";
import { parseRemoteUrl, detectRemotePlatform } from "./parser.js";

describe("parseRemoteUrl", () => {
  it("parses GitHub SSH URLs", () => {
    const result = parseRemoteUrl("git@github.com:imohsenb/git-task-web.git");
    expect(result).toEqual({
      platform: "github",
      providerName: "GitHub",
      cliName: "gh",
      owner: "imohsenb",
      repo: "git-task-web",
      domain: "github.com",
      rawUrl: "git@github.com:imohsenb/git-task-web.git",
    });
  });

  it("parses GitHub HTTPS URLs (including masked tokens)", () => {
    const result = parseRemoteUrl("https://***@github.com/imohsenb/git-task-web.git");
    expect(result).toEqual({
      platform: "github",
      providerName: "GitHub",
      cliName: "gh",
      owner: "imohsenb",
      repo: "git-task-web",
      domain: "github.com",
      rawUrl: "https://***@github.com/imohsenb/git-task-web.git",
    });
  });

  it("parses GitLab SSH URLs", () => {
    const result = parseRemoteUrl("git@gitlab.com:my-org/my-project.git");
    expect(result).toEqual({
      platform: "gitlab",
      providerName: "GitLab",
      cliName: "glab",
      owner: "my-org",
      repo: "my-project",
      domain: "gitlab.com",
      rawUrl: "git@gitlab.com:my-org/my-project.git",
    });
  });

  it("parses GitLab HTTPS URLs", () => {
    const result = parseRemoteUrl("https://gitlab.com/my-org/my-project");
    expect(result).toEqual({
      platform: "gitlab",
      providerName: "GitLab",
      cliName: "glab",
      owner: "my-org",
      repo: "my-project",
      domain: "gitlab.com",
      rawUrl: "https://gitlab.com/my-org/my-project",
    });
  });

  it("returns platform unknown for unidentified git domains", () => {
    const result = parseRemoteUrl("git@custom-git.internal:company/repo.git");
    expect(result).toEqual({
      platform: "unknown",
      providerName: null,
      cliName: null,
      owner: "company",
      repo: "repo",
      domain: "custom-git.internal",
      rawUrl: "git@custom-git.internal:company/repo.git",
    });
  });
});

describe("detectRemotePlatform", () => {
  it("selects origin remote first", () => {
    const remotes = [
      { name: "upstream", url: "git@gitlab.com:org/repo.git", push_url: null },
      { name: "origin", url: "git@github.com:user/repo.git", push_url: null },
    ];
    const result = detectRemotePlatform(remotes);
    expect(result?.platform).toBe("github");
  });
});
