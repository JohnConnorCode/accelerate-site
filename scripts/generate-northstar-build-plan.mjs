#!/usr/bin/env node
/**
 * Regenerates docs/NORTHSTAR-BUILD-PLAN.md purely from
 * scripts/feature-backlog-data.mjs — no hand-written status narrative.
 *
 * The file this replaces was a hand-maintained second roadmap: percentages,
 * "Completed this session" bullet lists, and phase summaries that AGENTS.md's
 * own rule ("do not create a second roadmap") forbids, and that nothing
 * verified — it could say anything and no check would notice. This generator
 * makes the doc a pure, deterministic function of the manifest: every number
 * in it is computed from live card data, so it cannot drift into self-praise
 * the way the file it replaces did (Phase B was marked "100% COMPLETE" the
 * same week the tables its primitives depended on turned out not to exist).
 *
 * Run with --check to verify the committed file matches what this generator
 * produces right now, without writing anything — that's what CI/
 * verify:agent-contract runs. Deliberately embeds no timestamp: the output
 * is a pure function of the manifest, so re-running with no manifest change
 * produces a byte-identical file and --check stays meaningful.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { featureBacklog } from "./feature-backlog-data.mjs";
import { buildDependencyGraph, milestoneOf } from "./lib/feature-board-graph.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const outPath = join(repoRoot, "docs/NORTHSTAR-BUILD-PLAN.md");
const checkOnly = process.argv.includes("--check");

const PHASE_LABEL = { A: "A (Complete Loop One — See + Remember)", B: "B (Agent Runtime foundation — Notice + Act primitives)", C: "C (Reference coworker — Sales end-to-end loop)", D: "D (Plugin SDK + MCP)", E: "E (Additional coworkers/plugins + documentation)" };
function northstarPhase(phase) {
  return phase <= 1 ? "A" : phase <= 3 ? "B" : phase === 4 ? "C" : phase === 5 ? "D" : "E";
}
function phaseOf(card) {
  const label = card.labels.find((l) => l.startsWith("phase:"));
  return label ? Number(label.slice("phase:".length)) : null;
}

export function generateBuildPlanContent() {
const STATUSES = ["backlog", "planned", "in_progress", "blocked", "shipped"];
const active = featureBacklog.filter((c) => !c.archived_at);

function statusRow(cards) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const c of cards) counts[c.status] = (counts[c.status] ?? 0) + 1;
  return counts;
}

// -----------------------------------------------------------------------------
// Status by northstar phase
// -----------------------------------------------------------------------------
const byPhase = new Map();
for (const card of active) {
  const phase = northstarPhase(phaseOf(card) ?? 0);
  if (!byPhase.has(phase)) byPhase.set(phase, []);
  byPhase.get(phase).push(card);
}

let phaseTable = "| Phase | Backlog | Planned | In progress | Blocked | Shipped | Total |\n";
phaseTable += "|---|---|---|---|---|---|---|\n";
for (const phase of ["A", "B", "C", "D", "E"]) {
  const cards = byPhase.get(phase) ?? [];
  const counts = statusRow(cards);
  phaseTable += `| ${phase} — ${PHASE_LABEL[phase]} | ${counts.backlog} | ${counts.planned} | ${counts.in_progress} | ${counts.blocked} | ${counts.shipped} | ${cards.length} |\n`;
}

// -----------------------------------------------------------------------------
// Dispatchable now: what `npm run agent:next` would actually pick from
// (milestone:now|next, backlog/planned, unclaimed by definition — every
// manifest card starts with no live lease).
// -----------------------------------------------------------------------------
const dispatchable = active
  .filter((c) => (c.status === "backlog" || c.status === "planned") && (milestoneOf(c) === "now" || milestoneOf(c) === "next"))
  .sort((a, b) => a.sort_order - b.sort_order);

let dispatchableList = dispatchable.length
  ? dispatchable.map((c) => `- \`${c.seed_key}\` [${c.priority}] — ${c.title}`).join("\n")
  : "_None — see the dispatch-deadlock integrity check in verify:agent-contract, which fails closed on this exact state._";

// -----------------------------------------------------------------------------
// In progress
// -----------------------------------------------------------------------------
const inProgress = active.filter((c) => c.status === "in_progress").sort((a, b) => a.sort_order - b.sort_order);
let inProgressList = inProgress.length
  ? inProgress.map((c) => `- \`${c.seed_key}\` — ${c.title} (${c.owner ?? "no owner recorded"})`).join("\n")
  : "_None._";

// -----------------------------------------------------------------------------
// Blocked
// -----------------------------------------------------------------------------
const blocked = active.filter((c) => c.status === "blocked").sort((a, b) => a.sort_order - b.sort_order);
let blockedList = blocked.length
  ? blocked.map((c) => `- \`${c.seed_key}\` — ${c.title}`).join("\n")
  : "_None._";

// -----------------------------------------------------------------------------
// Dependency-ready but not yet in the dispatch horizon (should be empty —
// the same condition verify:agent-contract's findDispatchDeadlock checks,
// surfaced here for a human skimming this file).
// -----------------------------------------------------------------------------
const graph = buildDependencyGraph(active);
const readyNotDispatchable = active.filter((c) => {
  if (c.status !== "backlog" && c.status !== "planned") return false;
  const m = milestoneOf(c);
  if (m === "now" || m === "next") return false;
  const deps = graph.edges.get(c.seed_key) ?? [];
  return deps.every((depKey) => graph.byKey.get(depKey)?.status === "shipped");
});
let readyNotDispatchableList = readyNotDispatchable.length
  ? readyNotDispatchable.map((c) => `- \`${c.seed_key}\` — ${c.title}`).join("\n")
  : "_None — every dependency-ready card carries milestone:now or milestone:next._";

const totalCounts = statusRow(active);

const content = `# Northstar Build Plan

> **Auto-generated — do not hand-edit.** Produced by \`npm run report:build-plan\`
> from \`scripts/feature-backlog-data.mjs\`. Every number below is computed
> from live card data; \`npm run verify:build-plan\` (wired into
> \`verify:agent-contract\`) fails if this file drifts from the generator's
> output. To update it after a manifest change, run
> \`npm run report:build-plan\` and commit the result.
>
> This replaces a hand-maintained second roadmap that AGENTS.md's own rule
> forbids ("do not create a second roadmap") and that nothing verified —
> see \`docs/contributing/AGENT-TICKET-RUNBOOK.md\` for the actual pickup
> procedure (\`npm run agent:next\`), and \`docs/NORTHSTAR.md\` for the vision
> this board tracks against.

## Status by phase

${phaseTable}
**Board total:** ${totalCounts.backlog} backlog, ${totalCounts.planned} planned, ${totalCounts.in_progress} in progress, ${totalCounts.blocked} blocked, ${totalCounts.shipped} shipped (${active.length} managed cards).

## Dispatchable now (\`npm run agent:next\` picks from this set)

${dispatchableList}

## In progress

${inProgressList}

## Blocked

${blockedList}

## Dependency-ready but outside the dispatch horizon

Should always be empty — a non-empty list here means the same defect
\`findDispatchDeadlock\` in \`scripts/lib/feature-board-graph.mjs\` catches:
dependency-ready work exists that no milestone label makes claimable.

${readyNotDispatchableList}
`;
  return content;
}

export function buildPlanIsInSync() {
  const existing = (() => {
    try {
      return readFileSync(outPath, "utf8");
    } catch {
      return null;
    }
  })();
  return existing === generateBuildPlanContent();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (checkOnly) {
    if (!buildPlanIsInSync()) {
      console.error(
        "docs/NORTHSTAR-BUILD-PLAN.md is out of date. Run `npm run report:build-plan` and commit the result.",
      );
      process.exit(1);
    }
    console.log("docs/NORTHSTAR-BUILD-PLAN.md is in sync.");
  } else {
    writeFileSync(outPath, generateBuildPlanContent());
    console.log(`Wrote ${outPath}`);
  }
}
