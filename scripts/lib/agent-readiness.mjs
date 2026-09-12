/** Bounded diagnosis; lifecycle readiness itself comes from the canonical service. */
export function readinessSummary(cards, now = Date.now()) {
  const reasons = {};
  let active = 0,
    expired = 0,
    resumable = 0;
  for (const card of cards) {
    if (card.status === "in_progress") {
      if (Date.parse(card.lease_expires_at ?? "") > now) active++;
      else {
        expired++;
        if (card.work_checkpoint && card.resume_readiness?.length === 0) resumable++;
      }
    }
    if (
      ["backlog", "planned"].includes(card.status) &&
      card.labels?.some((l) => ["milestone:now", "milestone:next"].includes(l))
    )
      for (const reason of card.readiness ?? []) reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  return { active, expired, resumable, reasons };
}
export function resumableCard(card, support, now = Date.now()) {
  return (
    support?.version === 1 &&
    support.automaticRecoveryProjects?.includes(card.project_key) &&
    card.status === "in_progress" &&
    Date.parse(card.lease_expires_at ?? "") <= now &&
    card.work_checkpoint &&
    card.resume_readiness?.length === 0
  );
}
