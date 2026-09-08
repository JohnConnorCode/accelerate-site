/** Shared terminal-stage policy for live services and fictional demos. */
export function requireReopenEligibility(
  fromRole: "open" | "won" | "lost",
  toRole: "open" | "won" | "lost",
  from: string,
  to: string,
  reason: string | undefined,
  allowReopen: boolean,
) {
  // Only leaving a terminal role entirely counts as "reopening" — moving
  // between two stages that share the same terminal role (e.g. two
  // different admin-created "won" stages) is a lateral re-categorization of
  // an already-closed deal, not a reopen, so it needs no justification.
  if (fromRole === "open" || fromRole === toRole || from === to) return;
  if (!allowReopen) {
    throw new Error(
      `Reopen policy for terminal-stage opportunities is disabled for ${from}->${to}.`,
    );
  }
  if (!reason?.trim()) throw new Error(`A reason is required to reopen ${from} opportunities.`);
}
