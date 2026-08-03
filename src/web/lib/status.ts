import type { Priority, TaskKind } from "../../shared/contract";

/**
 * Direct port of git-task/src/color.rs's status_semantic/priority_semantic/
 * kind_semantic — keeping the terminal and the browser in agreement on what a
 * status means is the whole point (ground truth #8: status is free-form text,
 * there's no shared enum to hang colors off otherwise).
 */
export type Semantic = "success" | "warn" | "danger" | "info" | "accent" | "neutral";

export function statusSemantic(status: string): Semantic {
  switch (status.toLowerCase()) {
    case "done":
    case "closed":
    case "resolved":
    case "completed":
    case "complete":
      return "success";
    case "doing":
    case "in-progress":
    case "in_progress":
    case "started":
    case "wip":
    case "review":
    case "in review":
      return "warn";
    case "blocked":
    case "stuck":
      return "danger";
    case "todo":
    case "open":
    case "backlog":
    case "new":
    case "planned":
      return "info";
    default:
      return "neutral";
  }
}

export function prioritySemantic(priority: Priority): Semantic {
  switch (priority) {
    case "high":
      return "danger";
    case "medium":
      return "warn";
    case "low":
      return "success";
  }
}

export function kindSemantic(kind: TaskKind): Semantic {
  switch (kind) {
    case "bug":
      return "danger";
    case "epic":
      return "info";
    case "story":
      return "accent";
    case "task":
    case "subtask":
      return "neutral";
  }
}

/**
 * Every literal class name below must appear verbatim (not template-interpolated) so
 * Tailwind's static scanner can find it and generate the utility — a `bg-${sem}-tint`
 * template string would silently produce unstyled pills at runtime.
 */
const SEMANTIC_CLASSES: Record<Semantic, { tint: string; ink: string }> = {
  success: { tint: "bg-success-tint", ink: "text-success-ink" },
  warn: { tint: "bg-warn-tint", ink: "text-warn-ink" },
  danger: { tint: "bg-danger-tint", ink: "text-danger-ink" },
  info: { tint: "bg-info-tint", ink: "text-info-ink" },
  accent: { tint: "bg-accent-tint", ink: "text-accent-ink" },
  neutral: { tint: "bg-neutral-tint", ink: "text-neutral-ink" },
};

export function semanticClasses(sem: Semantic): { tint: string; ink: string } {
  return SEMANTIC_CLASSES[sem];
}
