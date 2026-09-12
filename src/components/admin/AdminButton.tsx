import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}
/** One semantic control recipe for pages, panels and dialogs. */
export const AdminButton = forwardRef<HTMLButtonElement, AdminButtonProps>(
  ({ variant = "secondary", className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn("admin-button", `admin-button--${variant}`, className)}
      {...props}
    />
  ),
);
AdminButton.displayName = "AdminButton";
