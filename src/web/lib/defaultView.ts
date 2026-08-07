import { useState } from "react";

export type DefaultView = "board" | "list" | "table";

const STORAGE_KEY = "gtw-default-view";
const DEFAULT_VIEW: DefaultView = "board";

function isDefaultView(value: string | null): value is DefaultView {
  return value === "board" || value === "list" || value === "table";
}

/** Read synchronously for use outside components (e.g. building a redirect path). */
export function getDefaultView(): DefaultView {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isDefaultView(stored) ? stored : DEFAULT_VIEW;
}

function persistDefaultView(view: DefaultView): void {
  localStorage.setItem(STORAGE_KEY, view);
}

export function useDefaultView(): [DefaultView, (next: DefaultView) => void] {
  const [view, setView] = useState<DefaultView>(() => getDefaultView());

  function apply(next: DefaultView) {
    persistDefaultView(next);
    setView(next);
  }

  return [view, apply];
}
