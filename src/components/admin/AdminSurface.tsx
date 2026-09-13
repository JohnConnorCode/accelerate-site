import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type AdminSurfaceTone = "default" | "subtle" | "ink" | "attention";
type AdminSurfacePadding = "none" | "sm" | "md" | "lg";
type AdminSurfaceElevation = "flat" | "raised" | "outlined";

interface AdminSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: AdminSurfaceTone;
  padding?: AdminSurfacePadding;
  /** Visual hierarchy, resolved by the active admin appearance. */
  elevation?: AdminSurfaceElevation;
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
  sm: "admin-surface-padding--sm",
  md: "admin-surface-padding--md",
  lg: "admin-surface-padding--lg",
};

export const AdminSurface = forwardRef<HTMLDivElement, AdminSurfaceProps>(
  (
    {
      tone = "default",
      padding = "md",
      elevation = "raised",
      interactive = false,
      className,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        tones[tone],
        `admin-surface--${elevation}`,
        paddings[padding],
        interactive && "admin-surface-interactive",
        className,
      )}
      {...props}
    />
  ),
);

AdminSurface.displayName = "AdminSurface";
