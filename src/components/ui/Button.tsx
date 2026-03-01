"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pulse?: boolean;
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gold-gradient text-black font-semibold hover:border-gold-glow-strong hover:brightness-110 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] active:scale-[0.98] transition-all duration-300",
  secondary:
    "glass border border-[var(--border-light)] text-[var(--white-primary)] hover:border-[rgba(212,175,55,0.3)] hover:border-gold-glow hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] active:scale-[0.98] transition-all duration-300",
  ghost:
    "text-white-secondary hover:text-[var(--text-nav-hover)] transition-colors duration-200",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm rounded-lg",
  md: "px-6 py-3 text-base rounded-lg",
  lg: "px-8 py-4 text-lg rounded-xl",
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
