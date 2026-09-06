(() => {
  const today = reportContext().now.slice(0, 10);
  const items = readSource("records")
    .filter(
      (row) =>
        ["pending", "snoozed"].includes(row.status) &&
        typeof row.due_date === "string" &&
        row.due_date.slice(0, 10) < today,
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((row) => ({
      source: "records",
      id: row.id,
      title: row.title || "Untitled task",
      detail: "Due " + row.due_date.slice(0, 10) + " · " + row.status,
      severity: "attention",
    }));
  return {
    summary: items.length + " overdue commitments in the inspected records.",
    items: items.slice(0, 20),
    totalFindings: items.length,
  };
})();
