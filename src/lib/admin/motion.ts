import type { Variants } from "framer-motion";

export const adminEase = [0.16, 1, 0.3, 1] as const;

export const adminSectionVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: adminEase },
  },
};

export const adminListVariants: Variants = {
  hidden: {},
  // Lists can contain hundreds of rows. Reveal them together so list size
  // cannot delay the last row or block interaction for several seconds.
  visible: { transition: { staggerChildren: 0 } },
};

export const adminListItemVariants: Variants = {
  hidden: { opacity: 0, y: 3 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: adminEase },
  },
};

export const adminDialogTransition = {
  duration: 0.18,
  ease: adminEase,
};
