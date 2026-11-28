/** Calendar-only service dates; custom ranges remain verbatim. */
export function serviceDateInput(period: string): string {
  const text = period.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(text + "T12:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : "";
  }
  if (!/^[A-Za-z]+ \d{1,2}, \d{4}$/.test(text)) return "";
  const date = new Date(text + " 12:00:00 UTC");
  if (!Number.isFinite(date.getTime())) return "";
  const iso = date.toISOString().slice(0, 10);
  return serviceDateLabel(iso).toLowerCase() === text.toLowerCase() ? iso : "";
}

export function serviceDateLabel(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const date = new Date(iso + "T12:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

/** Calendar overrides never replace the real issuance audit timestamp. */
export function invoiceDueAt(invoice: {
  invoice_date?: string | null;
  due_date?: string | null;
  due_days: number;
  issued_at?: string | null;
  due_at?: string | null;
}): string | null {
  if (invoice.due_date) return invoice.due_date + "T00:00:00Z";
  if (invoice.invoice_date) {
    const date = new Date(invoice.invoice_date + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + invoice.due_days);
    return date.toISOString();
  }
  return invoice.due_at || null;
}
export function invoiceDueLabel(invoice: Parameters<typeof invoiceDueAt>[0]): string {
  const value = invoiceDueAt(invoice);
  if (!invoice.due_date && invoice.due_days === 0) return "Upon receipt";
  return value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(value),
      )
    : "Set when issued";
}
