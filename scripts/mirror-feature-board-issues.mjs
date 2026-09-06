#!/usr/bin/env node
/**
 * Mirrors a curated, actionable subset of the Feature Board manifest into
 * GitHub Issues, so an outside contributor has somewhere to start beyond
 * reading a 4000-line data file. The manifest (scripts/feature-backlog-data.mjs)
 * stays canonical; this only projects a slice of it outward. Re-running is
 * safe: an issue already carrying the seed_key marker is skipped, never
 * duplicated or overwritten.
 *
 * "Actionable" here means: not shipped or archived, and every declared
 * dependency title resolves to a card that IS shipped — i.e. nothing is
 * blocking it, so a contributor could genuinely pick it up today.
 *
 * Requires the `gh` CLI, authenticated against a repo with issues enabled.
 * Defaults to a dry run; pass --apply to actually create issues.
 */
import { execFileSync } from "node:child_process";
import { featureBacklog } from "./feature-backlog-data.mjs";
import { parseDependencyTitles } from "./lib/feature-board-graph.mjs";

const REPO = "JohnConnorCode/accelerate-site";
const MARKER_PREFIX = "<!-- feature-board-seed-key: ";
const apply = process.argv.includes("--apply");

const byTitle = new Map(featureBacklog.map((card) => [card.title, card]));

function isActionable(card) {
  if (card.status !== "backlog" && card.status !== "planned") return false;
  if (card.archived_at) return false;
  const deps = parseDependencyTitles(card);
  return deps.every((title) => byTitle.get(title)?.status === "shipped");
}

function issueBody(card) {
  const lines = [
    card.description,
    "",
    "**Acceptance criteria**",
    card.acceptance_criteria,
    "",
    `Full context, guardrails, and required verification: [scripts/feature-backlog-data.mjs](https://github.com/${REPO}/blob/main/scripts/feature-backlog-data.mjs), key \`${card.seed_key}\`. Read [AGENTS.md](https://github.com/${REPO}/blob/main/AGENTS.md) and [CONTRIBUTING.md](https://github.com/${REPO}/blob/main/CONTRIBUTING.md) before starting.`,
    "",
    `${MARKER_PREFIX}${card.seed_key} -->`,
  ];
  return lines.join("\n");
}

function existingIssueSeedKeys() {
  const raw = execFileSync(
    "gh",
    ["issue", "list", "--repo", REPO, "--state", "all", "--limit", "500", "--json", "body"],
    { encoding: "utf8" },
  );
  const issues = JSON.parse(raw);
  const keys = new Set();
  for (const issue of issues) {
    const match = issue.body?.match(/<!-- feature-board-seed-key: (\S+) -->/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

const actionable = featureBacklog.filter(isActionable);
const alreadyMirrored = apply ? existingIssueSeedKeys() : new Set();
const toCreate = actionable.filter((card) => !alreadyMirrored.has(card.seed_key));

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      actionableCards: actionable.length,
      alreadyMirrored: alreadyMirrored.size,
      toCreate: toCreate.map((card) => card.seed_key),
    },
    null,
    2,
  ),
);

if (!apply) {
  console.log("Run with --apply to actually create these issues on GitHub.");
  process.exit(0);
}

for (const card of toCreate) {
  const labels = ["help wanted", "enhancement"];
  execFileSync(
    "gh",
    [
      "issue",
      "create",
      "--repo",
      REPO,
      "--title",
      card.title,
      "--body",
      issueBody(card),
      "--label",
      labels.join(","),
    ],
    { encoding: "utf8", stdio: "inherit" },
  );
  console.log(`Created issue for ${card.seed_key}`);
}
