"use client";

import Link from "@/components/admin/AdminLink";
import { FileUp, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

const views = [
  { id: "submissions", label: "Website submissions", href: "/admin/contacts", icon: Inbox },
  { id: "import", label: "List import", href: "/admin/contact-imports", icon: FileUp },
] as const;

export function ContactIntakeNav({ active }: { active: (typeof views)[number]["id"] }) {
  return (
    <nav
      className="scrollbar-hide mb-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-[14px] bg-[var(--admin-surface)] p-1 shadow-[var(--admin-shadow-border)]"
      aria-label="Contact intake views"
    >
      {views.map((view) => {
        const Icon = view.icon;
        const selected = active === view.id;
        return (
          <Link
            key={view.id}
            href={view.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]",
              selected
                ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                : "text-[var(--admin-muted)] hover:bg-[var(--admin-surface-subtle)] hover:text-[var(--admin-ink)]",
            )}
          >
            <Icon className="size-3.5" />
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
