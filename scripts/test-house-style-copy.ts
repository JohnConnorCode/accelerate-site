#!/usr/bin/env tsx
/**
 * No em dash is a hard house rule, and it applies to written copy as much as to
 * anything a model generates.
 *
 * The streaming filter in `src/lib/chat/sanitize.ts` covers the assistant. This
 * covers everything a person writes: page copy, content data, article
 * frontmatter and body, email templates. Two had already reached the published
 * changelog, which is a public page, so a one-time cleanup would have decayed
 * within a week without this.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Copy that a visitor or a recipient can read. */
const COPY_ROOTS = ["src/content", "src/components/sections", "src/lib/email", "src/lib/chat"];

/**
 * Files that must contain the character in order to ban or rewrite it. Anything
 * added here needs a reason, because the list is how the rule gets hollowed out.
 */
const ALLOWED: Array<{ path: string; why: string }> = [
  { path: "src/lib/chat/sanitize.ts", why: "defines the rewrite, so it must contain the character it replaces" },
  { path: "src/lib/revenue-os/auto-responder.ts", why: "grounding rule that rejects a generated draft containing one" },
  { path: "src/lib/chat/system-prompt.ts", why: "states the rule to the model, so it must quote the character it bans" },
];

/**
 * Every quoted string in a source file, with comments removed first so a
 * commented-out line cannot be mistaken for shipped copy. Deliberately simple:
 * it needs to be obviously correct rather than handle every nesting case, and a
 * missed literal fails open rather than blocking a commit wrongly.
 */
function stringLiterals(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const found: string[] = [];
  for (const pattern of [/"((?:[^"\\\n]|\\.)*)"/g, /'((?:[^'\\\n]|\\.)*)'/g, /`((?:[^`\\]|\\.)*)`/g]) {
    for (const match of withoutComments.matchAll(pattern)) {
      if (match[1]) found.push(match[1]);
    }
  }
  return found;
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return found; }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(tsx?|mdx?|json)$/.test(entry)) found.push(full);
  }
  return found;
}

const offenders: string[] = [];
let inspected = 0;

for (const root of COPY_ROOTS) {
  for (const file of sourceFiles(root)) {
    if (ALLOWED.some((entry) => file === entry.path)) continue;
    inspected += 1;
    const source = readFileSync(file, "utf8");
    // Only string literals count. An em dash in a code comment is invisible to
    // a visitor, and flagging those would bury the real offences in noise until
    // someone deleted the guard. What ships is what is quoted.
    for (const literal of stringLiterals(source)) {
      if (!literal.includes("—")) continue;
      offenders.push(`${file}: ...${literal.replace(/\s+/g, " ").slice(0, 110)}...`);
    }
  }
}

assert.ok(inspected > 20, `only inspected ${inspected} files, so this guard is probably pointed at the wrong place`);

if (offenders.length) {
  console.error(`House style: found ${offenders.length} em dash(es) in copy. Use a comma, a full stop, or a colon.`);
  for (const offender of offenders) console.error(`- ${offender}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ filesInspected: inspected, allowlisted: ALLOWED.length, result: "passed" }, null, 2));
}
