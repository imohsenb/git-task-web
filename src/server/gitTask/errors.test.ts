import { describe, expect, it } from "vitest";
import { GitTaskError, parseStderrFallback } from "./errors.js";

describe("GitTaskError", () => {
  it("maps kinds to the documented HTTP status codes", () => {
    expect(new GitTaskError({ kind: "not_found", message: "x" }).httpStatus).toBe(404);
    expect(new GitTaskError({ kind: "ambiguous_id", message: "x" }).httpStatus).toBe(409);
    expect(new GitTaskError({ kind: "validation", message: "x" }).httpStatus).toBe(422);
    expect(new GitTaskError({ kind: "identity_missing", message: "x" }).httpStatus).toBe(412);
    expect(new GitTaskError({ kind: "not_a_repo", message: "x" }).httpStatus).toBe(400);
    expect(new GitTaskError({ kind: "remote", message: "x" }).httpStatus).toBe(502);
    expect(new GitTaskError({ kind: "timeout", message: "x" }).httpStatus).toBe(504);
    expect(new GitTaskError({ kind: "queue_full", message: "x" }).httpStatus).toBe(503);
  });
});

describe("parseStderrFallback", () => {
  it("extracts the top-level message and cause chain", () => {
    const stderr = "✖ Error: something broke\n└─ Cause: underlying reason\n";
    const err = parseStderrFallback(stderr, "ls");

    expect(err.message).toBe("something broke");
    expect(err.causes).toEqual(["underlying reason"]);
    expect(err.command).toBe("ls");
  });

  it("strips ANSI color codes before matching", () => {
    const stderr = "\x1b[1;31m✖ Error:\x1b[0m missing required field(s): description\n";
    const err = parseStderrFallback(stderr, "new");

    expect(err.message).toBe("missing required field(s): description");
    expect(err.kind).toBe("validation");
  });

  it("guesses identity_missing from message content", () => {
    const err = parseStderrFallback("✖ Error: git config user.name and user.email not set\n", "new");
    expect(err.kind).toBe("identity_missing");
  });

  it("guesses not_a_repo from message content", () => {
    const err = parseStderrFallback("✖ Error: not a git repository (or any parent up to mount point)\n", "ls");
    expect(err.kind).toBe("not_a_repo");
  });

  it("falls back to internal when nothing matches", () => {
    const err = parseStderrFallback("✖ Error: something completely unrecognised happened\n", "ls");
    expect(err.kind).toBe("internal");
  });
});
