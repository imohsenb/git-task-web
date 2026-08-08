import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/** Shared overlay+card shell — IdentityMissingDialog, ConfirmDialog, NewTaskDialog,
 * and the epic/link pickers all need the same "modal over the app" chrome. */
export function Modal({
  title,
  onClose,
  children,
  maxWidthClassName = "max-w-md",
  fullScreen = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  /** Near-fullscreen instead of the usual centered card — for content too tall to work in a compact dialog. */
  fullScreen?: boolean;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Without this, wheel/trackpad scrolling over the modal scrolls the page
  // behind it instead of the modal's own content (no scrollable ancestor to
  // stop it) — most visible once fullScreen modals made scrolling common.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-1/30 px-4">
      <div
        className={`flex w-full flex-col overflow-hidden rounded-card bg-shell p-6 shadow-pop ${
          fullScreen ? "h-[92vh] max-w-6xl" : `${maxWidthClassName} max-h-[85vh]`
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
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
        <div className={`mt-4 ${fullScreen ? "min-h-0 flex-1 overflow-y-auto" : "overflow-y-auto"}`}>{children}</div>
      </div>
    </div>
  );
}
