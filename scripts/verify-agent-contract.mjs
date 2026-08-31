import { existsSync, readFileSync, readdirSync } from "node:fs";
import { featureBacklog, LOOP_ONE, NOW_KEYS, SECOND_BRAIN_IMPLEMENTATIONS, validateFeatureBacklog } from "./feature-backlog-data.mjs";
import { collectFeatureBoardIntegrityFailures } from "./lib/feature-board-graph.mjs";

const requiredFiles = [
  "AGENTS.md",
  "../AGENTS.md",
  "docs/AGENT-TICKET-RUNBOOK.md",
  "docs/REVENUE-OS-ENGINEERING-CONTRACT.md",
  "docs/REVENUE-OS-SETUP.md",
  "docs/FEATURE-BOARD-TAXONOMY.md",
  "docs/MARKETING-POSITIONING-CONTRACT.md",
  "docs/NAVIGATION-RUNTIME-CONTRACT.md",
  "docs/ADMIN-DEMO-CONTRACT.md",
  "docs/WORK-MOTION-CONTRACT.md",
  "docs/GROK-4.6-COMMAND-CENTER-EXECUTION-PLAN.md",
  "src/lib/revenue-os/README.md",
];
const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing agent contract file: ${file}`);
}

const agentContract = existsSync("AGENTS.md") ? readFileSync("AGENTS.md", "utf8") : "";
const ticketRunbook = existsSync("docs/AGENT-TICKET-RUNBOOK.md")
  ? readFileSync("docs/AGENT-TICKET-RUNBOOK.md", "utf8")
  : "";
const grokExecutionPlan = existsSync("docs/GROK-4.6-COMMAND-CENTER-EXECUTION-PLAN.md")
  ? readFileSync("docs/GROK-4.6-COMMAND-CENTER-EXECUTION-PLAN.md", "utf8")
  : "";

if (!/Production deployment is founder-controlled[\s\S]*Never deploy/i.test(agentContract)) {
  failures.push("AGENTS.md must reserve production deployment authority for an explicit founder instruction");
}
if (!/inspect every repository[\s\S]*worktree and local branch/i.test(agentContract)) {
  failures.push("AGENTS.md must require a repository-wide worktree and branch audit before release");
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

const requiredGrokSections = [
  "## Purpose and authority",
  "## Coordinator preflight",
  "## Mandatory ticket packet",
  "## Architecture law",
  "## Dependency-ordered program",
  "## Optional provider lane",
  "## Verification matrix",
  "## Evidence and worker handoff",
  "## Release gate",
  "## Permanent non-goals",
];
for (const section of requiredGrokSections) {
  if (!grokExecutionPlan.includes(section)) failures.push(`Grok execution plan is missing ${section}`);
}
if (!/not a second roadmap/i.test(grokExecutionPlan)
  || !/durable roadmap is `scripts\/feature-backlog-data\.mjs`/i.test(grokExecutionPlan)
  || !/operational\s+projection is `\/admin\/features`/i.test(grokExecutionPlan)) {
  failures.push("Grok execution plan must preserve the Feature Board as the only roadmap and status authority");
}
if (!/seed:features -- --apply` is coordinator-only/i.test(grokExecutionPlan)) {
  failures.push("Grok execution plan must reserve live manifest reconciliation for the coordinator");
}
if (!/Production release is founder-authorized per named release/i.test(grokExecutionPlan)) {
  failures.push("Grok execution plan must preserve per-release founder deployment authority");
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
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.seed_key)) failures.push(`${prefix} seed key is not stable kebab-case`);
  if (card.description.trim().length < 60) failures.push(`${prefix} description is too thin for independent pickup`);
  if (card.labels.filter((label) => label.startsWith("category:")).length !== 1) failures.push(`${prefix} needs exactly one category label`);
  if (card.labels.filter((label) => label.startsWith("milestone:")).length !== 1) failures.push(`${prefix} needs exactly one milestone label`);
  if (card.labels.filter((label) => /^phase:\d+$/.test(label)).length !== 1) failures.push(`${prefix} needs exactly one phase label`);
  if (card.labels.filter((label) => label.startsWith("capability:")).length < 1 || card.labels.filter((label) => label.startsWith("capability:")).length > 2) failures.push(`${prefix} needs one or two capability labels`);
  if (card.labels.length > 5) failures.push(`${prefix} has label sprawl (${card.labels.length})`);
  const acceptanceItems = card.acceptance_criteria.split("\n").filter((line) => /^-\s+\S/.test(line));
  if (acceptanceItems.length < 2) failures.push(`${prefix} needs at least two observable acceptance items`);
  for (const section of requiredNoteSections) {
    if (!card.notes.includes(section)) failures.push(`${prefix} notes are missing ${section}`);
  }
  if (card.status === "in_progress" && !card.owner?.trim()) failures.push(`${prefix} is in progress without an Owner`);
  if (["in_progress", "shipped"].includes(card.status) && !card.notes.includes("Current implementation evidence:")) {
    failures.push(`${prefix} is ${card.status} without current/remaining implementation evidence`);
  }
  if (card.status === "shipped" && !/verif|pass|production|playwright|evidence/i.test(card.notes)) {
    failures.push(`${prefix} is shipped without verification evidence`);
  }
}

