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
