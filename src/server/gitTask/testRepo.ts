import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * A throwaway git repo + isolated GIT_TASK_CONFIG_DIR for executor tests — mirrors
 * git-task/tests/common/mod.rs's TestRepo, minus the parts (clone_from, cmd_from)
 * this phase doesn't need yet.
 */
export class TestRepo {
  private constructor(
    readonly path: string,
    readonly configDir: string,
  ) {}

  static create(): TestRepo {
    const repo = TestRepo.bare();
    repo.git(["config", "user.name", "Test User"]);
    repo.git(["config", "user.email", "test@example.com"]);
    return repo;
  }

  /** A repo with no user.name/user.email set anywhere reachable — for identity_missing tests. */
  static bare(): TestRepo {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "gtw-repo-")));
    const configDir = realpathSync(mkdtempSync(join(tmpdir(), "gtw-config-")));
    const repo = new TestRepo(dir, configDir);
    repo.git(["init", "-q"]);
    return repo;
  }

  /** A second repo sharing another TestRepo's configDir — mirrors
   * git-task/tests/common/mod.rs's new_with_shared_config. Needed for registry tests
   * where two distinct repos must compete for the same registry (e.g. a name
   * collision) rather than each getting their own isolated one. */
  static createWithSharedConfig(configDir: string): TestRepo {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "gtw-repo-")));
    const repo = new TestRepo(dir, configDir);
    repo.git(["init", "-q"]);
    repo.git(["config", "user.name", "Test User"]);
    repo.git(["config", "user.email", "test@example.com"]);
    return repo;
  }

  /** A bare remote for clone tests — mirrors git-task/tests/sync.rs's init_bare. Not a
   * TestRepo itself (no GIT_TASK_CONFIG_DIR of its own): it only ever plays the role
   * of a push/clone target. */
  static bareRemote(): string {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "gtw-bare-")));
    const result = spawnSync("git", ["init", "-q", "--bare", dir]);
    if (result.status !== 0) {
      throw new Error(`git init --bare failed: ${result.stderr}`);
    }
    return dir;
  }

  /** Env that hides global/system git config, so "no identity anywhere" is reliable
   * regardless of what's set up on the machine running the tests. */
  noGlobalIdentityEnv(): NodeJS.ProcessEnv {
    const fakeHome = join(this.path, "..", "nonexistent-home");
    return {
      HOME: fakeHome,
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_CONFIG_GLOBAL: join(fakeHome, ".gitconfig"),
    };
  }

  git(args: string[]) {
    const result = spawnSync("git", args, { cwd: this.path, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
    }
  }
}
