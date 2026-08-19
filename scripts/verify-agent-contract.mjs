import { existsSync, readFileSync } from "node:fs";
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
