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
 *
 * The first version read only quoted strings, inside four directories. That
 * missed the two places most copy actually lives: JSX text between tags, and
 * MDX article bodies. Eleven em dashes were sitting in shipped homepage copy,
 * page ledes, article prose, and two outbound email templates while this guard
 * reported a pass. It now reads the rendered text as well as the literals, and
 * it looks everywhere a visitor or a recipient can end up reading.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Copy that a visitor or a recipient can read. */
const COPY_ROOTS = ["src/app", "src/components", "src/content", "src/lib/email", "src/lib/chat"];

/** Route handlers return data, not prose, and their payloads are not copy. */
const SKIP_PATH = /\/api\//;

/**
 * Files that must contain the character in order to ban or rewrite it. Anything
 * added here needs a reason, because the list is how the rule gets hollowed out.
 */
const ALLOWED: Array<{ path: string; why: string }> = [
  {
    path: "src/lib/chat/sanitize.ts",
    why: "defines the rewrite, so it must contain the character it replaces",
  },
  {
    path: "src/lib/revenue-os/auto-responder.ts",
    why: "grounding rule that rejects a generated draft containing one",
  },
  {
    path: "src/lib/chat/system-prompt.ts",
    why: "states the rule to the model, so it must quote the character it bans",
  },
  {
    path: "src/app/admin/contact-imports/page.tsx",
    why: "sample pasted input for the importer, deliberately messy so the parser is shown handling it",
  },
];

/**
 * Every quoted string in a source file, with comments removed first so a
 * commented-out line cannot be mistaken for shipped copy. Deliberately simple:
 * it needs to be obviously correct rather than handle every nesting case, and a
 * missed literal fails open rather than blocking a commit wrongly.
 */
function stringLiterals(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const found: string[] = [];
  for (const pattern of [
    /"((?:[^"\\\n]|\\.)*)"/g,
    /'((?:[^'\\\n]|\\.)*)'/g,
    /`((?:[^`\\]|\\.)*)`/g,
  ]) {
    for (const match of withoutComments.matchAll(pattern)) {
      if (match[1]) found.push(match[1]);
    }
  }
  return found;
}

/**
 * The text a JSX element actually renders, which is where most page copy lives
 * and where every offence this guard originally missed was sitting. Comments go
 * first, braced JSX comments included, so a commented-out line cannot be mistaken
 * for shipped copy. Then take the runs of plain text between tags, skipping
 * anything holding an expression, because `{foo}` is code rather than prose.
 */
function jsxText(source: string): string[] {
  const withoutComments = source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const found: string[] = [];
  for (const match of withoutComments.matchAll(/>([^<>{}]+)</g)) {
    const text = match[1]?.trim();
    if (text) found.push(text);
  }
  return found;
}

/**
 * An MDX file is copy in its entirety once code fences are out. Frontmatter stays
 * in: excerpt, seoTitle, and seoDescription are read by visitors and by search,
 * so the rule applies to them the same as to the body.
 */
function markdownProse(source: string): string[] {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

/**
 * A bare dash standing in for an empty cell is punctuation in a table, not a
 * sentence a person wrote. Admin lists are full of them and flagging those would
 * bury the real offences until someone deleted the guard.
 */
function isEmptyValuePlaceholder(text: string): boolean {
  return /^[—\s]*$/.test(text);
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(tsx?|mdx?|json)$/.test(entry)) found.push(full);
  }
  return found;
}

const offenders: string[] = [];
let inspected = 0;

const seen = new Set<string>();

for (const root of COPY_ROOTS) {
  for (const file of sourceFiles(root)) {
    if (SKIP_PATH.test(file)) continue;
    if (ALLOWED.some((entry) => file === entry.path)) continue;
    if (seen.has(file)) continue;
    seen.add(file);
    inspected += 1;
    const source = readFileSync(file, "utf8");
    // What ships is what renders. An em dash in a code comment is invisible to a
    // visitor, so comments are stripped, but everything a reader can end up with
    // counts: quoted copy, the text between JSX tags, and MDX prose.
    const chunks = /\.mdx?$/.test(file)
      ? markdownProse(source)
      : [...stringLiterals(source), ...jsxText(source)];
    for (const chunk of chunks) {
      if (!chunk.includes("—")) continue;
      if (isEmptyValuePlaceholder(chunk)) continue;
      offenders.push(`${file}: ...${chunk.replace(/\s+/g, " ").slice(0, 110)}...`);
    }
  }
}

assert.ok(
  inspected > 200,
  `only inspected ${inspected} files, so this guard is probably pointed at the wrong place`,
);

if (offenders.length) {
  console.error(
    `House style: found ${offenders.length} em dash(es) in copy. Use a comma, a full stop, or a colon.`,
  );
  for (const offender of offenders) console.error(`- ${offender}`);
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      { filesInspected: inspected, allowlisted: ALLOWED.length, result: "passed" },
      null,
      2,
    ),
  );
}
