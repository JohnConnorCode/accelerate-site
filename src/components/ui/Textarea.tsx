"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id || `textarea-${generatedId}`;
    const errorId = `${controlId}-error`;
    return (
      <div className="ui-field-group w-full">
        {label && (
          <label htmlFor={controlId} className="block text-sm text-[var(--control-muted)] mb-2">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={controlId}
          aria-describedby={error ? errorId : props["aria-describedby"]}
          className={cn(
            "w-full px-4 py-3 rounded-lg min-h-[120px] resize-y",
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

Textarea.displayName = "Textarea";

export { Textarea };
