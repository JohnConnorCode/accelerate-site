export const button = "admin-button admin-button--secondary";
export const primary = "admin-button admin-button--primary";
export const field = "admin-field mt-1";
export const label = "block text-xs font-semibold text-[var(--admin-muted)]";
export const words = (value: string) => value.replaceAll("_", " ");
export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-[var(--admin-surface-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
      {children}
    </span>
  );
}
