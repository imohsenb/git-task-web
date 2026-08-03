import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../lib/theme";

export function ThemeToggle() {
  const [theme, toggle] = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle theme"
      className="rounded-control p-1.5 text-ink-4 transition-colors hover:bg-surface-sunk hover:text-ink-1"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
