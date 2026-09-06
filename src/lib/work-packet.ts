/** Presentation of canonical work contracts. SQL remains the readiness authority. */
export type WorkPacketCard = {
  id: string;
  seed_key?: string | null;
  title: string;
  status: string;
  description?: string | null;
  notes?: string | null;
  labels: string[];
  priority?: string;
  sort_order?: number;
  revision?: number;
  initiative?: string;
  work_kind?: string;
  work_spec?: Record<string, unknown>;
  readiness?: string[];
  dependencies?: string[];
  work_blocker?: string | null;
  work_delivery?: Record<string, unknown>;
};
export const EVIDENCE_ENVIRONMENTS = [
  "local",
  "controlled-integration",
  "production",
  "observation",
] as const;
export const NORTHSTAR_PHASES = {
  A: "Connected business loop",
  B: "Governed runtime",
  C: "Reference Sales coworker",
  D: "Supported extensions",
  E: "Additional business workflows",
} as const;
export function compareWorkOrder(a: WorkPacketCard, b: WorkPacketCard) {
  const horizon = (c: WorkPacketCard) =>
    c.labels.includes("milestone:now") ? 0 : c.labels.includes("milestone:next") ? 1 : 2;
  const priority: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  return (
    horizon(a) - horizon(b) ||
    (priority[a.priority ?? "medium"] ?? 2) - (priority[b.priority ?? "medium"] ?? 2) ||
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    a.id.localeCompare(b.id)
  );
}
export function readableReason(reason: string) {
  if (reason.startsWith("missing_"))
    return `Needs ${reason
      .slice(8)
      .replaceAll("_", " ")
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()}`;
  if (reason.startsWith("blocker:")) return reason.slice(8);
  return reason.replaceAll("_", " ").replace("status:", "Status: ");
}
export function needsSpecification(card: WorkPacketCard) {
  return (
    ["backlog", "planned", "blocked"].includes(card.status) &&
    (card.readiness ?? []).some(
      (r) =>
        r.startsWith("missing_") || r.startsWith("invalid_") || r === "unresolved_dependencies",
    )
  );
}
export function workPacket(card: WorkPacketCard) {
  const s = card.work_spec ?? {};
  return {
    schemaVersion: 2,
    key: card.seed_key ?? card.id,
    id: card.id,
    title: card.title,
    revision: card.revision,
    status: card.status,
    initiative: card.initiative,
    northstar: s.northstar,
    outcome: s.businessValue ?? card.description,
    currentBehavior: s.currentBehavior,
    readiness: card.readiness ?? [],
    dependencies: card.dependencies ?? [],
    blocker: card.work_blocker,
    blockerResolution: s.blockerResolution,
    scope: s.scope,
    exclusions: s.exclusions,
    repository: s.repository,
    references: s.references,
    workflow: s.workflow,
    failureModes: s.failureModes,
    acceptance: s.acceptance,
    verification: s.verification,
    requiredCapabilities: s.requiredCapabilities,
    handoff: s.handoff,
    delivery: card.work_delivery,
  };
}
export function formatWorkPacket(card: WorkPacketCard) {
  const p = workPacket(card);
  const lines = [`# ${p.title}`, `${p.key} · ${p.status} · revision ${p.revision ?? "unknown"}`];
  for (const [key, value] of Object.entries(p)) {
    if (["key", "id", "title", "status", "revision"].includes(key) || value == null) continue;
    lines.push(
      `\n${key.replace(/([A-Z])/g, " $1").toUpperCase()}`,
      typeof value === "string"
        ? value
        : Array.isArray(value)
          ? value
              .map((v) => (typeof v === "string" ? `- ${v}` : `- ${JSON.stringify(v)}`))
              .join("\n")
          : JSON.stringify(value, null, 2),
    );
  }
  lines.push(
    "\nHANDOFF RULE",
    "Submit acceptance-linked evidence for review. Accepted verification, integration and production release are separate facts.",
  );
  return lines.join("\n");
}

/** Mirrors SQL for the fictional session-only transport. Live adapters use SQL reasons. */
export function demoPacketProblems(input: Record<string, unknown> = {}): string[] {
  const s = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const reasons: string[] = [];
  const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const list = (v: unknown): v is unknown[] => Array.isArray(v) && v.length > 0;
  if (s.packetVersion !== 2) reasons.push("missing_packet_version");
  if (!text(s.businessValue)) reasons.push("missing_business_value");
  if (!text(s.currentBehavior)) reasons.push("missing_current_behavior");
  const n = s.northstar as
    { phase?: string; layers?: unknown[]; contribution?: string } | undefined;
  if (
    !n?.phase ||
    !Object.keys(NORTHSTAR_PHASES).includes(n.phase) ||
    !list(n.layers) ||
    !text(n.contribution)
  )
    reasons.push("missing_northstar");
  for (const k of [
    "scope",
    "exclusions",
    "references",
    "verification",
    "workflow",
    "failureModes",
    "acceptance",
  ])
    if (!list(s[k])) reasons.push("missing_" + k);
  if (!Array.isArray(s.requiredCapabilities)) reasons.push("missing_required_capabilities");
  const repo = s.repository as
    { baseCommit?: string; baseBranch?: string; url?: string } | undefined;
  if (!/^[a-f0-9]{40}$/.test(repo?.baseCommit ?? "") || !text(repo?.baseBranch) || !text(repo?.url))
    reasons.push("missing_repository");
  const environments = EVIDENCE_ENVIRONMENTS as readonly string[];
  if (Array.isArray(s.acceptance)) {
    const ids = new Set();
    let invalid = false;
    for (const a of s.acceptance as { id?: string; criterion?: string; environment?: string }[]) {
      if (
        !text(a?.id) ||
        !text(a?.criterion) ||
        !environments.includes(a?.environment ?? "") ||
        ids.has(a?.id)
      )
        invalid = true;
      ids.add(a?.id);
    }
    if (invalid) reasons.push("invalid_acceptance_ids_or_environment");
  }
  if (
    Array.isArray(s.verification) &&
    (s.verification as { command?: string; expected?: string; environment?: string }[]).some(
      (v) =>
        !text(v?.command) || !text(v?.expected) || !environments.includes(v?.environment ?? ""),
    )
  )
    reasons.push("invalid_verification");
  if (
    Array.isArray(s.references) &&
    (s.references as { path?: string; reason?: string }[]).some(
      (r) => !text(r?.path) || !text(r?.reason),
    )
  )
    reasons.push("invalid_references");
  for (const k of ["scope", "exclusions", "workflow", "failureModes"])
    if (Array.isArray(s[k]) && (s[k] as unknown[]).some((v) => !text(v)))
      reasons.push("invalid_" + k);
  if (
    Array.isArray(n?.layers) &&
    n.layers.some((l) => !["See", "Remember", "Notice", "Act", "Learn"].includes(String(l)))
  )
    reasons.push("invalid_northstar_layers");
  return reasons;
}
