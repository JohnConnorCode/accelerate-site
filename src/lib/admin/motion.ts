import type { Variants } from "framer-motion";

export const adminEase = [0.16, 1, 0.3, 1] as const;

export const adminPageVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.998 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: adminEase,
      staggerChildren: 0.095,
      delayChildren: 0.045,
    },
  },
};

export const adminSectionVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.46, ease: adminEase },
  },
};

export const adminHeaderVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: adminEase, staggerChildren: 0.075, delayChildren: 0.025 },
  },
};

export const adminHeaderItemVariants: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.44, ease: adminEase },
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
    transition: { duration: 0.36, ease: adminEase },
  },
};

export const adminDialogTransition = {
  duration: 0.18,
  ease: adminEase,
};
