import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "gold";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
        variant === "default" &&
          "glass text-white-secondary",
        variant === "gold" &&
          "bg-[rgba(var(--accent-rgb),0.1)] text-gold-light border border-[rgba(var(--accent-rgb),0.2)]",
        className
      )}
    >
      {children}
    </span>
  );
}
