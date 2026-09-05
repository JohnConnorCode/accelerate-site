#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { basename, extname } from "node:path";
import { performance } from "node:perf_hooks";
import { textExtensions, secretPatterns } from "./lib/source-safety.mjs";

const started = performance.now();
function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error("Unable to inspect the Git index.");
  return result.stdout;
}

try {
  // Inspect the commit's index, never the unstaged working copy. Do not stash,
  // format, stage, fetch, query the live board, or build inside a commit hook.
  const diff = spawnSync("git", ["diff", "--cached", "--check"], { encoding: "utf8" });
  const failures = [];
  if (diff.error || diff.status !== 0) {
    // git diff --check prints offending source lines, which can contain secrets.
    failures.push("Staged whitespace/conflict errors; inspect git diff --cached --check locally.");
  }
  const files = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
    .split("\0")
    .filter(Boolean);
  for (const file of files) {
    const name = basename(file);
    const label = JSON.stringify(file);
    if (/^\.env(?:\.|$)/.test(name) && name !== ".env.example") {
      failures.push(`Environment file must not be committed: ${label}`);
      continue;
    }
    if (/\.(pem|p12|pfx|key)$/i.test(name)) {
      failures.push(`Key material file must not be committed: ${label}`);
      continue;
    }
    if (!textExtensions.has(extname(file))) continue;
    const value = git(["show", `:${file}`]);
    for (const [kind, pattern] of secretPatterns) {
      if (pattern.test(value)) failures.push(`${kind} pattern in ${label}`);
    }
    if (extname(file) === ".json") {
      try {
        JSON.parse(value);
      } catch {
        failures.push(`Invalid JSON in ${label}`);
      }
    }
  }
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(
    `Commit checks passed: ${files.length} staged files in ${Math.round(performance.now() - started)}ms.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
