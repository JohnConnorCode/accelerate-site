"use client";

import { motion, type Variants } from "framer-motion";
import { fadeUp } from "@/lib/animations";
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
  staggerDelay = 0.12,
}: AnimateOnScrollProps) {
  const Component = motionElements[as] ?? motionElements.div;

  const resolvedVariants: Variants = stagger
    ? {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delay || 0.1,
          },
        },
      }
    : variants ?? fadeUp;

  return (
    <Component
      variants={resolvedVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      transition={!stagger && delay ? { delay } : undefined}
      className={cn(className)}
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
  staggerDelay = 0.12,
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
