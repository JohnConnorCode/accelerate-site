(() => {
  const now = Date.parse(reportContext().now);
  const items = readSource("records")
    .filter((row) => !["won", "lost", "archived"].includes(row.stage))
    .flatMap((row) => {
      const due = Date.parse(row.next_action_at);
      const updated = Date.parse(row.updated_at);
      const overdue = Number.isFinite(due) && due < now;
      const stale = Number.isFinite(updated) && now - updated >= 7 * 86400000;
      return overdue || stale
        ? [
            {
              source: "records",
              id: row.id,
              title: row.name || "Untitled opportunity",
              detail: overdue
                ? "Next action overdue since " + row.next_action_at
                : "No recorded update since " + row.updated_at,
              severity: overdue ? "attention" : "info",
            },
          ]
        : [];
    });
  return {
    summary: items.length + " opportunities need follow-up in the inspected records.",
    items: items.slice(0, 20),
    totalFindings: items.length,
  };
})();
