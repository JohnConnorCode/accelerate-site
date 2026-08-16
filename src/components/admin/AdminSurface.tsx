import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type AdminSurfaceTone = "default" | "subtle" | "ink" | "attention";
type AdminSurfacePadding = "none" | "sm" | "md" | "lg";

interface AdminSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: AdminSurfaceTone;
  padding?: AdminSurfacePadding;
  interactive?: boolean;
}

const tones: Record<AdminSurfaceTone, string> = {
  default: "admin-surface",
  subtle: "admin-surface admin-surface-subtle",
  ink: "admin-surface admin-surface-ink",
  attention: "admin-surface admin-surface-attention",
};

const paddings: Record<AdminSurfacePadding, string> = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export const AdminSurface = forwardRef<HTMLDivElement, AdminSurfaceProps>(
  ({ tone = "default", padding = "md", interactive = false, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        tones[tone],
        paddings[padding],
        interactive && "admin-surface-interactive",
        className,
      )}
      {...props}
    />
  ),
);

AdminSurface.displayName = "AdminSurface";
