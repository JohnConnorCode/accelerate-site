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
  primary: "",
  secondary: "btn-ghost",
  ghost: "btn-ghost",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      pulse = false,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        data-ui-button={variant}
        data-pulse={pulse ? "" : undefined}
        className={cn("btn", variantClasses[variant], sizeClasses[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
