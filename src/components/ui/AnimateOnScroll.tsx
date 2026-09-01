"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { EASE, fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";

const motionElements = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  ul: motion.ul,
} as const;

interface AnimateOnScrollProps {
  children: React.ReactNode;
  variants?: Variants;
  className?: string;
  delay?: number;
  as?: keyof typeof motionElements;
  /** Enable stagger mode — wraps children with staggerChildren transition */
  stagger?: boolean;
  staggerDelay?: number;
}

export function AnimateOnScroll({
  children,
  variants,
  className,
  delay = 0,
  as = "div",
  stagger = false,
  staggerDelay = 0.08,
}: AnimateOnScrollProps) {
  const Component = motionElements[as] ?? motionElements.div;
  const prefersReduced = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  // SSR hydration gate so reduced-motion does not fork the first paint.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);
  const reducedMotion = hydrated && !!prefersReduced;

  const resolvedVariants: Variants = stagger
    ? {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delay || 0.06,
          },
        },
      }
    : (variants ?? fadeUp);

  return (
    <Component
      variants={resolvedVariants}
      initial={false}
      animate={reducedMotion ? "visible" : undefined}
      whileInView={reducedMotion ? undefined : "visible"}
      viewport={{ once: true, margin: "0px 0px -6% 0px" }}
      transition={!stagger && delay ? { delay } : undefined}
      className={cn("reveal-self", className)}
    >
      {children}
    </Component>
  );
}

/**
 * Convenience wrapper around AnimateOnScroll with stagger enabled.
 */
export function StaggerContainer({
  children,
  className,
  as = "div",
  staggerDelay = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof typeof motionElements;
  staggerDelay?: number;
}) {
  return (
    <AnimateOnScroll stagger staggerDelay={staggerDelay} as={as} className={className}>
      {children}
    </AnimateOnScroll>
  );
}

const entryItem: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.52, ease: EASE },
  },
};

/** A true parent/child stagger for page intros and other semantic groups. */
export function EntranceGroup({
  children,
  className,
  delay = 0.06,
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const prefersReduced = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);
  const reducedMotion = hydrated && !!prefersReduced;
  return (
    <motion.div
      className={cn("reveal-self", className)}
      initial={false}
      animate={reducedMotion ? "visible" : undefined}
      whileInView={reducedMotion ? undefined : "visible"}
      viewport={{ once: true, margin: "0px 0px -6% 0px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function EntranceItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={entryItem}>
      {children}
    </motion.div>
  );
}
