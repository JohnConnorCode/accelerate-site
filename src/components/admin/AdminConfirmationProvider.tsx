"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AdminDialog } from "./AdminDialog";
type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
};
const Context = createContext<((request: Confirmation) => Promise<boolean>) | null>(null);
export function useAdminConfirm() {
  const confirm = useContext(Context);
  if (!confirm) throw new Error("Confirmation provider is required");
  return confirm;
}
/** Shared non-blocking confirmations preserve the theme and the opener's focus. */
export function AdminConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const confirm = useCallback(
    (next: Confirmation) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setRequest(next);
      }),
    [],
  );
  const finish = (accepted: boolean) => {
    resolver.current?.(accepted);
    resolver.current = null;
    setRequest(null);
  };
  useEffect(
    () => () => {
      resolver.current?.(false);
    },
    [],
  );
  return (
    <Context.Provider value={confirm}>
      {children}
      <AdminDialog
        open={!!request}
        onClose={() => finish(false)}
        title={request?.title ?? "Confirm change"}
        maxWidth="sm"
      >
        <div className="admin-dialog-surface bg-[var(--admin-surface)] p-6 text-[var(--admin-ink)]">
          <h2 className="admin-dialog-title">{request?.title}</h2>
          <p className="admin-copy mt-3 text-sm leading-6">{request?.description}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="admin-theme-button" onClick={() => finish(false)}>
              {request?.cancelLabel ?? "Cancel"}
            </button>
            <button type="button" className="admin-theme-button" onClick={() => finish(true)}>
              {request?.confirmLabel}
            </button>
          </div>
        </div>
      </AdminDialog>
    </Context.Provider>
  );
}
