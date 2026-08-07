import type { CliWarning } from "../../../shared/contract";

/** Ground truth #9's home: `ls` warns to stderr and skips any repo it can't open,
 * still exits 0 — this is where that surfaces to the user instead of vanishing. */
export function WarningStrip({ warnings }: { warnings: CliWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="mb-4 space-y-1 rounded-control bg-warn-tint px-3 py-2 text-sm text-warn-ink">
      {warnings.map((w, i) => (
        <p key={i}>
          {w.message}
          {w.detail ? ` — ${w.detail}` : ""}
        </p>
      ))}
    </div>
  );
}
