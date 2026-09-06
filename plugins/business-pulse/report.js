(() => {
  const now = Date.parse(reportContext().now);
  const today = reportContext().now.slice(0, 10);
  const pipeline = readSource("pipeline")
    .filter(
      (row) =>
        !["won", "lost", "archived"].includes(row.stage) &&
        (Date.parse(row.next_action_at) < now || Date.parse(row.updated_at) < now - 7 * 86400000),
    )
    .map((row) => ({
      source: "pipeline",
      id: row.id,
      title: row.name || "Untitled opportunity",
      detail: "Review the next action and recent account activity.",
      severity: "attention",
    }));
  const commitments = readSource("commitments")
    .filter(
      (row) =>
        ["pending", "snoozed"].includes(row.status) &&
        typeof row.due_date === "string" &&
        row.due_date.slice(0, 10) < today,
    )
    .map((row) => ({
      source: "commitments",
      id: row.id,
      title: row.title || "Untitled task",
      detail: "Overdue since " + row.due_date.slice(0, 10),
      severity: "attention",
    }));
  const meetings = readSource("meetings")
    .filter(
      (row) =>
        row.status !== "cancelled" &&
        Date.parse(row.start_at) >= now &&
        Date.parse(row.start_at) < now + 48 * 3600000,
    )
    .map((row) => ({
      source: "meetings",
      id: row.id,
      title: row.title || "Untitled meeting",
      detail: "Upcoming: " + row.start_at,
      severity: "info",
    }));
  const items = [...commitments, ...pipeline, ...meetings];
  return {
    summary:
      pipeline.length +
      " pipeline risks · " +
      commitments.length +
      " overdue commitments · " +
      meetings.length +
      " upcoming meetings in inspected records.",
    items: items.slice(0, 20),
    totalFindings: items.length,
  };
})();
