"use client";

import { useEffect } from "react";

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
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="admin-eyebrow">Accelerate operations</p>
        <h1 className="admin-page-title">
          {title}
        </h1>
        {subtitle && (
          <p className="admin-copy mt-1.5 max-w-2xl text-sm">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
