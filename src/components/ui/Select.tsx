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
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm text-white-secondary mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={cn(
              "w-full px-4 py-3 rounded-lg appearance-none",
              "bg-bg-subtle border border-border-glass",
              "text-white-primary",
              "focus:outline-none focus:border-gold focus:ring-1 focus:ring-[var(--gold-base)]/30",
              "transition-[border-color,box-shadow] duration-200",
              error && "border-[var(--error)]",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" className="bg-bg-subtle">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                className="bg-bg-subtle"
              >
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white-muted pointer-events-none" />
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-[var(--error)]">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
