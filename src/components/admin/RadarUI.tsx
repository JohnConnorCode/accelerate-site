export const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-[var(--admin-shadow-border)] transition-[background-color,transform] hover:bg-[var(--admin-surface-subtle)] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-45";
export const primary =
  button + " bg-[var(--admin-ink)] text-[var(--admin-surface)] hover:opacity-85";
export const field =
  "mt-1 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-ink)]";
export const label = "block text-xs font-semibold text-[var(--admin-muted)]";
export const words = (value: string) => value.replaceAll("_", " ");
export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-[var(--admin-surface-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
      {children}
    </span>
  );
}
