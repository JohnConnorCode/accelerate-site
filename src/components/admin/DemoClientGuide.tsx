"use client";
import Link from "./AdminLink";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { AdminSurface } from "./AdminSurface";

const steps = [
  {
    route: "contacts",
    title: "Customer & inquiry",
    instruction:
      "Open Lena Walsh in Contacts. Read her conversation and linked inspection opportunity so you can see the request and next step together.",
  },
  {
    route: "pipeline",
    title: "Sales decision",
    instruction:
      "Open Lena's opportunity in Pipeline. Set the owner and next action, inspect the offer in Proposals, and mark the job won when you intend to start delivery.",
  },
  {
    route: "client-onboarding",
    title: "Delivery handoff",
    instruction:
      "Choose Lena's won opportunity in Client onboarding. Supply owners and dates, create the reviewed checklist and open its assigned tasks in Work.",
  },
  {
    route: "invoicing",
    title: "Customer invoice",
    instruction:
      "Choose Use sample invoice and confirm Lena Walsh as the customer. Review the service lines, then follow the separate draft-creation and sending decisions.",
  },
  {
    route: "collections",
    title: "Payment follow-up",
    instruction:
      "Open Lena's collection case for an earlier invoice. Read its balance, promises and holds before preparing a reminder. The invoice you create above remains a separate billing record.",
  },
] as const;

/** Optional route guidance over existing records, not a second workflow or progress engine. */
export function DemoClientGuide() {
  const pathname = usePathname();
  const params = useSearchParams();
  if (
    !pathname.startsWith("/demo/command-center/northline-roofing/") ||
    params.get("workflow") !== "client"
  )
    return null;
  const route = pathname.split("/").at(-1);
  const current = steps.find((step) => step.route === route) ?? steps[0];
  const closeParams = new URLSearchParams(params);
  closeParams.delete("workflow");
  return (
    <div className="mb-6" data-client-lifecycle-guide>
      <AdminSurface padding="md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Follow Lena Walsh&apos;s inspection inquiry</h2>
            <p className="admin-copy mt-1 text-sm">
              One homeowner across customer history, sales, delivery and billing. Business effects
              are simulated.
            </p>
          </div>
          <Link
            href={pathname + (closeParams.size ? "?" + closeParams : "")}
            className="admin-button admin-button--ghost shrink-0"
            aria-label="Close client lifecycle guide"
          >
            <X size={16} aria-hidden="true" />
          </Link>
        </div>
        <nav
          aria-label="Client lifecycle steps"
          className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        >
          {steps.map((step, index) => (
            <Link
              key={step.route}
              href={`/demo/command-center/northline-roofing/${step.route}?workflow=client`}
              aria-current={route === step.route ? "step" : undefined}
              className={`admin-button min-w-0 !whitespace-normal text-left ${route === step.route ? "admin-button--primary" : "admin-button--secondary"}`}
            >
              <span className="tabular-nums">{index + 1}.</span> {step.title}
            </Link>
          ))}
        </nav>
        <p className="admin-copy mt-4 text-sm" aria-live="polite">
          {current.instruction}
        </p>
        <p className="admin-copy mt-2 text-xs">
          Explore any step. The fixtures include several jobs at different stages; this guide does
          not mark work complete.
        </p>
      </AdminSurface>
    </div>
  );
}
