import type { Variants } from "framer-motion";

export const adminEase = [0.16, 1, 0.3, 1] as const;

export const adminPageVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.56,
      ease: adminEase,
      staggerChildren: 0.065,
      delayChildren: 0.035,
    },
  },
};

export const adminSectionVariants: Variants = {
  hidden: { opacity: 0, y: 9, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: adminEase },
  },
};

export const adminHeaderVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.54, ease: adminEase, staggerChildren: 0.06, delayChildren: 0.025 },
  },
};

export const adminHeaderItemVariants: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: adminEase },
  },
};

export const adminListVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const adminListItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: adminEase },
  },
};

export const adminDialogTransition = {
  duration: 0.18,
  ease: adminEase,
};
