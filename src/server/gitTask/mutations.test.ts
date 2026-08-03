import { describe, expect, it } from "vitest";
import { resolveBin } from "../env.js";
import {
  addComment,
  addLabel,
  addLink,
  clearParent,
  clearParentIfSet,
  dropTask,
  deleteTask,
  editComment,
  editTask,
  newTask,
  removeLabel,
  removeLink,
  setParent,
  setStatus,
  show,
  type GitTaskContext,
} from "./commands.js";
import { TestRepo } from "./testRepo.js";

const bin = resolveBin();

describe.skipIf(!bin)("mutation commands against a real git-task binary", () => {
  function ctxFor(repo: TestRepo): GitTaskContext {
    return { bin: bin!, cwd: repo.path, configDir: repo.configDir };
  }

  it("newTask creates a task and survives a dash-prefixed title", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data } = await newTask(ctx, { title: "-weird title", kind: "bug", description: "d" });
    expect(data.task.title).toBe("-weird title");
    expect(data.task.kind).toBe("bug");
    expect(data.created).toBe(true);
  });

  it("newTask passes every optional field through", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data } = await newTask(ctx, {
      title: "full",
      kind: "story",
      description: "d",
      assignee: "a@b.com",
      labels: ["x", "-y"],
      priority: "high",
      due: "2026-09-01",
      milestone: "v1",
      status: "doing",
    });
    expect(data.task.assignee).toBe("a@b.com");
    expect(data.task.labels).toEqual(["-y", "x"]);
    expect(data.task.priority).toBe("high");
    expect(data.task.due).toBe("2026-09-01");
    expect(data.task.milestone).toBe("v1");
    expect(data.task.status).toBe("doing");
  });

  it("editTask returns null and never spawns when nothing actually changed", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: created } = await newTask(ctx, { title: "t", kind: "task", description: "d" });
    const result = await editTask(ctx, created.task.display_id, { title: "t", description: "d" });
    expect(result).toBeNull();
  });

  it("editTask sends only the field that actually changed", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: created } = await newTask(ctx, { title: "t", kind: "task", description: "d" });
    const result = await editTask(ctx, created.task.display_id, { title: "new title", description: "d" });
    expect(result).not.toBeNull();
    expect(result!.data.ops).toEqual(["SetTitle"]);
    expect(result!.data.task.title).toBe("new title");
  });

  it("editTask clears a field only when it was actually set", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: created } = await newTask(ctx, { title: "t", kind: "task", description: "d", priority: "low" });

    const cleared = await editTask(ctx, created.task.display_id, { priority: null });
    expect(cleared!.data.ops).toEqual(["ClearPriority"]);
    expect(cleared!.data.task.priority).toBeNull();

    // Already null — clearing again is a no-op, no spawn.
    const noop = await editTask(ctx, created.task.display_id, { priority: null });
    expect(noop).toBeNull();
  });

  it("setStatus round-trips a dash-prefixed status value verbatim", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: created } = await newTask(ctx, { title: "t", kind: "task", description: "d" });
    const { data } = await setStatus(ctx, created.task.display_id, "-weird-status");
    expect(data.task.status).toBe("-weird-status");
  });

  it("addComment then editComment updates the same comment by number", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: created } = await newTask(ctx, { title: "t", kind: "task", description: "d" });
    const added = await addComment(ctx, created.task.display_id, "-weird comment");
    expect(added.data.task.comments).toHaveLength(1);
    expect(added.data.task.comments[0]?.text).toBe("-weird comment");

    const edited = await editComment(ctx, created.task.display_id, 1, "edited text");
    expect(edited.data.task.comments[0]?.text).toBe("edited text");
    expect(edited.data.task.comments[0]?.edited).toBe(true);
  });

  it("addLabel then removeLabel round-trips a dash-prefixed label", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: created } = await newTask(ctx, { title: "t", kind: "task", description: "d" });

    const added = await addLabel(ctx, created.task.display_id, "-weird-label");
    expect(added.data.task.labels).toContain("-weird-label");

    const removed = await removeLabel(ctx, created.task.display_id, "-weird-label");
    expect(removed.data.task.labels).not.toContain("-weird-label");
  });

  it("setParent/clearParent link and unlink an epic; clearParentIfSet is a no-op with no parent", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: epic } = await newTask(ctx, { title: "epic", kind: "epic", description: "d" });
    const { data: child } = await newTask(ctx, { title: "child", kind: "task", description: "d" });

    const noop = await clearParentIfSet(ctx, child.task.display_id);
    expect(noop).toBeNull();

    const linked = await setParent(ctx, epic.task.display_id, child.task.display_id);
    expect(linked.data.task.parent_display_id).toBe(epic.task.display_id);

    const unlinked = await clearParentIfSet(ctx, child.task.display_id);
    expect(unlinked!.data.task.parent).toBeNull();
  });

  it("clearParent removes the link given an explicit epic id", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: epic } = await newTask(ctx, { title: "epic", kind: "epic", description: "d" });
    const { data: child } = await newTask(ctx, { title: "child", kind: "task", description: "d" });
    await setParent(ctx, epic.task.display_id, child.task.display_id);

    const unlinked = await clearParent(ctx, epic.task.display_id, child.task.display_id);
    expect(unlinked.data.task.parent).toBeNull();
  });

  it("addLink then removeLink round-trips a link between two tasks", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: a } = await newTask(ctx, { title: "a", kind: "task", description: "d" });
    const { data: b } = await newTask(ctx, { title: "b", kind: "task", description: "d" });

    const linked = await addLink(ctx, a.task.display_id, "blocks", b.task.display_id);
    expect(linked.data.task.links).toEqual([
      { kind: "blocks", target: b.task.id, target_display_id: b.task.display_id },
    ]);

    const unlinked = await removeLink(ctx, a.task.display_id, "blocks", b.task.display_id);
    expect(unlinked.data.task.links).toEqual([]);
  });

  it("deleteTask soft-deletes — the task still resolves via show", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: created } = await newTask(ctx, { title: "t", kind: "task", description: "d" });

    const deleted = await deleteTask(ctx, created.task.display_id);
    expect(deleted.data.task.deleted).toBe(true);

    const { data: shown } = await show(ctx, created.task.display_id);
    expect(shown.deleted).toBe(true);
  });

  it("dropTask hard-removes the ref — a later show is not_found", async () => {
    const ctx = ctxFor(TestRepo.create());
    const { data: created } = await newTask(ctx, { title: "t", kind: "task", description: "d" });

    const dropped = await dropTask(ctx, created.task.display_id);
    expect(dropped.data.display_id).toBe(created.task.display_id);

    await expect(show(ctx, created.task.display_id)).rejects.toMatchObject({ kind: "not_found" });
  });

  it("newTask without an identity anywhere rejects with identity_missing", async () => {
    const repo = TestRepo.bare();
    const ctx: GitTaskContext = { bin: bin!, cwd: repo.path, configDir: repo.configDir, env: repo.noGlobalIdentityEnv() };
    await expect(newTask(ctx, { title: "t", kind: "task", description: "d" })).rejects.toMatchObject({
      kind: "identity_missing",
    });
  });
});
