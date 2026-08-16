"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
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
        <textarea
          ref={ref}
          id={id}
          className={cn(
            "w-full px-4 py-3 rounded-lg min-h-[120px] resize-y",
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
          <p className="mt-1.5 text-sm text-[var(--error)]">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
