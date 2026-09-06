#!/usr/bin/env tsx
/**
 * The /open-source page's stats block (src/content/open-source.ts) claims
 * concrete numbers, not adjectives, and its own comment says to recompute
 * them before changing anything. Nothing did, so two of the four drifted
 * silently (checks 101 -> 118, source files 534 -> 541) before this existed.
 * Fails the build the moment the codebase moves and the page doesn't.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { OPEN_SOURCE_STATS } from "../src/content/open-source";
import { MIGRATION_MANIFEST } from "./lib/migration-manifest.mjs";

function gitFiles(pattern: string): string[] {
  return execFileSync("git", ["ls-files", pattern], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

const statByLabel = new Map(OPEN_SOURCE_STATS.map((stat) => [stat.label, stat.value]));

function expectStat(label: string, expected: string) {
  const actual = statByLabel.get(label);
  assert.ok(actual, `src/content/open-source.ts is missing an OPEN_SOURCE_STATS entry: ${label}`);
  assert.equal(
    actual,
    expected,
    `OPEN_SOURCE_STATS "${label}" says ${actual}, but the repo now has ${expected}. Update src/content/open-source.ts.`,
  );
}

expectStat("Ordered migrations", String(MIGRATION_MANIFEST.length));

const checkScripts = Object.keys(JSON.parse(readFileSync("package.json", "utf8")).scripts).filter(
  (name) => name.startsWith("test:") || name.startsWith("verify:") || name.startsWith("qa:"),
);
expectStat("Automated checks", String(checkScripts.length));

const sourceFiles = gitFiles("src/**/*.ts").concat(gitFiles("src/**/*.tsx"));
const totalLines = sourceFiles.reduce(
  (sum, file) => sum + readFileSync(file, "utf8").split("\n").length,
  0,
);
const roundedThousands = Math.round(totalLines / 1000);
expectStat("Lines of TypeScript", `${roundedThousands}K`);
const linesOfTypeScriptStat = OPEN_SOURCE_STATS.find(
  (stat) => stat.label === "Lines of TypeScript",
);
assert.ok(
  linesOfTypeScriptStat?.detail.includes(String(sourceFiles.length)),
  `OPEN_SOURCE_STATS "Lines of TypeScript" detail says a different file count than the actual ${sourceFiles.length}. Update src/content/open-source.ts.`,
);

console.log(
  JSON.stringify(
    {
      migrations: MIGRATION_MANIFEST.length,
      checks: checkScripts.length,
      sourceFiles: sourceFiles.length,
      totalLines,
      result: "passed",
    },
    null,
    2,
  ),
);
