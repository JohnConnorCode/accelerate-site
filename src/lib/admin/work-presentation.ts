export function relativeTime(value: string | null) {
  if (!value) return "No due date";
  // Task due dates come from a DATE column, so they carry no time. Parsing one
  // as an instant makes it midnight, which meant a task created at 09:00 and due
  // the same day immediately read as "9h overdue". Compare whole days instead,
  // in UTC, to match how the queue service decides urgency.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const today = new Date().toISOString().slice(0, 10);
    if (value === today) return "Due today";
    const days = Math.round(
      (Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
    );
    if (days < 0) return `${Math.abs(days)}d overdue`;
    return days === 1 ? "Due tomorrow" : `Due in ${days}d`;
  }
  const difference = Date.parse(value) - Date.now();
  const absoluteHours = Math.max(1, Math.round(Math.abs(difference) / 3_600_000));
  if (difference < 0)
    return absoluteHours < 24
      ? `${absoluteHours}h overdue`
      : `${Math.ceil(absoluteHours / 24)}d overdue`;
  if (absoluteHours < 24) return `Due in ${absoluteHours}h`;
  return `Due in ${Math.ceil(absoluteHours / 24)}d`;
}

/** Related names are display text; only stored identifiers resolve a record. */
export function taskSourceLink(task: {
  opportunity_id?: string | null;
  related_type?: string | null;
  related_id?: string | null;
}): { href: string; label: string } | null {
  if (task.opportunity_id)
    return {
      href: `/admin/pipeline/${encodeURIComponent(task.opportunity_id)}`,
      label: "Open related opportunity",
    };
  if (!task.related_id) return null;
  const id = encodeURIComponent(task.related_id);
  if (task.related_type === "client")
    return { href: `/admin/clients/${id}`, label: "Open related client" };
  if (task.related_type === "contact")
    return { href: `/admin/contacts/${id}`, label: "Open related contact" };
  if (task.related_type === "opportunity")
    return { href: `/admin/pipeline/${id}`, label: "Open related opportunity" };
  if (task.related_type === "lead") return { href: "/admin/leads", label: "Open inquiries" };
  if (task.related_type === "partner") return { href: "/admin/partners", label: "Open partners" };
  return null;
}
