import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "../../lib/api";
import { IdentityMissingDialog } from "./IdentityMissingDialog";

interface IdentityDialogApi {
  open: (error: ApiError) => void;
  close: () => void;
}

const IdentityDialogContext = createContext<IdentityDialogApi | null>(null);

/**
 * §3.2: identity is resolved server-side only, never supplied by a request — so the
 * one thing the web app can do about a 412 is tell you exactly what to run in a
 * terminal. Any mutation hook can call `open()` from anywhere in the tree; this
 * provider owns the single dialog instance so two failing mutations don't stack two
 * dialogs.
 */
export function IdentityDialogProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<ApiError | null>(null);

  const api = useMemo<IdentityDialogApi>(
    () => ({
      open: (err) => setError(err),
      close: () => setError(null),
    }),
    [],
  );

  return (
    <IdentityDialogContext.Provider value={api}>
      {children}
      {error && <IdentityMissingDialog error={error} onClose={api.close} />}
    </IdentityDialogContext.Provider>
  );
}

export function useIdentityDialog(): IdentityDialogApi {
  const ctx = useContext(IdentityDialogContext);
  if (!ctx) throw new Error("useIdentityDialog must be used within IdentityDialogProvider");
  return ctx;
}
