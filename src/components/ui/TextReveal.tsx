"use client";

import { motion, type Variant } from "framer-motion";
import { cn } from "@/lib/utils";

type SplitBy = "word" | "char";
type Animation = "blur" | "slide" | "fade";

interface TextRevealProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  splitBy?: SplitBy;
  stagger?: number;
  animation?: Animation;
  className?: string;
  /** Array of words to style with gold gradient */
  goldWords?: string[];
}

const animationVariants: Record<Animation, { hidden: Variant; visible: Variant }> = {
  blur: {
    hidden: { opacity: 0, filter: "blur(8px)", y: 8 },
    visible: { opacity: 1, filter: "blur(0px)", y: 0 },
  },
  slide: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
};

export function TextReveal({
  text,
  as: Tag = "h2",
  splitBy = "word",
  stagger = 0.05,
  animation = "blur",
  className,
  goldWords = [],
}: TextRevealProps) {
  const variants = animationVariants[animation];
  const goldSet = new Set(goldWords.map((w) => w.toLowerCase()));

  const units =
    splitBy === "word"
      ? text.split(" ").map((word) => ({ text: word, isSpace: false }))
      : text.split("").map((char) => ({ text: char, isSpace: char === " " }));

  return (
    <Tag className={cn(className)}>
      <motion.span
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        transition={{ staggerChildren: stagger, delayChildren: 0.1 }}
        className="inline"
        aria-label={text}
      >
        {units.map((unit, i) => {
          const isGold =
            splitBy === "word" &&
            goldSet.has(unit.text.toLowerCase().replace(/[^a-z]/g, ""));
          return (
            <motion.span
              key={i}
              variants={{
                hidden: variants.hidden,
                visible: {
                  ...(typeof variants.visible === "object" ? variants.visible : {}),
                  transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] },
                },
              }}
              className={cn(
                "inline-block",
                isGold && "text-gold-gradient",
                splitBy === "word" && "mr-[0.25em]"
              )}
              aria-hidden="true"
            >
              {unit.isSpace ? "\u00A0" : unit.text}
            </motion.span>
          );
        })}
      </motion.span>
    </Tag>
  );
}
