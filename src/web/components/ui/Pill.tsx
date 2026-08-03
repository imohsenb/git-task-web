import type { ReactNode } from "react";
import { semanticClasses, type Semantic } from "../../lib/status";

export function Pill({ sem, children, mono }: { sem: Semantic; children: ReactNode; mono?: boolean }) {
  const { tint, ink } = semanticClasses(sem);
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-pill px-2 py-0.5 text-micro font-medium",
        tint,
        ink,
        mono ? "font-mono" : "",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
