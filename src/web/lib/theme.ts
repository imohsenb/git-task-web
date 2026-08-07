import { useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "gtw-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Mirrors the inline boot script in index.html — localStorage override wins,
 * else follow the OS. Both read the same key so they never disagree. */
export function resolveInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : systemTheme();
}

function persistTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.dataset.theme = theme;
}

/** The boot script already set `data-theme` before first paint, so the initial
 * state here just mirrors the DOM rather than re-applying it (no flash). Third
 * element is an explicit setter for the Settings page's two-way chooser —
 * `ThemeToggle` only ever needs the toggle, so it just ignores it. */
export function useTheme(): [Theme, () => void, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());

  function apply(next: Theme) {
    persistTheme(next);
    setTheme(next);
  }

  function toggle() {
    apply(theme === "dark" ? "light" : "dark");
  }

  return [theme, toggle, apply];
}
