import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../lib/theme";

export function AppearanceSection() {
  const [theme, , setTheme] = useTheme();

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-4">Appearance</h2>
      <p className="mt-1 text-sm text-ink-3">
        Follows your OS setting until you pick one here; the choice is then remembered on this device.
      </p>

      <div className="mt-3 inline-flex overflow-hidden rounded-card border border-line">
        <button
          type="button"
          onClick={() => setTheme("light")}
          aria-pressed={theme === "light"}
          className={[
            "flex items-center gap-2 px-3.5 py-2 text-sm font-medium transition-colors",
            theme === "light" ? "bg-brand-soft text-brand-ink" : "bg-surface text-ink-2 hover:bg-surface-sunk",
          ].join(" ")}
        >
          <Sun size={15} />
          Light
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          aria-pressed={theme === "dark"}
          className={[
            "flex items-center gap-2 border-l border-line px-3.5 py-2 text-sm font-medium transition-colors",
            theme === "dark" ? "bg-brand-soft text-brand-ink" : "bg-surface text-ink-2 hover:bg-surface-sunk",
          ].join(" ")}
        >
          <Moon size={15} />
          Dark
        </button>
      </div>
    </section>
  );
}
