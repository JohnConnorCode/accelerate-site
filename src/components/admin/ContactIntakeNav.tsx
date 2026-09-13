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
    <nav className="admin-tabs mb-5" aria-label="Contact intake views">
      {views.map((view) => {
        const Icon = view.icon;
        const selected = active === view.id;
        return (
          <Link
            key={view.id}
            href={view.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[var(--admin-control-radius)] px-3 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]",
              selected
                ? "bg-[var(--admin-action)] text-[var(--admin-action-ink)]"
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
