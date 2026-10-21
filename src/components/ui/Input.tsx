"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id || `input-${generatedId}`;
    const errorId = `${controlId}-error`;
    return (
      <div className="ui-field-group w-full">
        {label && (
          <label htmlFor={controlId} className="block text-sm text-[var(--control-muted)] mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          data-ui-input
          id={controlId}
          aria-describedby={error ? errorId : props["aria-describedby"]}
          aria-invalid={error ? true : props["aria-invalid"]}
          className={cn(
            "w-full px-4 py-3 rounded-lg",
            "bg-[var(--control-surface)] border border-[var(--control-border)]",
            "text-[var(--control-ink)] placeholder:text-[var(--control-muted)]",
            "focus:outline-none focus:border-[var(--control-action)] focus:ring-1 focus:ring-[var(--control-action)]/30",
            "transition-[border-color,box-shadow] duration-200",
            error &&
              "border-[var(--control-danger)] focus:border-[var(--control-danger)] focus:ring-[var(--control-danger)]/30",
            className,
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-[var(--control-danger)]">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
