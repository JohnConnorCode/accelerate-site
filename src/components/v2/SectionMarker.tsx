import { cn } from "@/lib/utils";

/** Signature mono section marker, e.g. [ 02 / SERVICES ] */
export function SectionMarker({
  n,
  label,
  className,
}: {
  n: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.3em] text-[var(--gold-base)]",
        className,
      )}
    >
      <span className="text-[var(--white-muted)]">[</span>
      <span>{n}</span>
      <span className="text-[var(--white-muted)]">/</span>
      <span>{label}</span>
      <span className="text-[var(--white-muted)]">]</span>
    </span>
  );
}
