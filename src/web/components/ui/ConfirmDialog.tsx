import type { ReactNode } from "react";
import { Modal } from "./Modal";

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  confirmVariant = "danger",
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  confirmVariant?: "danger" | "brand";
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="text-sm text-ink-2">{body}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-control px-4 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-sunk"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={[
            "rounded-control px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50",
            confirmVariant === "danger" ? "bg-danger-ink hover:opacity-90" : "bg-brand hover:bg-brand-hover",
          ].join(" ")}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
