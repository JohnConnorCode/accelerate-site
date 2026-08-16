import type { Variants } from "framer-motion";

export const adminEase = [0.16, 1, 0.3, 1] as const;

export const adminPageVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(5px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.38,
      ease: adminEase,
      staggerChildren: 0.08,
      delayChildren: 0.035,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: "blur(3px)",
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

export const adminSectionVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.36, ease: adminEase },
  },
};

export const adminHeaderVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.36, ease: adminEase, staggerChildren: 0.055 },
  },
};

export const adminHeaderItemVariants: Variants = {
  hidden: { opacity: 0, y: 7, filter: "blur(3px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.3, ease: adminEase },
  },
};

export const adminListVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045 } },
};

export const adminListItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: adminEase },
  },
};

export const adminDialogTransition = {
  duration: 0.18,
  ease: adminEase,
};
