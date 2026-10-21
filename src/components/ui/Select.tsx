"use client";

import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    return (
      <div className="ui-field-group w-full">
        {label && (
          <label htmlFor={id} className="block text-sm text-[var(--control-muted)] mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={cn(
              "w-full px-4 py-3 rounded-lg appearance-none",
              "bg-[var(--control-surface)] border border-[var(--control-border)]",
              "text-[var(--control-ink)]",
              "focus:outline-none focus:border-[var(--control-action)] focus:ring-1 focus:ring-[var(--control-action)]/30",
              "transition-[border-color,box-shadow] duration-200",
              error && "border-[var(--control-danger)]",
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" className="bg-[var(--control-surface)]">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[var(--control-surface)]">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--control-muted)] pointer-events-none" />
        </div>
        {error && <p className="mt-1.5 text-sm text-[var(--control-danger)]">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";

export { Select };
