"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-between mb-6"
    >
      <div>
        <h1 className="font-display text-2xl font-bold text-white-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-white-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </motion.div>
  );
}
