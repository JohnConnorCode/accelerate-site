(() => {
  const now = Date.parse(reportContext().now);
  const items = readSource("records")
    .filter(
      (row) =>
        row.status !== "cancelled" &&
        Date.parse(row.start_at) >= now &&
        Date.parse(row.start_at) < now + 48 * 3600000,
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .map((row) => ({
      source: "records",
      id: row.id,
      title: row.title || "Untitled meeting",
      detail:
        "Starts " +
        row.start_at +
        (row.end_at ? " · Ends " + row.end_at : "") +
        ". Review the linked meeting and prepare your questions.",
      severity: "info",
    }));
  return {
    summary: items.length + " upcoming meetings in the inspected records (next 48 hours).",
    items: items.slice(0, 20),
    totalFindings: items.length,
  };
})();
