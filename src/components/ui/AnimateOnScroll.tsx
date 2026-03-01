"use client";

import { motion, type Variants } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";

const animateComponents = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
} as const;

const staggerComponents = {
  div: motion.div,
  section: motion.section,
  ul: motion.ul,
} as const;

interface AnimateOnScrollProps {
  children: React.ReactNode;
  variants?: Variants;
  className?: string;
  delay?: number;
  as?: keyof typeof animateComponents;
}

export function AnimateOnScroll({
  children,
  variants = fadeUp,
  className,
  delay = 0,
  as = "div",
}: AnimateOnScrollProps) {
  const Component = animateComponents[as] ?? animateComponents.div;

  return (
    <Component
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      transition={delay ? { delay } : undefined}
      className={cn(className)}
    >
      {children}
    </Component>
  );
}

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof typeof staggerComponents;
  staggerDelay?: number;
}

export function StaggerContainer({
  children,
  className,
  as = "div",
  staggerDelay = 0.12,
}: StaggerContainerProps) {
  const Component = staggerComponents[as] ?? staggerComponents.div;

  return (
    <Component
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.1,
          },
        },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className={cn(className)}
    >
      {children}
    </Component>
  );
}
