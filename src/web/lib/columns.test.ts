import { describe, expect, it } from "vitest";
import { deriveColumns } from "./columns";

describe("deriveColumns", () => {
  it("always includes the default todo/doing/blocked/done workflow, even for a single-status repo", () => {
    // The exact bug report: one task, status "done" — board must still look like a
    // real board (a column per status, Jira-style), not collapse to one column.
    expect(deriveColumns(["done"]).map((c) => c.status)).toEqual(["todo", "doing", "blocked", "done"]);
  });

  it("forces todo first regardless of input order", () => {
    expect(deriveColumns(["done", "todo", "doing"]).map((c) => c.status)).toEqual([
      "todo",
      "doing",
      "blocked",
      "done",
    ]);
  });

  it("groups by semantic bucket: info, neutral, warn, danger, success", () => {
    const statuses = ["done", "blocked", "review", "weird-custom", "open"];
    expect(deriveColumns(statuses).map((c) => c.status)).toEqual([
      "todo",
      "open",
      "weird-custom",
      "doing",
      "review",
      "blocked",
      "done",
    ]);
  });

  it("sorts alphabetically within a bucket", () => {
    expect(deriveColumns(["zeta-custom", "alpha-custom"]).map((c) => c.status)).toEqual([
      "todo",
      "alpha-custom",
      "zeta-custom",
      "doing",
      "blocked",
      "done",
    ]);
  });

  it("never hides an observed status that isn't part of the default workflow", () => {
    const columns = deriveColumns(["in-review"]).map((c) => c.status);
    expect(columns).toContain("in-review");
    expect(columns).toContain("todo");
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
      "blocked",
      "done",
    ]);
  });
});
