import type { FastifyReply } from "fastify";
import { computeRefDigest } from "./refDigest.js";

interface RepoChangedEvent {
  type: "repo-changed";
  repo: string;
  digest: string;
}

const subscribers = new Set<FastifyReply>();

/** Last digest broadcast per repo path — lets the 5s poller (below) tell "nothing
 * changed" from "changed since we last told anyone", and stops it from re-announcing
 * a write this same server just made via notifyRepoChanged. */
const lastDigests = new Map<string, string>();

export function subscribe(reply: FastifyReply): void {
  subscribers.add(reply);
}

export function unsubscribe(reply: FastifyReply): void {
  subscribers.delete(reply);
}

export function hasSubscribers(): boolean {
  return subscribers.size > 0;
}

function broadcast(repo: string, digest: string): void {
  const event: RepoChangedEvent = { type: "repo-changed", repo, digest };
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const reply of subscribers) {
    reply.raw.write(payload);
  }
}

/** Call right after any write to repoPath (task mutation, push, or pull) — this
 * server always knows the digest just changed, so it broadcasts unconditionally
 * rather than re-reading and comparing first. */
export function notifyRepoChanged(repoName: string, repoPath: string): void {
  const digest = computeRefDigest(repoPath);
  lastDigests.set(repoPath, digest);
  broadcast(repoName, digest);
}

/**
 * §3.4: "a 5s ref-digest poll for repos with an open subscriber" — catches changes
 * this server didn't make itself (a concurrent terminal `git task status`, another
 * git-task-web instance sharing the same registry). Skipped entirely with no open
 * connections, so an idle app with no browser tab open costs nothing.
 */
export function pollForChanges(repos: { name: string; path: string }[]): void {
  if (!hasSubscribers()) return;
  for (const repo of repos) {
    const digest = computeRefDigest(repo.path);
    if (lastDigests.get(repo.path) !== digest) {
      lastDigests.set(repo.path, digest);
      broadcast(repo.name, digest);
    }
  }
}
