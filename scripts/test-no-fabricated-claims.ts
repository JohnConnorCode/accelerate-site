#!/usr/bin/env tsx
/**
 * Guards against inventing evidence in marketing copy.
 *
 * The nonprofit landing page shipped with four sourced-looking figures, a
 * hundred-dot donor cohort chart, and a set of response timings. Every one was
 * fabricated, including the names of the sources they were attributed to. None
 * of it was measured and none of it could be.
 *
 * This is worse than a normal bug. A wrong number that looks researched is
 * read as researched, it gets repeated in a pitch, and the first person who
 * checks it stops believing anything else on the page. So the rule for pages
 * with no measured data is simply that they carry no statistics at all, and the
 * rule is enforced rather than remembered.
 *
 * The allowlist is for numbers that are commitments we control rather than
 * claims about the world: the length of a call is a promise, not a measurement.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Files that must contain no statistic of any kind. */
const NO_STATISTICS = ["src/components/sections/NonprofitLanding.tsx"];

/**
 * Files that must contain no "not X, it's Y" antithesis.
 *
 * The construction tells the reader what they are or what they think before it
 * makes its point, and it fakes insight by setting up a strawman to knock down.
 * It had become a reflex across the whole page: "You are not short on people
 * who care. You are short on hours.", "The mission is not the hard part.",
 * "Not another platform to learn.", "The donor does not decide to leave."
 *
 * Say the true thing and let it stand.
 */
const NO_ANTITHESIS = ["src/components/sections/NonprofitLanding.tsx"];

const ANTITHESIS_PATTERNS: Array<{ pattern: RegExp; why: string }> = [
  // "X is not Y. It is Z." across a sentence boundary.
  { pattern: /\b(?:is|are|was|were|do|does|did)\s+n[o']t\b[^.!?]{2,70}[.!?]\s+(?:It|That|They|The|We|You|Its)\b/i, why: 'a "not X. Y." antithesis' },
  // "It's not X, it's Y" in one sentence.
  { pattern: /\b(?:is|are|was|were)\s+n[o']t\s+[^.,;!?]{2,60},\s*(?:it|they|that|we|you)\s+(?:is|are|was|were)\b/i, why: 'an "it is not X, it is Y" antithesis' },
  // A fragment opening: "Not another platform. An operations team."
  { pattern: /(?:^|[.!?]\s+)Not\s+(?:a|an|another|just|only)\b[^.!?]{2,70}[.!?]/, why: 'a "Not X. Y." fragment antithesis' },
  { pattern: /\bnever\s+the\s+(?:missing piece|point|problem|issue)\b/i, why: "a strawman dismissal" },
];

/** Patterns that assert a measured fact. */
const CLAIM_PATTERNS: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\d+(\.\d+)?\s?%/, why: "a percentage" },
  { pattern: /\$\s?\d/, why: "a dollar figure" },
  { pattern: /\b\d+(\.\d+)?\s?x\b/i, why: "a multiplier" },
  { pattern: /\b(?:studies|research|survey|report)s?\s+(?:show|shows|found|suggests?)/i, why: "an appeal to unnamed research" },
  { pattern: /\baccording to\b/i, why: "a citation" },
  { pattern: /\b(?:on average|industry average|benchmark)\b/i, why: "an unsourced average" },
  { pattern: /\b\d{4}\s+(?:report|study|survey|index)\b/i, why: "a named source document" },
  { pattern: /\bFEP\b|Fundraising Effectiveness/i, why: "a fabricated source that appeared in an earlier version" },
];

/**
 * Numbers that are promises we make, not measurements we claim. A commitment we
 * choose to keep is checkable by the reader; a benchmark is not.
 */
const ALLOWED = [
  /\b(?:20|30)[- ]minute\b/i,
  /\bTwenty minutes\b/i,
];

/** Quoted strings, since only shipped copy matters. */
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

/** Tailwind class strings are full of numbers and are not copy. */
function isCopy(literal: string): boolean {
  if (literal.length < 12) return false;
  // CSS-in-class strings are full of percentages (color-mix, clamp, rgba) and
  // are not prose. Checking for CSS function syntax is far more reliable than
  // trying to enumerate every Tailwind utility.
  if (/(?:var\(--|color-mix\(|rgba?\(|clamp\(|linear-gradient\(|calc\()/.test(literal)) return false;
  if (/\[&|:!?text-|^\s*(?:absolute|relative|fixed)\s/.test(literal)) return false;
  if (/^[a-z0-9:_\[\]()\/,.%\-\s#&]+$/i.test(literal) && /(?:^|\s)(?:flex|grid|text-|bg-|border|mt-|mb-|px-|py-|gap-|absolute|relative|font-|leading-|tracking-|max-w|min-h|inset|object-|aspect-|rounded|hover:|sm:|md:|lg:)/.test(literal)) return false;
  if (literal.startsWith("/") || literal.startsWith("http")) return false;
  return /\s/.test(literal);
}

const failures: string[] = [];
let inspected = 0;

for (const file of NO_STATISTICS) {
  const source = readFileSync(file, "utf8");
  for (const literal of stringLiterals(source)) {
    if (!isCopy(literal)) continue;
    inspected += 1;
    if (ALLOWED.some((allowed) => allowed.test(literal))) continue;
    for (const rule of CLAIM_PATTERNS) {
      if (rule.pattern.test(literal)) {
        failures.push(`${file}: contains ${rule.why} in copy we have not measured:\n    "${literal.slice(0, 130)}"`);
      }
    }
  }
}

for (const file of NO_ANTITHESIS) {
  const source = readFileSync(file, "utf8");
  for (const literal of stringLiterals(source)) {
    if (!isCopy(literal)) continue;
    for (const rule of ANTITHESIS_PATTERNS) {
      if (rule.pattern.test(literal)) {
        failures.push(`${file}: uses ${rule.why}. State the point directly:\n    "${literal.slice(0, 130)}"`);
      }
    }
  }
}

assert.ok(inspected > 10, `only inspected ${inspected} copy strings, so this guard is probably not looking at the right thing`);

if (failures.length) {
  console.error(`Fabricated-claim guard failed with ${failures.length} issue(s).`);
  console.error("These pages carry no measured data, so they carry no statistics, and they state points directly rather than by contrast.\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ statisticsGuarded: NO_STATISTICS.length, antithesisGuarded: NO_ANTITHESIS.length, copyStringsInspected: inspected, result: "passed" }, null, 2));
}
