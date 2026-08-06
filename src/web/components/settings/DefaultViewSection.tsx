import { LayoutGrid, List, Table } from "lucide-react";
import { useDefaultView, type DefaultView } from "../../lib/defaultView";

const OPTIONS: { view: DefaultView; label: string; icon: typeof LayoutGrid }[] = [
  { view: "board", label: "Board", icon: LayoutGrid },
  { view: "list", label: "List", icon: List },
  { view: "table", label: "Table", icon: Table },
];

export function DefaultViewSection() {
  const [defaultView, setDefaultView] = useDefaultView();

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-4">Default view</h2>
      <p className="mt-1 text-sm text-ink-3">The view opened first when you jump into a repo.</p>

      <div className="mt-3 inline-flex overflow-hidden rounded-card border border-line">
        {OPTIONS.map(({ view, label, icon: Icon }, i) => (
          <button
            key={view}
            type="button"
            onClick={() => setDefaultView(view)}
            aria-pressed={defaultView === view}
            className={[
              "flex items-center gap-2 px-3.5 py-2 text-sm font-medium transition-colors",
              i > 0 ? "border-l border-line" : "",
              defaultView === view ? "bg-brand-soft text-brand-ink" : "bg-surface text-ink-2 hover:bg-surface-sunk",
            ].join(" ")}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
