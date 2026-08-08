import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  actions,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  /** Rendered next to the toggle, outside it — e.g. an "Add" or "Refresh" icon button
   * that should stay clickable regardless of collapsed state. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          className="flex items-center gap-1 text-micro uppercase text-ink-4 transition-colors hover:text-ink-2"
        >
          <ChevronRight size={12} className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          {title}
          {count !== undefined ? ` (${count})` : ""}
        </button>
        {actions}
      </div>
      {isOpen && children}
    </div>
  );
}
