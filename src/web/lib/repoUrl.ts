import { detectRemotePlatform, remoteWebUrl } from "../../shared/remoteUrl";

/** null unless the repo's origin (or a fallback remote) resolves to a recognized
 * GitHub/GitLab host — an unknown or missing remote gets no link rather than a
 * guessed URL. */
export function repoWebUrl(remotes: { name: string; url: string | null }[] | null | undefined): string | null {
  const remote = detectRemotePlatform(remotes);
  if (!remote || remote.platform === "unknown") return null;
  return remoteWebUrl(remote);
}
