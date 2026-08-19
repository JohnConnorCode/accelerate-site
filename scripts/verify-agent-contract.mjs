import { existsSync, readFileSync, readdirSync } from "node:fs";
import { featureBacklog, validateFeatureBacklog } from "./feature-backlog-data.mjs";

const requiredFiles = [
  "AGENTS.md",
  "../AGENTS.md",
  "docs/AGENT-TICKET-RUNBOOK.md",
  "docs/REVENUE-OS-ENGINEERING-CONTRACT.md",
  "docs/REVENUE-OS-SETUP.md",
  "src/lib/revenue-os/README.md",
];
const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing agent contract file: ${file}`);
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
  if (!card.labels.includes("agent-ready")) failures.push(`${prefix} is missing the agent-ready label`);
  if (!card.labels.some((label) => /^phase-\d+$/.test(label))) failures.push(`${prefix} is missing a phase label`);
  if (card.labels.length < 4) failures.push(`${prefix} is missing workstream taxonomy`);
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

// Dependencies are declared as card titles and flattened into the notes block by
// card(). Nothing previously checked that those strings resolve, so renaming a
// title silently broke the dependency graph. Parse them back and require a match.
const NO_DEPENDENCY_SENTINEL = "None —";
const cardTitles = new Set(featureBacklog.map((card) => card.title));

for (const card of featureBacklog) {
  const line = card.notes
    .split("\n\n")
    .find((section) => section.startsWith("Dependencies: "));
  if (!line) continue;
  const declared = line.slice("Dependencies: ".length).trim();
  if (declared.startsWith(NO_DEPENDENCY_SENTINEL)) continue;
  for (const dependency of declared.split(";").map((item) => item.trim()).filter(Boolean)) {
    if (!cardTitles.has(dependency)) {
      failures.push(`[${card.seed_key}] depends on "${dependency}", which matches no card title`);
    }
  }
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
const BRAND_SCOPE = ["src/lib", "src/app/admin", "src/app/api/admin"];
const BRAND_BUDGET = {
  "src/app/admin/campaigns/page.tsx": 1,
  "src/app/admin/chat-leads/page.tsx": 2,
  "src/app/admin/layout.tsx": 3,
  "src/app/admin/login/page.tsx": 4,
  "src/app/admin/setup/page.tsx": 7,
  "src/app/admin/update-password/page.tsx": 1,
  "src/app/api/admin/ai-content-brief/route.ts": 1,
  "src/app/api/admin/ai-insights/route.ts": 1,
  "src/app/api/admin/password-reset/route.ts": 1,
  "src/app/api/admin/proposals/generate/route.ts": 1,
  "src/lib/ai/openrouter.ts": 2,
  "src/lib/ai/prompts.ts": 1,
  "src/lib/chat/guardrails.ts": 1,
  "src/lib/chat/lead-capture.ts": 4,
  "src/lib/chat/system-prompt.ts": 3,
  "src/lib/email/registry.ts": 4,
  "src/lib/og.ts": 3,
  "src/lib/seo.ts": 1,
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
