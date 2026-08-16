"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { adminHeaderItemVariants, adminHeaderVariants } from "@/lib/admin/motion";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  useEffect(() => {
    document.title = `${title} | Accelerate Admin`;
  }, [title]);

  return (
    <motion.div variants={adminHeaderVariants} className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <motion.p variants={adminHeaderItemVariants} className="admin-eyebrow">Accelerate operations</motion.p>
        <motion.h1 variants={adminHeaderItemVariants} className="admin-page-title">
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p variants={adminHeaderItemVariants} className="admin-copy mt-1.5 max-w-2xl text-sm">{subtitle}</motion.p>
        )}
      </div>
      {actions && <motion.div variants={adminHeaderItemVariants} className="flex shrink-0 flex-wrap items-center gap-2">{actions}</motion.div>}
    </motion.div>
  );
}
