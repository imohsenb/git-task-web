import { describe, expect, it } from "vitest";
import { deriveColumns } from "./columns";

describe("deriveColumns", () => {
  it("forces todo first regardless of input order", () => {
    expect(deriveColumns(["done", "todo", "doing"]).map((c) => c.status)).toEqual(["todo", "doing", "done"]);
  });

  it("groups by semantic bucket: info, neutral, warn, danger, success", () => {
    const statuses = ["done", "blocked", "review", "weird-custom", "open"];
    expect(deriveColumns(statuses).map((c) => c.status)).toEqual(["open", "weird-custom", "review", "blocked", "done"]);
  });

  it("sorts alphabetically within a bucket", () => {
    expect(deriveColumns(["zeta-custom", "alpha-custom"]).map((c) => c.status)).toEqual(["alpha-custom", "zeta-custom"]);
  });

  it("omits todo when it isn't observed", () => {
    expect(deriveColumns(["doing", "done"]).map((c) => c.status)).toEqual(["doing", "done"]);
  });

  it("a newly observed status inserts by its own bucket, producing a sensible column", () => {
    // The literal Phase 3 acceptance test from PLAN.md: `git task status X shipped`
    // should produce a sensible new column. "shipped" isn't a recognized status
    // string, so it lands in the neutral bucket — right after todo/info, before
    // the in-progress statuses.
    expect(deriveColumns(["todo", "doing", "done", "shipped"]).map((c) => c.status)).toEqual([
      "todo",
      "shipped",
      "doing",
      "done",
    ]);
  });
});
