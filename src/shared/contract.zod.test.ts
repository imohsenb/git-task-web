import { describe, expect, it } from "vitest";
import { cliResponseSchema, mutationJsonSchema } from "./contract.zod.js";

const minimalTask = {
  id: "abc123",
  display_id: "TST-abc123",
  key: "TST",
  title: "t",
  description: "d",
  kind: "task",
  status: "done",
  priority: null,
  assignee: null,
  assignee_name: null,
  reporter: "a@b.com",
  reporter_name: "A",
  labels: [],
  fixed_versions: [],
  affected_versions: [],
  due: null,
  parent: null,
  parent_display_id: null,
  parent_repo: null,
  links: [],
  milestone: null,
  comments: [],
  deleted: false,
  created: 1,
  updated: 1,
};

function envelopeWith(automationError: unknown) {
  return {
    ok: true,
    command: "status",
    version: "1.0.6",
    data: {
      task: minimalTask,
      ops: ["SetStatus"],
      automation: [
        {
          rule: "auto-unassign-done",
          actions: ["clear_assignee"],
          ops: ["ClearAssignee"],
          error: automationError,
        },
      ],
    },
    warnings: [],
  };
}

// git-task's real CLI serializes automation[].error as JSON `null` (not omitted)
// when a rule ran without error — Rust's Option<String> -> serde default. A schema
// requiring only string | undefined rejects that, so every status/edit/etc. that
// triggers a no-op automation rule (e.g. the common "clear assignee on done" rule)
// failed with a generic "doesn't match the expected shape" error even though the
// mutation itself succeeded.
describe("mutationJsonSchema automation[].error", () => {
  it("accepts an explicit null (the CLI's actual shape for a successful rule)", () => {
    const result = cliResponseSchema(mutationJsonSchema).safeParse(envelopeWith(null));
    expect(result.success).toBe(true);
  });

  it("accepts an omitted error field", () => {
    const envelope = envelopeWith(undefined);
    delete (envelope.data.automation[0] as { error?: unknown }).error;
    const result = cliResponseSchema(mutationJsonSchema).safeParse(envelope);
    expect(result.success).toBe(true);
  });

  it("accepts a string error message", () => {
    const result = cliResponseSchema(mutationJsonSchema).safeParse(envelopeWith("rule failed"));
    expect(result.success).toBe(true);
  });

  it("still rejects the wrong type", () => {
    const result = cliResponseSchema(mutationJsonSchema).safeParse(envelopeWith(42));
    expect(result.success).toBe(false);
  });
});