const cardsByKey = new Map(featureBacklog.map((card) => [card.seed_key, card]));
failures.push(...collectFeatureBoardIntegrityFailures(featureBacklog, {
  loopKeys: LOOP_ONE,
  nowKeys: NOW_KEYS,
  secondBrainImplementations: SECOND_BRAIN_IMPLEMENTATIONS,
}));

// The execution guide sequences stable card keys but never owns their mutable
// status. Resolve every `card:<key>` reference against the manifest so a rename
// or missing extension card fails before a lower-context worker is dispatched.
const referencedGrokKeys = [...grokExecutionPlan.matchAll(/`card:([a-z0-9]+(?:-[a-z0-9]+)*)`/g)]
  .map((match) => match[1]);
if (!referencedGrokKeys.length) failures.push("Grok execution plan must reference Feature Board work by stable card:key tokens");
for (const key of new Set(referencedGrokKeys)) {
  if (!cardsByKey.has(key)) failures.push(`Grok execution plan references missing Feature Board key: ${key}`);
}

const grokExtensionKeys = [
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
for (const key of grokExtensionKeys) {
  const card = cardsByKey.get(key);
  if (!card) {
    failures.push(`Grok extension card is missing from the manifest: ${key}`);
    continue;
  }
  if (!referencedGrokKeys.includes(key)) failures.push(`Grok extension card is not sequenced by the execution plan: ${key}`);
}
for (const key of [
  "microsoft-365-workspace-parity",
  "stripe-revenue-reconciliation",
  "slack-notification-approval-surface",
  "notion-knowledge-source",
]) {
  const card = cardsByKey.get(key);
  if (card && !card.labels.includes("milestone:later")) failures.push(`[${key}] optional provider work must remain milestone:later until separately authorized`);
}

// Cloneability ratchet. The Command Center is installed per client from this one
// codebase (see the cloneable-command-center-contract card), so a business fact
// hard-coded under these directories is a bug that only shows up on the second
// installation. Business facts belong in src/config/tenant.ts.
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
    const hits = readFileSync(file, "utf8").split("\n").filter((line) => BRAND_LITERAL.test(line)).length;
    if (hits) brandCounts.set(file, hits);
  }
}
for (const [file, hits] of brandCounts) {
  const budget = BRAND_BUDGET[file] ?? 0;
  if (hits > budget) {
    failures.push(`${file} has ${hits} hard-coded business literal(s) but a budget of ${budget}. Move the value into src/config/tenant.ts, or lower the budget if you removed some.`);
  }
}
for (const [file, budget] of Object.entries(BRAND_BUDGET)) {
  const hits = brandCounts.get(file) ?? 0;
  if (hits < budget) {
    failures.push(`${file} now has ${hits} business literal(s), below its budget of ${budget}. Lower the budget in verify-agent-contract.mjs so the ratchet holds.`);
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
  console.error(`Agent contract failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const statuses = Object.fromEntries(
  [...new Set(featureBacklog.map((card) => card.status))]
    .sort()
    .map((status) => [status, featureBacklog.filter((card) => card.status === status).length]),
);
console.log(JSON.stringify({
  contract: "revenue-os-agent-contract.v1",
  files: requiredFiles.length,
  cards: featureBacklog.length,
  statuses,
  result: "passed",
}, null, 2));
