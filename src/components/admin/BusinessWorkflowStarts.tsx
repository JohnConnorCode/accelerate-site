"use client";

import { useId, useState } from "react";
import { ArrowRight, ListChecks, MessagesSquare, ReceiptText, UserRoundPlus } from "lucide-react";
import Link from "./AdminLink";
import { AdminSurface } from "./AdminSurface";
import { cn } from "@/lib/utils";

const workflows = [
  {
    id: "inquiry",
    title: "Capture a sales inquiry",
    icon: UserRoundPlus,
    result: "An opportunity linked to the right customer",
    steps: [
      "Choose New opportunity in Pipeline and enter the inquiry and customer details.",
      "Open the saved opportunity to record its next action and due date.",
      "Return to the opportunity to update the stage as the conversation progresses.",
    ],
    needs:
      "Customer name and contact details. Core records work without AI or an email connection.",
    href: "/admin/pipeline",
    action: "Start in Pipeline",
    guide: "/docs/pipeline",
  },
  {
    id: "onboarding",
    title: "Start client onboarding",
    icon: ListChecks,
    result: "A delivery checklist with owners and due dates",
    steps: [
      "Select a won opportunity and edit the suggested kickoff tasks.",
      "Assign each task, set its date and review the complete plan.",
      "Approve task creation, then track the saved checklist in Work.",
    ],
    needs: "A won opportunity, workspace members and the Client onboarding App enabled in Apps.",
    href: "/admin/client-onboarding",
    action: "Build an onboarding checklist",
    guide: "/docs/plugins/client-onboarding",
  },
  {
    id: "meeting",
    title: "Assign meeting follow-ups",
    icon: MessagesSquare,
    result: "Agreed commitments saved as assigned tasks",
    steps: [
      "Select a stored meeting and enter the commitments you agreed.",
      "Give each task an owner and date, then review the plan.",
      "Approve task creation and follow completion from the saved result or Work.",
    ],
    needs:
      "A stored meeting, workspace members and the Meeting commitments App enabled. You enter the checklist; it is not extracted automatically.",
    href: "/admin/meeting-commitments",
    action: "Build a meeting checklist",
    guide: "/docs/plugins/meeting-commitments",
  },
  {
    id: "invoice",
    title: "Prepare a customer invoice",
    icon: ReceiptText,
    result: "A saved invoice with its sending status",
    steps: [
      "Choose the customer, add line items and prepare an invoice preview.",
      "Review the amount and terms, then approve creation of the Stripe draft.",
      "Request a separate sending approval, then check the resulting invoice status.",
    ],
    needs:
      "A customer record, the Stripe invoicing App enabled and a configured Stripe connection.",
    href: "/admin/invoicing?view=create",
    action: "Prepare an invoice",
    guide: "/docs/plugins/stripe-invoicing",
  },
] as const;

export function BusinessWorkflowStarts({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<string>(workflows[0].id);
  const id = useId();
  const workflow = workflows.find((item) => item.id === selected) ?? workflows[0];
  const content = (
    <div className="grid gap-5 lg:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)]">
      <div
        className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-1"
        role="group"
        aria-label="Choose a business workflow"
      >
        {workflows.map(({ id: key, title, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={selected === key}
            aria-controls={`${id}-plan`}
            onClick={() => setSelected(key)}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/30",
              selected === key
                ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                : "bg-[var(--admin-surface-subtle)] text-[var(--admin-ink)] hover:shadow-[var(--admin-shadow-border)]",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {title}
          </button>
        ))}
      </div>
      <section
        id={`${id}-plan`}
        aria-labelledby={`${id}-result`}
        aria-live="polite"
        className="min-w-0"
      >
        <h3 id={`${id}-result`} className="text-lg font-semibold text-balance">
          {workflow.result}
        </h3>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-[var(--admin-ink)] marker:text-[var(--admin-muted)]">
          {workflow.steps.map((step) => (
            <li key={step} className="pl-1">
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm text-[var(--admin-muted)]">
          <span className="font-medium text-[var(--admin-ink)]">Before you start: </span>
          {workflow.needs}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href={workflow.href} className="admin-button admin-button--primary">
            {workflow.action}
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
          <Link
            href={workflow.guide}
            className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
          >
            Read the walkthrough
          </Link>
          {workflow.id !== "inquiry" && (
            <Link
              href="/admin/plugins"
              className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            >
              Manage Apps
            </Link>
          )}
        </div>
      </section>
    </div>
  );
  return compact ? (
    <details className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">
        Start a business workflow
      </summary>
      <div className="mt-3">{content}</div>
    </details>
  ) : (
    <AdminSurface padding="lg">
      <h2 className="mb-5 text-xl font-semibold">What do you want to get done?</h2>
      {content}
    </AdminSurface>
  );
}
