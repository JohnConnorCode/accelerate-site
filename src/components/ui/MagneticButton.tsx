"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

/**
 * Wraps any child (typically a Link + Button) with a magnetic cursor-follow effect.
 * The inner element subtly tracks the cursor position on hover.
 */
export function MagneticButton({ children, className, strength = 0.3 }: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion()) return;
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      el.style.setProperty("--mag-x", `${(e.clientX - cx) * strength}px`);
      el.style.setProperty("--mag-y", `${(e.clientY - cy) * strength}px`);
    },
    [strength],
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mag-x", "0px");
    el.style.setProperty("--mag-y", "0px");
  }, []);

  return (
    <div
      ref={ref}
      className={cn("magnetic-btn inline-block", className)}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}
