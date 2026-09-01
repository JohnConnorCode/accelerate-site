import { cn } from "@/lib/utils";

interface AdminSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function AdminSwitch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  className,
}: AdminSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group relative inline-grid h-11 w-12 shrink-0 place-items-center rounded-[16px] outline-none transition-[opacity,scale] duration-150 active:scale-[0.96] disabled:cursor-wait disabled:opacity-55 focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-surface)]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative block h-7 w-12 rounded-[14px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-[background-color] duration-150 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
          checked ? "bg-[var(--admin-ink)]" : "bg-black/10 dark:bg-white/12",
        )}
      >
        <span
          className={cn(
            "absolute left-1 top-1 block size-5 rounded-[10px] bg-[var(--admin-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.24)] transition-transform duration-150 ease-out",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}
