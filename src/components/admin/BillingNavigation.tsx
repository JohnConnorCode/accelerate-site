"use client";

import { BarChart3, CalendarDays, CreditCard, HandCoins, ReceiptText, Repeat2 } from "lucide-react";
import AdminLink from "./AdminLink";
import { cn } from "@/lib/utils";

const areas = [
  { id: "invoices", href: "/admin/invoicing", label: "Invoices", icon: ReceiptText },
  {
    id: "payments",
    href: "/admin/invoicing?view=payments",
    label: "Payments & refunds",
    icon: CreditCard,
  },
  { id: "collections", href: "/admin/collections", label: "Collections", icon: HandCoins },
  { id: "subscriptions", href: "/admin/subscriptions", label: "Subscriptions", icon: Repeat2 },
  { id: "events", href: "/admin/events", label: "Ticket sales", icon: CalendarDays },
  { id: "revenue", href: "/admin/revenue", label: "Revenue", icon: BarChart3 },
] as const;

export function BillingNavigation({ active }: { active: (typeof areas)[number]["id"] }) {
  return (
    <nav aria-label="Billing areas" className="flex flex-wrap gap-2">
      {areas.map(({ id, href, label, icon: Icon }) => (
        <AdminLink
          key={id}
          href={href}
          className={cn(
            "admin-button",
            id === active ? "admin-button--primary" : "admin-button--secondary",
          )}
          aria-current={id === active ? "page" : undefined}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {label}
        </AdminLink>
      ))}
    </nav>
  );
}
