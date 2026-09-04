"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { useRevealLifecycle } from "@/components/motion/useReveal";
import { cn } from "@/lib/utils";

/**
 * Scroll entrance for team pages, built on the same `.rv` + observer system
 * as the marketing heroes (not the framer helper, whose `initial={false}`
 * paints below-fold content fully visible so its whileInView never fires).
 * Stagger via `delay`; reduced-motion users get content immediately.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRevealLifecycle<HTMLDivElement>({});
  return (
    <div
      ref={ref}
      className={cn("rv", className)}
      style={{ "--d": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Portrait image that fades in on load instead of flashing in late. The
 * frame behind it carries the layout (aspect + background), so the page
 * never reflows when the bytes arrive.
 */
export function FadeImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const ref = useRevealLifecycle<HTMLDivElement>({ initialViewport: "immediate" });
  return (
    <div ref={ref} className={cn("rv h-full w-full", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoadingComplete={(img) => img.classList.add("is-loaded")}
        className="team-photo-fade object-cover"
      />
    </div>
  );
}
