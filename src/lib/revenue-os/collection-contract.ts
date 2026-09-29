import { z } from "zod";

/** The approval queue and demo show the same readable policy changes. */
export function describeCollectionPolicyChange(field: string, before: unknown, after: unknown) {
  const labels: Record<string, string> = {
    disputed: "Disputed",
    paused: "Reminders paused",
    pauseUntil: "Paused until",
    promiseDate: "Payment promise date",
    ownerEmail: "Owner",
    nextAction: "Next action",
  };
  const value = (input: unknown) =>
    input == null ? "Not set" : typeof input === "boolean" ? (input ? "Yes" : "No") : String(input);
  return `${labels[field] ?? field}: ${value(before)} → ${value(after)}`;
}

export const collectionCasePatchSchema = z
  .object({
    disputed: z.boolean().optional(),
    paused: z.boolean().optional(),
    pauseUntil: z.iso.date().nullable().optional(),
    promiseDate: z.iso.date().nullable().optional(),
    ownerEmail: z.email().max(254).nullable().optional(),
    nextAction: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "A case change is required");

export type CollectionInvoiceView = {
  observationId?: string;
  creationActionId: string;
  invoiceId: string;
  remaining: number;
  status: string;
  dueDate: string | null;
  observedAt: string;
};
export type CollectionCaseView = {
  id: string;
  contactId: string;
  name: string;
  email: string;
  currency: string;
  status: string;
  revision: number;
  disputed: boolean;
  paused: boolean;
  pauseUntil: string | null;
  promiseDate: string | null;
  ownerEmail: string | null;
  nextAction: string;
  invoices: CollectionInvoiceView[];
  work: {
    id: string;
    status: string;
    objective: string;
    nextCheckAt: string | null;
    reason: string;
  }[];
  events: { id: string; kind: string; at: string }[];
  actions: {
    id: string;
    title: string;
    actionType?: string;
    status: string;
    error: string | null;
    result: Record<string, unknown> | null;
    preview?: { to: string; text: string };
  }[];
};
export type CollectionWorkspaceData = {
  cases: CollectionCaseView[];
  invoiceOptions: { id: string; title: string }[];
  truncated: boolean;
  simulated?: boolean;
};
export function collectionSummary(cases: CollectionCaseView[], asOf = new Date().toISOString()) {
  const day = asOf.slice(0, 10),
    eligible: Record<string, number> = {};
  for (const c of cases)
    if (
      c.status === "open" &&
      !c.disputed &&
      !c.paused &&
      (!c.pauseUntil || c.pauseUntil < day) &&
      (!c.promiseDate || c.promiseDate < day)
    )
      eligible[c.currency] =
        (eligible[c.currency] ?? 0) +
        c.invoices
          .filter((i) => i.status === "open" && i.dueDate && i.dueDate < day)
          .reduce((n, i) => n + i.remaining, 0);
  return {
    eligible,
    handled: cases.filter(
      (c) => c.status === "settled" || c.disputed || c.paused || c.promiseDate || c.ownerEmail,
    ).length,
    missedPromises: cases.filter((c) => c.status === "open" && c.promiseDate && c.promiseDate < day)
      .length,
    paidInvoices: cases
      .flatMap((c) => c.invoices)
      .filter((i) => i.status === "paid" && i.remaining === 0).length,
  };
}
