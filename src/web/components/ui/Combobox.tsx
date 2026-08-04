import { useEffect, useRef, useState } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
}

/**
 * Type-to-filter dropdown for lists too long for a plain <select> to stay usable
 * (link targets, parent epics, status). `allowCustom` lets Enter commit whatever
 * was typed even if it doesn't match an option — git-task's `status` field is
 * free-form (no closed enum), so the status editor needs this; link targets must
 * resolve to a real task, so that picker keeps allowCustom off.
 */
export function Combobox({
  value,
  options,
  onChange,
  placeholder,
  allowCustom = false,
  autoFocus,
  onCancel,
  className,
}: {
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  autoFocus?: boolean;
  onCancel?: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  const trimmedQuery = query.trim();
  const showCustomOption = allowCustom && trimmedQuery.length > 0 && !filtered.some((o) => o.value === trimmedQuery);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
        onCancel?.();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onCancel]);

  function commit(next: string) {
    if (!next) return;
    onChange(next);
    setQuery("");
    setIsOpen(false);
  }

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={rootRef} className={["relative", className ?? ""].join(" ")}>
      <input
        autoFocus={autoFocus}
        type="text"
        value={isOpen ? query : selectedLabel}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          setQuery("");
          setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, filtered.length - 1 + (showCustomOption ? 1 : 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlight < filtered.length && filtered[highlight]) commit(filtered[highlight].value);
            else if (showCustomOption) commit(trimmedQuery);
          } else if (e.key === "Escape") {
            setIsOpen(false);
            setQuery("");
            onCancel?.();
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-control border border-line bg-surface px-2 py-1 text-micro text-ink-1 focus:border-brand focus:outline-none"
      />
      {isOpen && (filtered.length > 0 || showCustomOption) && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-control border border-line bg-surface py-1 shadow-lift">
          {filtered.length === 0 && !showCustomOption && (
            <li className="px-2.5 py-1.5 text-micro text-ink-4">No matches</li>
          )}
          {filtered.map((option, i) => (
            <li key={option.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(option.value)}
                className={[
                  "block w-full truncate px-2.5 py-1.5 text-left text-micro",
                  i === highlight ? "bg-brand-soft text-ink-1" : "text-ink-2 hover:bg-surface-sunk",
                ].join(" ")}
              >
                {option.label}
              </button>
            </li>
          ))}
          {showCustomOption && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(trimmedQuery)}
                className={[
                  "block w-full truncate px-2.5 py-1.5 text-left text-micro",
                  highlight === filtered.length ? "bg-brand-soft text-ink-1" : "text-ink-3 hover:bg-surface-sunk",
                ].join(" ")}
              >
                Use “{trimmedQuery}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
