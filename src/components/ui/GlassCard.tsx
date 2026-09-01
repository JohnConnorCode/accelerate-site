"use client";

import { forwardRef, useCallback, useRef } from "react";
import { cn, prefersReducedMotion } from "@/lib/utils";

type GlassVariant = "default" | "prominent" | "gold";
type HoverBehavior = "glow" | "lift" | "shine" | "none";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  hover?: HoverBehavior;
  padding?: "none" | "sm" | "md" | "lg";
  /** Only applied inside AdminShell. Keeps legacy cards on the shared surface scale. */
  adminElevation?: "flat" | "raised" | "outlined";
  children: React.ReactNode;
}

const variantClasses: Record<GlassVariant, string> = {
  default: "glass",
  prominent: "glass-prominent",
  gold: "glass-gold",
};

const paddingClasses: Record<string, string> = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-6",
  lg: "p-5 sm:p-6 md:p-8",
};

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant = "default",
      hover = "glow",
      padding = "md",
      adminElevation = "raised",
      className,
      children,
      onMouseMove: externalMouseMove,
      onMouseLeave: externalMouseLeave,
      ...props
    },
    externalRef,
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);

    const setRef = useCallback(
      (node: HTMLDivElement | null) => {
        (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof externalRef === "function") externalRef(node);
        else if (externalRef)
          (externalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [externalRef],
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (hover === "none" || prefersReducedMotion()) {
          if (externalMouseMove) externalMouseMove(e);
          return;
        }
        const el = internalRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        // Cursor-follow spotlight on ALL interactive cards
        el.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
        el.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);

        // Extra 3D tilt for "lift" hover
        if (hover === "lift") {
          const tiltX = (0.5 - y) * 5;
          const tiltY = (x - 0.5) * 5;
          el.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px)`;
        }

        if (externalMouseMove) externalMouseMove(e);
      },
      [hover, externalMouseMove],
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (hover === "lift") {
          const el = internalRef.current;
          if (el) el.style.transform = "";
        }
        if (externalMouseLeave) externalMouseLeave(e);
      },
      [hover, externalMouseLeave],
    );

    const hoverClass =
      hover === "glow"
        ? "card-spotlight hover:border-gold-glow transition-[border-color,box-shadow,transform] duration-300"
        : hover === "lift"
          ? "card-tilt card-spotlight hover:border-gold-glow transition-[border-color,box-shadow,transform] duration-300"
          : hover === "shine"
            ? "card-spotlight card-hover-shine hover:border-gold-glow transition-[border-color,box-shadow,transform] duration-300"
            : "transition-[border-color,box-shadow,transform] duration-300";

    return (
      <div
        ref={setRef}
        className={cn(
          "rounded-2xl admin-surface-compatible",
          `admin-surface-compatible--${adminElevation}`,
          variantClasses[variant],
          paddingClasses[padding],
          hoverClass,
          className,
        )}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";

export { GlassCard };
