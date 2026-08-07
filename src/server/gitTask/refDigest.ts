import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * §3.4 cache invalidation signal: sha256 of sorted "<refname> <oid>" for refs/tasks/*,
 * read directly off disk (no subprocess — a few ms even for a repo with thousands of
 * tasks). Assumes a normal, non-bare repo layout (git-task's own `clone` always
 * creates one — see git-task/src/cli/clone.rs, Repository::init not init_bare). Linked
 * worktrees aren't handled; that's an accepted gap, not a supported layout here.
 */
export function computeRefDigest(repoPath: string): string {
  const merged = new Map<string, string>();

  // Loose refs take precedence over packed — matches git's own resolution order.
  for (const { name, oid } of readPackedRefs(repoPath)) merged.set(name, oid);
  for (const { name, oid } of readLooseRefs(repoPath)) merged.set(name, oid);

  const lines = [...merged.entries()]
    .map(([name, oid]) => `${name} ${oid}`)
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function readLooseRefs(repoPath: string): { name: string; oid: string }[] {
  const dir = join(repoPath, ".git", "refs", "tasks");
  if (!existsSync(dir)) return [];

  const entries: { name: string; oid: string }[] = [];
  for (const file of readdirSync(dir)) {
    try {
      const oid = readFileSync(join(dir, file), "utf8").trim();
      entries.push({ name: `refs/tasks/${file}`, oid });
    } catch {
      // Ref file vanished between readdir and read — a concurrent writer moved past
      // us. Skip it; the next digest read will see wherever things landed.
    }
  }
  return entries;
}

function readPackedRefs(repoPath: string): { name: string; oid: string }[] {
  const file = join(repoPath, ".git", "packed-refs");
  if (!existsSync(file)) return [];

  const entries: { name: string; oid: string }[] = [];
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return [];
  }

  for (const line of content.split("\n")) {
    if (!line || line.startsWith("#") || line.startsWith("^")) continue;
    const spaceIdx = line.indexOf(" ");
    if (spaceIdx === -1) continue;
    const oid = line.slice(0, spaceIdx);
    const name = line.slice(spaceIdx + 1).trim();
    if (name.startsWith("refs/tasks/")) entries.push({ name, oid });
  }
  return entries;
}
