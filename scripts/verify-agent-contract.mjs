import { existsSync, readFileSync, readdirSync } from "node:fs";
import {
  featureBacklog,
  LOOP_ONE,
  NOW_KEYS,
  SECOND_BRAIN_IMPLEMENTATIONS,
  validateFeatureBacklog,
} from "./feature-backlog-data.mjs";
import { collectFeatureBoardIntegrityFailures } from "./lib/feature-board-graph.mjs";
import { collectWiringFailures } from "./verify-wiring.mjs";
import { buildPlanIsInSync } from "./generate-northstar-build-plan.mjs";

const requiredFiles = [
  "AGENTS.md",
  "docs/contributing/AGENT-TICKET-RUNBOOK.md",
  "docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md",
  "docs/contracts/MULTI-TENANCY-CONTRACT.md",
  "docs/self-hosting/REVENUE-OS-SETUP.md",
  "docs/contracts/FEATURE-BOARD-TAXONOMY.md",
  "docs/contracts/MARKETING-POSITIONING-CONTRACT.md",
  "docs/contracts/NAVIGATION-RUNTIME-CONTRACT.md",
  "docs/contracts/ADMIN-DEMO-CONTRACT.md",
  "docs/contracts/WORK-MOTION-CONTRACT.md",
  "docs/contributing/PROGRAM-WAVES.md",
  "src/lib/revenue-os/README.md",
];
const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing agent contract file: ${file}`);
}

const agentContract = existsSync("AGENTS.md") ? readFileSync("AGENTS.md", "utf8") : "";
const ticketRunbook = existsSync("docs/contributing/AGENT-TICKET-RUNBOOK.md")
  ? readFileSync("docs/contributing/AGENT-TICKET-RUNBOOK.md", "utf8")
  : "";
const programWaves = existsSync("docs/contributing/PROGRAM-WAVES.md")
  ? readFileSync("docs/contributing/PROGRAM-WAVES.md", "utf8")
  : "";

if (!/Production deployment is founder-controlled[\s\S]*Never deploy/i.test(agentContract)) {
  failures.push(
    "AGENTS.md must reserve production deployment authority for an explicit founder instruction",
  );
}
if (!/inspect every repository[\s\S]*worktree and local branch/i.test(agentContract)) {
  failures.push(
    "AGENTS.md must require a repository-wide worktree and branch audit before release",
  );
}
if (!/Deploy that\s+exact immutable commit only/i.test(agentContract)) {
  failures.push("AGENTS.md must require deployment of the exact verified immutable commit");
}
if (!/Do not deploy as an automatic final step/i.test(ticketRunbook)) {
  failures.push("The agent runbook must prohibit automatic production deployment");
}
if (!/Any post-verification change reopens the\s+verification gate/i.test(ticketRunbook)) {
  failures.push("The agent runbook must reopen verification after a release-tree change");
}

const requiredProgramWaveSections = [
  "## Purpose and authority",
  "## Claiming and coordination",
  "## Mandatory ticket packet",
  "## Architecture law",
  "## Dependency-ordered program",
  "## Optional provider lane",
  "## Verification matrix",
  "## Evidence and worker handoff",
  "## Release gate",
  "## Permanent non-goals",
];
for (const section of requiredProgramWaveSections) {
  if (!programWaves.includes(section)) failures.push(`Program waves doc is missing ${section}`);
}
if (
  !programWaves.includes("The live Feature Board is the authoritative work record") ||
  !programWaves.includes("never archives unlisted work")
) {
  failures.push(
    "Program waves must preserve live work authority and non-destructive reviewed imports",
  );
}
if (!/Production release is founder-authorized per named release/i.test(programWaves)) {
  failures.push("Program waves doc must preserve per-release founder deployment authority");
}

const requiredNoteSections = [
  "Workstream:",
  "Dependencies:",
  "Starting points:",
  "Guardrails / non-goals:",
  "Architecture contract:",
  "Required verification:",
  "Stop conditions:",
  "Agent handoff:",
];

for (const card of featureBacklog) {
  const prefix = `[${card.seed_key}]`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.seed_key))
    failures.push(`${prefix} seed key is not stable kebab-case`);
  if (card.description.trim().length < 60)
    failures.push(`${prefix} description is too thin for independent pickup`);
  if (card.labels.filter((label) => label.startsWith("category:")).length !== 1)
    failures.push(`${prefix} needs exactly one category label`);
  if (card.labels.filter((label) => label.startsWith("milestone:")).length !== 1)
    failures.push(`${prefix} needs exactly one milestone label`);
  if (card.labels.filter((label) => /^phase:\d+$/.test(label)).length !== 1)
    failures.push(`${prefix} needs exactly one phase label`);
  if (
    card.labels.filter((label) => label.startsWith("capability:")).length < 1 ||
    card.labels.filter((label) => label.startsWith("capability:")).length > 2
  )
    failures.push(`${prefix} needs one or two capability labels`);
  if (card.labels.length > 5) failures.push(`${prefix} has label sprawl (${card.labels.length})`);
  const acceptanceItems = card.acceptance_criteria
    .split("\n")
    .filter((line) => /^-\s+\S/.test(line));
  if (acceptanceItems.length < 2)
    failures.push(`${prefix} needs at least two observable acceptance items`);
  for (const section of requiredNoteSections) {
    if (!card.notes.includes(section)) failures.push(`${prefix} notes are missing ${section}`);
  }
  if (card.status === "in_progress" && !card.owner?.trim())
    failures.push(`${prefix} is in progress without an Owner`);
  // Evidence is proof of completion, not proof of having been claimed — a
  // card freshly claimed through the live claim RPC (scripts/agent-dispatch.ts)
  // legitimately has zero evidence text for the entire time it's in_progress;
  // only require it once the card actually ships.
  if (card.status === "shipped" && !card.notes.includes("Current implementation evidence:")) {
    failures.push(`${prefix} is shipped without current/remaining implementation evidence`);
  }
  if (card.status === "shipped" && !/verif|pass|production|playwright|evidence/i.test(card.notes)) {
    failures.push(`${prefix} is shipped without verification evidence`);
  }
}

const cardsByKey = new Map(featureBacklog.map((card) => [card.seed_key, card]));
const boardIntegrity = collectFeatureBoardIntegrityFailures(featureBacklog, {
  loopKeys: LOOP_ONE,
  nowKeys: NOW_KEYS,
  secondBrainImplementations: SECOND_BRAIN_IMPLEMENTATIONS,
});
failures.push(...boardIntegrity.failures);
for (const warning of boardIntegrity.warnings) console.warn(`warning: ${warning}`);

// "Shipped" must be mechanically earned, not self-reported prose: catches
// unwired modules, tables no migration creates, unregistered cron routes,
// and swallowed errors — the exact defect shapes this contract's own
// history shipped and called done. See scripts/verify-wiring.mjs.
failures.push(...collectWiringFailures());

if (!(await buildPlanIsInSync()))
  failures.push(
    "docs/NORTHSTAR-BUILD-PLAN.md is out of date. Run `npm run report:build-plan` and commit the result.",
  );

// The program waves doc sequences stable card keys but never owns their
// mutable status. Resolve every `card:<key>` reference against the manifest so
// a rename or missing card fails before a lower-context agent is dispatched.
const referencedWaveKeys = [...programWaves.matchAll(/`card:([a-z0-9]+(?:-[a-z0-9]+)*)`/g)].map(
  (match) => match[1],
);
if (!referencedWaveKeys.length)
  failures.push("Program waves doc must reference Feature Board work by stable card:key tokens");
for (const key of new Set(referencedWaveKeys)) {
  if (!cardsByKey.has(key))
    failures.push(`Program waves doc references missing Feature Board key: ${key}`);
}

const waveExtensionKeys = [
  "feature-board-dependency-integrity",
  "booking-mode-contract-reconciliation",
  "task-operator-workspace",
  "identity-review-workbench",
  "data-quality-repair-center",
  "stage-history-analytics-reconciliation",
  "incident-receipt-recovery-console",
  "operating-goals-scorecards",
  "forecast-scenario-planner",
  "won-to-delivery-handoff",
  "client-success-lifecycle-workspace",
  "governed-bulk-operator-actions",
  "automation-policy-registry",
  "client-instance-portability",
  "integration-adapter-contract",
  "microsoft-365-workspace-parity",
  "stripe-revenue-reconciliation",
  "slack-notification-approval-surface",
  "notion-knowledge-source",
];
for (const key of waveExtensionKeys) {
  const card = cardsByKey.get(key);
  if (!card) {
    failures.push(`Wave-sequenced card is missing from the manifest: ${key}`);
    continue;
  }
  if (!referencedWaveKeys.includes(key))
    failures.push(`Wave-sequenced card is not sequenced in the program waves doc: ${key}`);
}
for (const key of [
  "microsoft-365-workspace-parity",
  "stripe-revenue-reconciliation",
  "slack-notification-approval-surface",
  "notion-knowledge-source",
]) {
  const card = cardsByKey.get(key);
  if (card && !card.labels.includes("milestone:later"))
    failures.push(
      `[${key}] optional provider work must remain milestone:later until separately authorized`,
    );
}

// Tenant-config ratchet. Accelerate's source config is the bootstrap shape and
// tenant workspaces load the same validated shape at request time. A business
// literal under these directories bypasses that seam and is a cross-tenant bug.
//
// The budget below is the count of literals each file still carries. It may only
// shrink: adding one fails, and removing them all should delete the entry.
// src/content and the public marketing pages are deliberately out of scope, since
// those are Accelerate's own website and stay single-brand.
const BRAND_LITERAL = /acceleratewith|Accelerate/;
const BRAND_SCOPE = ["src/lib", "src/app/admin", "src/app/api/admin", "src/components/admin"];
const BRAND_BUDGET = {
  // Empty on purpose: every business fact in these directories now reads from
  // src/config/tenant.ts. Adding an entry here means accepting a regression, so
  // move the value into the tenant config instead.
};

function sourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

const brandCounts = new Map();
for (const dir of BRAND_SCOPE) {
  if (!existsSync(dir)) continue;
  for (const file of sourceFiles(dir)) {
    const hits = readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => BRAND_LITERAL.test(line)).length;
    if (hits) brandCounts.set(file, hits);
  }
}
for (const [file, hits] of brandCounts) {
  const budget = BRAND_BUDGET[file] ?? 0;
  if (hits > budget) {
    failures.push(
      `${file} has ${hits} hard-coded business literal(s) but a budget of ${budget}. Move the value into src/config/tenant.ts, or lower the budget if you removed some.`,
    );
  }
}
for (const [file, budget] of Object.entries(BRAND_BUDGET)) {
  const hits = brandCounts.get(file) ?? 0;
  if (hits < budget) {
    failures.push(
      `${file} now has ${hits} business literal(s), below its budget of ${budget}. Lower the budget in verify-agent-contract.mjs so the ratchet holds.`,
    );
  }
}

if (existsSync("CLAUDE.md")) {
  const claude = readFileSync("CLAUDE.md", "utf8");
  if (/Any authenticated Supabase user can access/i.test(claude)) {
    failures.push("CLAUDE.md contradicts founder-only ADMIN_EMAIL authorization");
  }
}

validateFeatureBacklog();

if (failures.length) {
  console.error(
    `Agent contract failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const statuses = Object.fromEntries(
  [...new Set(featureBacklog.map((card) => card.status))]
    .sort()
    .map((status) => [status, featureBacklog.filter((card) => card.status === status).length]),
);
console.log(
  JSON.stringify(
    {
      contract: "revenue-os-agent-contract.v1",
      files: requiredFiles.length,
      cards: featureBacklog.length,
      statuses,
      result: "passed",
    },
    null,
    2,
  ),
);
