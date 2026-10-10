"use client";

import { useId } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared, interruptible selection feedback for local workspace views. */
export function AdminViewSwitcher<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { id: T; label: string; icon: LucideIcon; description?: string }[];
  className?: string;
}) {
  const id = useId();
  const reducedMotion = useReducedMotion();
  return (
    <LayoutGroup id={id}>
      <div
        role="group"
        aria-label={label}
        className={cn("admin-view-switcher inline-flex flex-wrap gap-1 p-1", className)}
      >
        {options.map(({ id: option, label: name, icon: Icon, description }) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-label={name}
              aria-describedby={description ? `${id}-${option}-help` : undefined}
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={cn(
                "admin-view-switch relative inline-flex min-h-10 min-w-10 items-center justify-center gap-2 px-3 text-xs font-semibold",
                description && "min-h-12 min-w-0 px-2 text-left sm:justify-start sm:px-3",
              )}
            >
              {selected && (
                <motion.span
                  aria-hidden="true"
                  data-admin-view-selection
                  layoutId={reducedMotion ? undefined : "selection"}
                  className="admin-view-selection pointer-events-none absolute inset-0"
                  transition={{ type: "spring", duration: reducedMotion ? 0 : 0.3, bounce: 0 }}
                />
              )}
              <Icon className="relative size-3.5 shrink-0" aria-hidden="true" />
              <span className="relative min-w-0">
                <span className="block truncate">{name}</span>
                {description && (
                  <span
                    id={`${id}-${option}-help`}
                    className="mt-0.5 hidden truncate text-[10px] font-normal text-[var(--admin-muted)] xl:block"
                  >
                    {description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
