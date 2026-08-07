import { describe, expect, it } from "vitest";
import { withRepoLock } from "./locks.js";

describe("withRepoLock", () => {
  it("serialises concurrent callers on the same path — no interleaving", async () => {
    const path = "/fake/repo/path/for-lock-test";
    const events: string[] = [];

    const task = (label: string) =>
      withRepoLock(path, 5_000, async () => {
        events.push(`${label}-start`);
        await new Promise((resolve) => setTimeout(resolve, 15));
        events.push(`${label}-end`);
      });

    await Promise.all([task("a"), task("b"), task("c")]);

    // Serialised means every start is immediately followed by its own end —
    // never another task's start sneaking in between.
    for (let i = 0; i < events.length; i += 2) {
      const label = events[i].split("-")[0];
      expect(events[i + 1]).toBe(`${label}-end`);
    }
  });

  it("does not serialise callers on different paths", async () => {
    const events: string[] = [];
    const release = { a: () => {}, b: () => {} };

    const blockUntilReleased = (label: "a" | "b") =>
      withRepoLock(`/fake/repo/${label}`, 5_000, () => {
        events.push(`${label}-start`);
        return new Promise<void>((resolve) => {
          release[label] = resolve;
        });
      });

    const pA = blockUntilReleased("a");
    const pB = blockUntilReleased("b");

    // Both should be able to start without waiting on each other.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events).toEqual(expect.arrayContaining(["a-start", "b-start"]));

    release.a();
    release.b();
    await Promise.all([pA, pB]);
  });

  it("rejects with lock_timeout when the lock cannot be acquired in time", async () => {
    const path = "/fake/repo/path/for-timeout-test";
    let releaseFirst: () => void = () => {};
    const first = withRepoLock(
      path,
      5_000,
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    );

    // Give the first call a moment to actually acquire the lock before the second races it.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = withRepoLock(path, 20, async () => {});
    await expect(second).rejects.toMatchObject({ kind: "lock_timeout", httpStatus: 503 });

    releaseFirst();
    await first;
  });
});
