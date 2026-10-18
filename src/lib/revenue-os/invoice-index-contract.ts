import { z } from "zod";

const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();
export const invoiceIndexEntrySchema = z.object({
  id: z.string().regex(/^in_[A-Za-z0-9]{1,80}$/),
  number: z.string().nullable(),
  status: z.enum(["draft", "open", "paid", "uncollectible", "void"]).nullable(),
  amountDue: amount,
  amountPaid: amount,
  remaining: amount,
  currency: z
    .string()
    .regex(/^[a-z]{3}$/)
    .nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  dueDate: z.iso.datetime().nullable(),
  hostedInvoiceUrl: z.url().nullable(),
  createdAt: z.iso.datetime(),
  managed: z.boolean(),
});
export const invoiceIndexPageSchema = z
  .object({
    invoices: z.array(invoiceIndexEntrySchema).max(50),
    hasMore: z.boolean(),
    nextCursor: z
      .string()
      .regex(/^in_[A-Za-z0-9]{1,80}$/)
      .nullable(),
    connection: z.string().min(1).max(160),
    testMode: z.boolean(),
  })
  .refine((page) => !page.hasMore || (page.invoices.length > 0 && page.nextCursor !== null), {
    message: "The invoice list is incomplete. Refresh before loading more.",
  });
export type InvoiceIndexEntry = z.infer<typeof invoiceIndexEntrySchema>;
export type InvoiceIndexPage = z.infer<typeof invoiceIndexPageSchema>;

export const invoiceFilters = [
  { id: "all", label: "All invoices" },
  { id: "overdue", label: "Overdue" },
  { id: "open", label: "Open" },
  { id: "draft", label: "Drafts" },
  { id: "paid", label: "Paid" },
  { id: "uncollectible", label: "Uncollectible" },
  { id: "void", label: "Void" },
] as const;
export type InvoiceFilter = (typeof invoiceFilters)[number]["id"];

export function invoiceIsOverdue(invoice: InvoiceIndexEntry, now: number) {
  return (
    invoice.status === "open" &&
    invoice.remaining !== null &&
    invoice.remaining > 0 &&
    invoice.dueDate !== null &&
    Date.parse(invoice.dueDate) < now
  );
}

/** Repeated provider IDs can straddle pages while new invoices arrive. */
export function loadedInvoices(pages: InvoiceIndexPage[]): InvoiceIndexEntry[] {
  const seen = new Set<string>();
  return pages.flatMap((page) =>
    page.invoices.filter((invoice) => {
      if (seen.has(invoice.id)) return false;
      seen.add(invoice.id);
      return true;
    }),
  );
}

export function selectInvoices(
  invoices: InvoiceIndexEntry[],
  {
    search,
    status,
    sort,
    now,
  }: {
    search: string;
    status: InvoiceFilter;
    sort: "newest" | "oldest" | "due";
    now: number;
  },
) {
  const term = search.trim().toLocaleLowerCase();
  return invoices
    .filter((invoice) => {
      const matchesStatus =
        status === "all" ||
        (status === "overdue" ? invoiceIsOverdue(invoice, now) : invoice.status === status);
      return (
        matchesStatus &&
        (!term ||
          [invoice.number, invoice.id, invoice.contactName, invoice.contactEmail].some((value) =>
            value?.toLocaleLowerCase().includes(term),
          ))
      );
    })
    .sort((a, b) => {
      if (sort === "due") {
        const aDue = a.status === "open" && a.dueDate ? Date.parse(a.dueDate) : Infinity;
        const bDue = b.status === "open" && b.dueDate ? Date.parse(b.dueDate) : Infinity;
        if (aDue !== bDue) return aDue < bDue ? -1 : 1;
      }
      const difference = Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return (sort === "oldest" ? -difference : difference) || a.id.localeCompare(b.id);
    });
}

/** A loaded-invoice projection, never a cash ledger or a cross-currency sum. */
export function invoiceOverview(invoices: InvoiceIndexEntry[], now: number) {
  const balances = new Map<string, { open: number; overdue: number; draft: number }>();
  let unknownBalances = 0;
  const counts = { open: 0, overdue: 0, draft: 0 };
  for (const invoice of invoices) {
    if (invoice.status !== "open" && invoice.status !== "draft") continue;
    counts[invoice.status]++;
    const overdue = invoiceIsOverdue(invoice, now);
    if (overdue) counts.overdue++;
    const value = invoice.status === "draft" ? invoice.amountDue : invoice.remaining;
    if (!invoice.currency || value === null) {
      unknownBalances++;
      continue;
    }
    const balance = balances.get(invoice.currency) ?? { open: 0, overdue: 0, draft: 0 };
    balance[invoice.status] += value;
    if (overdue) balance.overdue += value;
    balances.set(invoice.currency, balance);
  }
  return {
    counts,
    unknownBalances,
    balances: [...balances].sort(([a], [b]) => a.localeCompare(b)),
  };
}
