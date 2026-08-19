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
      <div className="w-full">
        {label && (
          <label
            htmlFor={controlId}
            className="block text-sm text-white-secondary mb-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={controlId}
          aria-describedby={error ? errorId : props["aria-describedby"]}
          className={cn(
            "w-full px-4 py-3 rounded-lg",
            "bg-bg-subtle border border-border-glass",
            "text-white-primary placeholder:text-white-muted",
            "focus:outline-none focus:border-gold focus:ring-1 focus:ring-[var(--gold-base)]/30",
            "transition-[border-color,box-shadow] duration-200",
            error && "border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/30",
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-[var(--error)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
