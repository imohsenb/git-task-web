import { useState, type ReactNode } from "react";
import { MarkdownView } from "./MarkdownView";

/** Write/Preview textarea — Preview renders through the same MarkdownView the
 * read-only task detail ("reader") uses, so what you see while typing matches
 * what you'll see once saved. */
export function MarkdownEditor({
  value,
  onChange,
  rows = 6,
  placeholder,
  autoFocus,
  hasError,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
  hasError?: boolean;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <div
      className={`overflow-hidden rounded-control border bg-surface ${
        hasError ? "border-danger-ink" : "border-line focus-within:border-brand"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-2 pt-1.5">
        <div className="flex gap-1">
          <TabButton active={tab === "write"} onClick={() => setTab("write")}>
            Write
          </TabButton>
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
            Preview
          </TabButton>
        </div>
        <span className="mb-1.5 shrink-0 text-micro text-ink-4">Markdown supported</span>
      </div>

      {tab === "write" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="w-full resize-y bg-transparent px-3 py-2 text-sm text-ink-1 focus:outline-none"
        />
      ) : (
        <div className="overflow-y-auto px-3 py-2" style={{ minHeight: `${rows * 1.5}rem`, maxHeight: `${rows * 3}rem` }}>
          {value.trim() ? <MarkdownView content={value} /> : <p className="text-sm text-ink-4">Nothing to preview.</p>}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-control px-2.5 py-1 text-micro font-medium transition-colors ${
        active ? "border-b-2 border-brand text-ink-1" : "text-ink-4 hover:text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}
