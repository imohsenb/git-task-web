import { useEffect } from "react";

/** True while focus is somewhere a keystroke should be typed, not treated as a shortcut. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** `/` focuses the nearest search box (`FilterBar`'s input, tagged `data-search-input`).
 * Global and a no-op when the current page has none — safe to mount once in AppShell. */
export function useFocusSearchShortcut(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return;
      const input = document.querySelector<HTMLInputElement>("[data-search-input]");
      if (!input) return;
      e.preventDefault();
      input.focus();
      input.select();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** `c` opens the "new task" dialog — mounted only where that action makes sense
 * (RepoWorkspace, which owns the dialog's open state). */
export function useNewTaskShortcut(onOpen: () => void): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return;
      onOpen();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);
}
