"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pulse?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gold-gradient text-[var(--btn-primary-text)] font-semibold hover:border-gold-glow-strong hover:brightness-110 hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.15)] active:scale-[0.97] active:brightness-95 transition-all duration-300",
  secondary:
    "glass border border-[var(--border-light)] text-[var(--white-primary)] hover:border-[rgba(var(--accent-rgb),0.3)] hover:border-gold-glow hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.15)] active:scale-[0.97] active:brightness-95 transition-all duration-300",
  ghost:
    "text-[var(--white-secondary)] hover:text-[var(--text-nav-hover)] active:scale-[0.97] transition-[color,transform] duration-200",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm rounded-lg",
  md: "px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base rounded-lg",
  lg: "px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      pulse = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium cursor-pointer",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]",
          variantClasses[variant],
          sizeClasses[size],
          pulse && "pulse-gold",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
