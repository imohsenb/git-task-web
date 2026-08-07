import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/** Shared overlay+card shell — IdentityMissingDialog, ConfirmDialog, NewTaskDialog,
 * and the epic/link pickers all need the same "modal over the app" chrome. */
export function Modal({
  title,
  onClose,
  children,
  maxWidthClassName = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-1/30 px-4">
      <div className={`w-full ${maxWidthClassName} max-h-[85vh] overflow-y-auto rounded-card bg-shell p-6 shadow-pop`}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink-1">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-control p-1 text-ink-4 transition-colors hover:bg-surface-sunk hover:text-ink-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
