#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "docs/NORTHSTAR-BUILD-PLAN.md");
const snapshotPath = join(root, "docs/planning/backlog-snapshot.json");
export function generateBuildPlanContent() {
  if (!existsSync(snapshotPath))
    return "# Northstar Build Plan\n\nA dated live-board export is required. Run `npm run backlog:snapshot`. No local template is live execution truth.\n";
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const cards = snapshot.features;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const label = (c, p) => c.labels?.find((l) => l.startsWith(p + ":"))?.slice(p.length + 1);
  const horizon = { now: 0, next: 1, later: 2, done: 3 },
    priority = { urgent: 0, high: 1, medium: 2, low: 3 };
  const order = (a, b) =>
    (horizon[label(a, "milestone")] ?? 2) - (horizon[label(b, "milestone")] ?? 2) ||
    (priority[a.priority] ?? 2) - (priority[b.priority] ?? 2) ||
    a.sort_order - b.sort_order ||
    a.id.localeCompare(b.id);
  const phases = {
    A: "Connected business loop",
    B: "Governed runtime",
    C: "Reference Sales coworker",
    D: "Supported extensions",
    E: "Additional business workflows",
  };
  const list = (rows) =>
    rows.length
      ? rows
          .sort(order)
          .map(
            (c) =>
              `- \`${c.seed_key ?? c.id}\` — ${c.title}${c.readiness?.length ? " · " + c.readiness.join("; ") : ""}`,
          )
          .join("\n")
      : "_None in this snapshot._";
  const ready = cards.filter(
    (c) => ["backlog", "planned"].includes(c.status) && c.readiness?.length === 0,
  );
  const needSpec = cards.filter(
    (c) =>
      ["backlog", "planned", "blocked"].includes(c.status) &&
      c.readiness?.some(
        (r) =>
          r.startsWith("missing_") || r.startsWith("invalid_") || r === "unresolved_dependencies",
      ),
  );
  const counts = cards.reduce((a, c) => ((a[c.status] = (a[c.status] ?? 0) + 1), a), {});
  const rows = Object.entries(phases).map(([phase, name]) => {
    const proof = cards.find((c) => c.seed_key === `northstar-phase-${phase.toLowerCase()}-proof`);
    const assigned = cards.filter(
      (c) => (c.work_spec?.northstar?.phase ?? c.auditClassification?.phase) === phase,
    );
    const evidenced = proof?.status === "shipped" && proof.work_delivery?.reviewedAt;
    return `| ${phase} — ${name} | ${assigned.length} | ${evidenced ? "Accepted outcome evidence" : "Outcome not yet verified"} | ${proof ? "`" + proof.seed_key + "` · " + proof.status : "Missing proof card"} |`;
  });
  const unresolved = cards.flatMap((c) =>
    (c.dependencies ?? []).filter((id) => !byId.has(id)).map((id) => `${c.seed_key} → ${id}`),
  );
  return `# Northstar Build Plan\n\nGenerated from the live-board snapshot exported **${snapshot.exportedAt}**. This is a dated report, not live dispatch authority. Use \`npm run agent:status\` for current readiness. Git templates never overwrite live definitions.\n\n${cards.length} active records: ${Object.entries(
    counts,
  )
    .map(([k, v]) => `${v} ${k}`)
    .join(
      ", ",
    )}. Accepted verification does not imply integration or deployment. Historical phase classifications are identified in the snapshot; frozen specifications remain unchanged.\n\n## Outcome gates\n\n| Phase | Classified cards | Outcome evidence | Proof card |\n|---|---:|---|---|\n${rows.join("\n")}\n\nPhases can advance in parallel. Dependencies and capability requirements gate implementation; useful business journeys set priority. Card counts are inventory, never phase completion percentages.\n\n## Ready within Now and Next\n\n${list(ready.filter((c) => ["now", "next"].includes(label(c, "milestone"))))}\n\n## Ready but intentionally Later\n\n${list(ready.filter((c) => label(c, "milestone") === "later"))}\n\n## Needs specification\n\n${list(needSpec)}\n\n## Active and in review\n\n${list(cards.filter((c) => ["in_progress", "in_review"].includes(c.status)))}\n\n## Blocked\n\n${list(cards.filter((c) => c.status === "blocked"))}\n\n## Verified work with integration or required production proof unrecorded\n\n${list(cards.filter((c) => c.status === "shipped" && (!c.work_delivery?.mergedAt || (c.work_spec?.acceptance?.some((a) => a.environment === "production") && !c.work_delivery?.deployedAt))))}\n\n## Snapshot integrity\n\nMissing dependency records: ${unresolved.length}.${unresolved.length ? ` ${unresolved.join("; ")}` : ""}\nAudit dispositions and historical prerequisite anomalies are in [BACKLOG-AUDIT](planning/BACKLOG-AUDIT.md). Refresh with \`npm run backlog:snapshot\`, then regenerate this report; offline checks never mutate live work.\n`;
}
export function buildPlanIsInSync() {
  return existsSync(out) && readFileSync(out, "utf8") === generateBuildPlanContent();
}
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--check")) {
    if (!buildPlanIsInSync()) {
      console.error("Build plan differs from its dated snapshot; run npm run report:build-plan.");
      process.exitCode = 1;
    } else console.log("Build plan matches its dated snapshot.");
  } else {
    writeFileSync(out, generateBuildPlanContent());
    console.log("Generated dated north star report.");
  }
}
