#!/usr/bin/env tsx
/**
 * Guards the two ways an admin notification silently fails to be created.
 *
 * Both have already happened in this codebase:
 *   - `message:` was written instead of `description:` in the Calendly webhook
 *     and the roofing qualifier. PostgREST rejects unknown columns, so a real
 *     booking landed and told nobody. The Calendly failures were discarded
 *     inside a Promise.all, so there was not even a log line.
 *   - `priority` accepts only urgent/important/info. Anything else violates the
 *     CHECK constraint and the insert is rejected.
 *
 * A notification that fails to insert is invisible by construction: the operator
 * is not told, and the thing that was supposed to tell them is what broke. So
 * this is a source-level contract test rather than a runtime one.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Columns that actually exist, from supabase/migration-prompt5.sql plus the priority ALTER. */
const COLUMNS = new Set(["id", "type", "title", "description", "link", "read", "created_at", "priority"]);
const PRIORITIES = new Set(["urgent", "important", "info"]);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

/** Extract the object literal following each admin_notifications insert. */
function insertBlocks(source: string): string[] {
  const blocks: string[] = [];
  const marker = /from\(["']admin_notifications["']\)\s*\.insert\(\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(source))) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < source.length && depth > 0) {
      const char = source[index];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      index += 1;
    }
    blocks.push(source.slice(start, index - 1));
  }
  return blocks;
}

/** Top-level `key:` names, ignoring anything nested inside a template expression. */
function topLevelKeys(block: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    const match = depth === 0 ? /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(trimmed) : null;
    if (match?.[1]) keys.push(match[1]);
    for (const char of line) {
      if (char === "{" || char === "(" || char === "[") depth += 1;
      if (char === "}" || char === ")" || char === "]") depth -= 1;
    }
  }
  return keys;
}

const failures: string[] = [];
let inspected = 0;

for (const file of sourceFiles("src")) {
  const source = readFileSync(file, "utf8");
  if (!source.includes("admin_notifications")) continue;
  for (const block of insertBlocks(source)) {
    inspected += 1;
    for (const key of topLevelKeys(block)) {
      if (!COLUMNS.has(key)) {
        failures.push(`${file}: writes "${key}", which is not a column on admin_notifications (did you mean description?)`);
      }
    }
    // Priority is often a ternary, so check every literal in the expression
    // rather than only a value sitting immediately after the colon.
    for (const assignment of block.matchAll(/priority:\s*([^\n]+)/g)) {
      for (const literal of (assignment[1] ?? "").matchAll(/["']([a-z_]+)["']/g)) {
        if (literal[1] && !PRIORITIES.has(literal[1])) {
          failures.push(`${file}: priority "${literal[1]}" violates the CHECK constraint (allowed: ${[...PRIORITIES].join(", ")})`);
        }
      }
    }
  }
}

assert.ok(inspected > 0, "found no admin_notifications insert sites, so this guard is not actually checking anything");

if (failures.length) {
  console.error(`Notification contract failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ insertSites: inspected, columns: COLUMNS.size, result: "passed" }, null, 2));
}
