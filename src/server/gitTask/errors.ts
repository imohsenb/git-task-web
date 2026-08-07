import type { CliErrorKind } from "../../shared/contract.js";

export type GitTaskErrorKind = CliErrorKind | "timeout" | "queue_full" | "lock_timeout";

const HTTP_STATUS_BY_KIND: Record<GitTaskErrorKind, number> = {
  not_found: 404,
  ambiguous_id: 409,
  conflict: 409,
  rejected: 409,
  validation: 422,
  identity_missing: 412,
  not_a_repo: 400,
  remote: 502,
  io: 500,
  internal: 500,
  timeout: 504,
  queue_full: 503,
  lock_timeout: 503,
};

export interface GitTaskErrorOptions {
  kind: GitTaskErrorKind;
  message: string;
  causes?: string[];
  context?: Record<string, string | string[]>;
  command?: string;
}

export class GitTaskError extends Error {
  readonly kind: GitTaskErrorKind;
  readonly causes: string[];
  readonly context?: Record<string, string | string[]>;
  readonly command?: string;
  readonly httpStatus: number;

  constructor(opts: GitTaskErrorOptions) {
    super(opts.message);
    this.name = "GitTaskError";
    this.kind = opts.kind;
    this.causes = opts.causes ?? [];
    this.context = opts.context;
    this.command = opts.command;
    this.httpStatus = HTTP_STATUS_BY_KIND[opts.kind];
  }

  toJSON() {
    return {
      ok: false as const,
      error: {
        kind: this.kind,
        message: this.message,
        causes: this.causes,
        context: this.context,
      },
    };
  }
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, "");
}

/**
 * Guesses a CliErrorKind from the human error message, for CLI builds that predate
 * the --format json envelope. Best-effort only — a stale binary is a temporary state,
 * not something worth precise classification for.
 */
function guessKind(message: string): CliErrorKind {
  const lower = message.toLowerCase();
  if (lower.includes("not a git repository") || lower.includes("not a repo")) return "not_a_repo";
  if (lower.includes("user.name") || lower.includes("user.email") || lower.includes("identity")) {
    return "identity_missing";
  }
  if (lower.includes("no task") || lower.includes("not found")) return "not_found";
  if (lower.includes("ambiguous") || lower.includes("matches multiple")) return "ambiguous_id";
  if (lower.includes("missing required field") || lower.includes("invalid")) return "validation";
  if (lower.includes("rejected") || lower.includes("non-fast-forward")) return "rejected";
  if (lower.includes("conflict")) return "conflict";
  if (lower.includes("remote") || lower.includes("network") || lower.includes("ssh")) return "remote";
  return "internal";
}

/**
 * Parses `git-task`'s human stderr output (`✖ Error: <msg>` + optional `└─ Cause: <msg>`
 * lines) into a GitTaskError. Only reached when a CLI build predates the JSON error
 * envelope — see docs/cli-json-contract.md.
 */
export function parseStderrFallback(stderr: string, command?: string): GitTaskError {
  const clean = stripAnsi(stderr);
  const messageMatch = clean.match(/^✖ Error:\s*(.+)$/m);
  const causeMatches = [...clean.matchAll(/^└─\s*Cause:\s*(.+)$/gm)].map((m) => m[1].trim());

  const message = messageMatch ? messageMatch[1].trim() : clean.trim() || "git-task exited with an error";

  return new GitTaskError({
    kind: guessKind(message),
    message,
    causes: causeMatches,
    command,
  });
}
