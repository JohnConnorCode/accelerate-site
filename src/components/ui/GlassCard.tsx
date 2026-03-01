"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type GlassVariant = "default" | "prominent" | "gold";
type HoverBehavior = "glow" | "lift" | "shine" | "none";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  variant?: GlassVariant;
  hover?: HoverBehavior;
  padding?: "none" | "sm" | "md" | "lg";
  children: React.ReactNode;
}

const variantClasses: Record<GlassVariant, string> = {
  default: "glass",
  prominent: "glass-prominent",
  gold: "glass-gold",
};

const paddingClasses: Record<string, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant = "default",
      hover = "glow",
      padding = "md",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const hoverClass =
      hover === "glow"
        ? "hover:border-gold-glow transition-all duration-300"
        : hover === "lift"
          ? "hover:-translate-y-1 hover:border-gold-glow transition-all duration-300"
          : hover === "shine"
            ? "card-hover-shine hover:border-gold-glow transition-all duration-300"
            : "transition-all duration-300";

    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-xl",
          variantClasses[variant],
          paddingClasses[padding],
          hoverClass,
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard };
