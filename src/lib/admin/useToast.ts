"use client";

import { useEffect, useState } from "react";

export type ToastKind = "success" | "error" | "info" | "warning";

export interface ToastEntry {
  id: string;
  kind: ToastKind;
  message: string;
  durationMs: number;
}

type Listener = (toasts: ToastEntry[]) => void;

const listeners = new Set<Listener>();
let toasts: ToastEntry[] = [];

function emit() {
  for (const l of listeners) l(toasts);
}

function push(kind: ToastKind, message: string, durationMs = 5000): string {
  const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const entry: ToastEntry = { id, kind, message, durationMs };
  toasts = [...toasts, entry];
  emit();
  if (durationMs > 0) {
    setTimeout(() => dismiss(id), durationMs);
  }
  return id;
}

export function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (message: string, durationMs?: number) => push("success", message, durationMs),
  error: (message: string, durationMs?: number) => push("error", message, durationMs ?? 7000),
  info: (message: string, durationMs?: number) => push("info", message, durationMs),
  warning: (message: string, durationMs?: number) => push("warning", message, durationMs ?? 7000),
};

export function useToasts(): ToastEntry[] {
  const [state, setState] = useState<ToastEntry[]>(() => toasts);
  useEffect(() => {
    const listener: Listener = (next) => setState(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}
