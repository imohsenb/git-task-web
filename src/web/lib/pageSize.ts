import { useState } from "react";

const STORAGE_KEY = "gtw-page-size";
export const DEFAULT_PAGE_SIZE = 10;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 200;

function clamp(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.round(value)));
}

/** Read synchronously for use outside components. */
export function getPageSize(): number {
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  return stored > 0 ? clamp(stored) : DEFAULT_PAGE_SIZE;
}

function persistPageSize(size: number): void {
  localStorage.setItem(STORAGE_KEY, String(size));
}

/** User-level, applies to every repo — how many tasks a board column shows before
 * "Show more", and the increment the list view's "Load more" reveals. */
export function usePageSize(): [number, (next: number) => void] {
  const [pageSize, setPageSize] = useState<number>(() => getPageSize());

  function apply(next: number) {
    const clamped = clamp(next);
    persistPageSize(clamped);
    setPageSize(clamped);
  }

  return [pageSize, apply];
}
