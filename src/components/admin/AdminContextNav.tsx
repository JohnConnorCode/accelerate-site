"use client";

import { usePathname } from "next/navigation";
import AdminLink from "@/components/admin/AdminLink";
import { cn } from "@/lib/utils";

export interface AdminContextTab {
  href: string;
  label: string;
  description?: string;
}

export function AdminContextNav({
  tabs,
  label = "Workspace views",
}: {
  tabs: AdminContextTab[];
  label?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <AdminLink
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            title={tab.description}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-xs font-semibold transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]",
              active
                ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                : "text-[var(--admin-muted)] hover:bg-[var(--admin-surface-subtle)] hover:text-[var(--admin-ink)]",
            )}
          >
            {tab.label}
          </AdminLink>
        );
      })}
    </nav>
  );
}
