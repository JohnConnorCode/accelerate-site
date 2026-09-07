#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const required = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "README.md",
  "docs/contributing/NATURAL-LANGUAGE-AGENT.md",
  "docs/contributing/DEVELOPER-START.md",
  "docs/contributing/AGENT-TICKET-RUNBOOK.md",
  "docs/contributing/PROGRAM-WAVES.md",
  "docs/contributing/VERIFICATION-WORKFLOW.md",
  "docs/contributing/WORKSHELTER-REUSE-CONTRACT.md",
  "docs/contracts/UNIVERSAL-WORK-BOARD.md",
  "docs/self-hosting/REVENUE-OS-SETUP.md",
  "src/content/docs/extend/first-change.mdx",
];
const failures = [];
for (const file of required) {
  if (!existsSync(file)) {
    failures.push(`${file} is missing`);
    continue;
  }
  const source = readFileSync(file, "utf8");
  if (
    !/pick up(?: work)?(?: from)?(?: the)? backlog|pick up the named card|take the next task|continue the board/i.test(
      source,
    )
  )
    failures.push(`${file} does not describe the natural-language backlog trigger`);
  if (!/agent:go|internal pickup\s+runner|natural-language pickup\s+runner/i.test(source))
    failures.push(`${file} does not identify the internal pickup runner`);
  if (!/commit(?:ted)?|evidence submission|evidence/i.test(source))
    failures.push(`${file} does not describe the commit/evidence completion boundary`);
}
const agents = readFileSync("AGENTS.md", "utf8");
if (!/agent-execution-trigger:/i.test(agents))
  failures.push("AGENTS.md is missing the machine-readable trigger block");
if (!/terminal_states: \[HANDOFF_SUBMITTED, BLOCKED_REQUIRES_OPERATOR\]/i.test(agents))
  failures.push("AGENTS.md is missing terminal states for unattended execution");
for (const file of ["AGENTS.md", "CLAUDE.md", "docs/contributing/NATURAL-LANGUAGE-AGENT.md"]) {
  const source = readFileSync(file, "utf8");
  if (!/Never ask the user to paste/i.test(source))
    failures.push(`${file} does not prohibit interactive credential requests`);
}
if (failures.length) {
  console.error(
    `Agent entrypoint contract failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Agent entrypoints verified: ${required.length} Markdown/MDX surfaces carry the natural-language pickup contract.`,
);
