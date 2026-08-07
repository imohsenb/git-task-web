import { describe, expect, it } from "vitest";
import { resolveBin } from "../env.js";
import { lsHere, newTask, pullRepo, pushRepo, setStatus, type GitTaskContext } from "./commands.js";
import { TestRepo } from "./testRepo.js";

const bin = resolveBin();

describe.skipIf(!bin)("push/pull against a real git-task binary", () => {
  function ctxFor(repo: TestRepo): GitTaskContext {
    return { bin: bin!, cwd: repo.path, configDir: repo.configDir };
  }

  function addOrigin(repo: TestRepo, bareRemote: string): void {
    repo.git(["remote", "add", "origin", bareRemote]);
  }

  it("§7 Sync convergence: two independent clones of one bare remote converge after push+pull both ways", async () => {
    const bareRemote = TestRepo.bareRemote();
    const alice = TestRepo.create();
    const bob = TestRepo.create();
    addOrigin(alice, bareRemote);
    addOrigin(bob, bareRemote);
    const aliceCtx = ctxFor(alice);
    const bobCtx = ctxFor(bob);

    await newTask(aliceCtx, { title: "alice task", kind: "task", description: "d" });
    const pushed = await pushRepo(aliceCtx);
    expect(pushed.data.pushed).toBe(1);
    expect(pushed.data.rejected).toEqual([]);

    const pulled = await pullRepo(bobCtx);
    expect(pulled.data.counts.new).toBe(1);

    await newTask(bobCtx, { title: "bob task", kind: "task", description: "d" });
    const bobPush = await pushRepo(bobCtx);
    // push always attempts every local task ref, not just ones that changed — bob has
    // his own new task plus alice's already-pushed one (a no-op re-push), so 2, not 1.
    expect(bobPush.data.pushed).toBe(2);
    expect(bobPush.data.rejected).toEqual([]);

    const alicePull = await pullRepo(aliceCtx);
    expect(alicePull.data.counts.new).toBe(1);

    const aliceLs = await lsHere(aliceCtx);
    const bobLs = await lsHere(bobCtx);
    expect(aliceLs.data.total).toBe(2);
    expect(bobLs.data.total).toBe(2);
    expect(new Set(aliceLs.data.repos[0]?.tasks.map((t) => t.id))).toEqual(
      new Set(bobLs.data.repos[0]?.tasks.map((t) => t.id)),
    );
  });

  it("pullRepo with nothing new reports up_to_date, not a spurious new/merged count", async () => {
    const bareRemote = TestRepo.bareRemote();
    const alice = TestRepo.create();
    const bob = TestRepo.create();
    addOrigin(alice, bareRemote);
    addOrigin(bob, bareRemote);

    await newTask(ctxFor(alice), { title: "t", kind: "task", description: "d" });
    await pushRepo(ctxFor(alice));
    await pullRepo(ctxFor(bob));

    const second = await pullRepo(ctxFor(bob));
    expect(second.data.counts).toEqual({ new: 0, fast_forwarded: 0, merged: 0, up_to_date: 1 });
  });

  it("pushRepo reclassifies a stale non-fast-forward push as kind 'rejected' (409), not 'internal' (500)", async () => {
    const bareRemote = TestRepo.bareRemote();
    const alice = TestRepo.create();
    const carol = TestRepo.create();
    addOrigin(alice, bareRemote);
    addOrigin(carol, bareRemote);
    const aliceCtx = ctxFor(alice);
    const carolCtx = ctxFor(carol);

    const { data: created } = await newTask(aliceCtx, { title: "shared task", kind: "task", description: "d" });
    await pushRepo(aliceCtx);

    // Carol pulls the same task, moves it forward, and pushes — the remote's ref for
    // this task is now ahead of what alice has locally.
    await pullRepo(carolCtx);
    await setStatus(carolCtx, created.task.display_id, "doing");
    await pushRepo(carolCtx);

    // Alice, still holding the pre-Carol oid for that ref, tries to push again.
    await expect(pushRepo(aliceCtx)).rejects.toMatchObject({ kind: "rejected", httpStatus: 409 });
  });

  it("pushRepo reclassifies an unreachable remote as kind 'remote' (502), not 'internal' (500)", async () => {
    const alice = TestRepo.create();
    alice.git(["remote", "add", "badremote", "https://nonexistent-host-xyz-git-task-web-test.invalid/repo.git"]);
    await newTask(ctxFor(alice), { title: "t", kind: "task", description: "d" });

    await expect(pushRepo(ctxFor(alice), "badremote")).rejects.toMatchObject({ kind: "remote", httpStatus: 502 });
  });
});
