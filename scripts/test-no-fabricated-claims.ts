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
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** The guard itself has to quote the constructions it bans. */
const ALLOWED_FILES: string[] = [];

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
const NO_ANTITHESIS_DIRS = [
  "src/content",
  "src/components/sections",
  "src/lib/chat",
  "src/components/home",
];

/**
 * Hard ROI theater. Time and capacity are allowed. Dollar recoveries,
 * recycled first-responder percentages, and invented clients are not.
 */
const NO_ROI_THEATER_DIRS = [
  "src/content",
  "src/components/home",
  "src/components/sections",
  "src/components/v2",
];

const ROI_THEATER_PATTERNS: Array<{ pattern: RegExp; why: string }> = [
  {
    pattern: /78%\s+of\s+(customers|buyers|consumers|personal injury)/i,
    why: "a recycled first-responder percentage",
  },
  { pattern: /\+?38%\s*(more jobs|booked)/i, why: "an unmeasured jobs-booked percentage" },
  { pattern: /Michigan Avenue/i, why: "an invented named client" },
  {
    pattern: /\$\d[\d,]*(?:\+|\/month|\/mo)?[^.!?]{0,40}(recovered|additional) revenue/i,
    why: "dollar ROI presented as typical",
  },
  { pattern: /First-year ROI/i, why: "a headline ROI" },
  { pattern: /\b340%\b/, why: "an invented ROI percentage" },
  { pattern: /value:\s*"\+\$/, why: "fake money on an operations feed" },
  { pattern: /National Association of Realtors reports that 74%/i, why: "a misquoted NAR finding" },
  { pattern: /<StatHighlight\s+value="[^"]*%/, why: "an unsourced percentage StatHighlight" },
  { pattern: /<StatHighlight\s+value="\$/, why: "a dollar StatHighlight" },
];

/**
 * Ordinary negation that the patterns below would otherwise flag. A condition
 * ("if we are not delivering, you leave") and a plain statement of fact
 * ("most prospects are not ready to buy the day they find you") are not the
 * construction being banned. Each entry is a sentence that was reviewed and
 * kept, so the list stays short and is not a place to hide new offences.
 */
const REVIEWED_NEGATIONS = [
  "If we are not delivering, you leave",
  "If we are not delivering results, you can walk",
  "AI is not going away",
  "They are not comparison-shopping",
  "Most prospects are not ready to buy",
  "their quote was not low enough",
  "the phone is not ringing any more than before",
  "that is not you, because you are on a roof",
];

const ANTITHESIS_PATTERNS: Array<{ pattern: RegExp; why: string }> = [
  // "X is not Y. It is Z." The second sentence must itself be a copula, which
  // is what makes this a redefinition rather than an ordinary sequence of
  // events. Without that requirement it flags narration like "They do not leave
  // a voicemail. They hit the back button.", which is fine writing.
  {
    pattern:
      /\b(?:is|are|was|were)\s+n[o']t\b[^.!?]{2,80}[.!?]\s+(?:It|That|They|Its)\s+(?:is|are|was|were)\b/i,
    why: 'a "not X. It is Y." antithesis',
  },
  // Same shape where the second sentence repeats the subject: "The fix is not
  // a chart. The fix is a text message."
  {
    pattern:
      /\bThe\s+(\w+)\s+(?:is|are|was|were)\s+n[o']t\b[^.!?]{2,80}[.!?]\s+The\s+\1\s+(?:is|are|was|were)\b/i,
    why: 'a "The X is not A. The X is B." antithesis',
  },
  // "It's not X, it's Y" inside one sentence.
  {
    pattern:
      /\b(?:is|are|was|were)\s+n[o']t\s+[^.,;!?]{2,60},\s*(?:it|they|that|we|you)\s+(?:is|are|was|were)\b/i,
    why: 'an "it is not X, it is Y" antithesis',
  },
  // Punchy fragment: "Not a template." "Not another platform to learn."
  {
    pattern: /(?:^|[.!?]\s+|\*\*)Not\s+(?:a|an|another|just|only)\b[^.!?]{2,70}[.!?]/,
    why: 'a "Not X." fragment antithesis',
  },
  {
    pattern: /\bnever\s+the\s+(?:missing piece|point|problem|issue|answer)\b/i,
    why: "a strawman dismissal",
  },
];

/** Patterns that assert a measured fact. */
const CLAIM_PATTERNS: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\d+(\.\d+)?\s?%/, why: "a percentage" },
  { pattern: /\$\s?\d/, why: "a dollar figure" },
  { pattern: /\b\d+(\.\d+)?\s?x\b/i, why: "a multiplier" },
  {
    pattern: /\b(?:studies|research|survey|report)s?\s+(?:show|shows|found|suggests?)/i,
    why: "an appeal to unnamed research",
  },
  { pattern: /\baccording to\b/i, why: "a citation" },
  { pattern: /\b(?:on average|industry average|benchmark)\b/i, why: "an unsourced average" },
  { pattern: /\b\d{4}\s+(?:report|study|survey|index)\b/i, why: "a named source document" },
  {
    pattern: /\bFEP\b|Fundraising Effectiveness/i,
    why: "a fabricated source that appeared in an earlier version",
  },
];

/**
 * Numbers that are promises we make, not measurements we claim. A commitment we
 * choose to keep is checkable by the reader; a benchmark is not.
 */
const ALLOWED = [/\b(?:20|30)[- ]minute\b/i, /\bTwenty minutes\b/i];

/** Quoted strings, since only shipped copy matters. */
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

/** Tailwind class strings are full of numbers and are not copy. */
function isCopy(literal: string): boolean {
  if (literal.length < 12) return false;
  // CSS-in-class strings are full of percentages (color-mix, clamp, rgba) and
  // are not prose. Checking for CSS function syntax is far more reliable than
  // trying to enumerate every Tailwind utility.
  if (/(?:var\(--|color-mix\(|rgba?\(|clamp\(|linear-gradient\(|calc\()/.test(literal))
    return false;
  if (/\[&|:!?text-|^\s*(?:absolute|relative|fixed)\s/.test(literal)) return false;
  if (
    /^[a-z0-9:_\[\]()\/,.%\-\s#&]+$/i.test(literal) &&
    /(?:^|\s)(?:flex|grid|text-|bg-|border|mt-|mb-|px-|py-|gap-|absolute|relative|font-|leading-|tracking-|max-w|min-h|inset|object-|aspect-|rounded|hover:|sm:|md:|lg:)/.test(
      literal,
    )
  )
    return false;
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
        failures.push(
          `${file}: contains ${rule.why} in copy we have not measured:\n    "${literal.slice(0, 130)}"`,
        );
      }
    }
  }
}

/** Prose files: markdown is copy in its entirety, TSX only inside literals. */
function copyChunks(file: string, source: string): string[] {
  if (/\.mdx?$/.test(file)) {
    return source
      .replace(/^---[\s\S]*?^---/m, " ") // frontmatter
      .replace(/```[\s\S]*?```/g, " ") // code fences
      .split(/\n{2,}/);
  }
  return stringLiterals(source).filter(isCopy);
}

function walk(dir: string): string[] {
  const found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else if (/\.(tsx?|mdx?)$/.test(entry)) found.push(full);
  }
  return found;
}

let antithesisScanned = 0;
for (const dir of NO_ANTITHESIS_DIRS) {
  for (const file of walk(dir)) {
    if (ALLOWED_FILES.includes(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const chunk of copyChunks(file, source)) {
      antithesisScanned += 1;
      if (REVIEWED_NEGATIONS.some((kept) => chunk.includes(kept))) continue;
      for (const rule of ANTITHESIS_PATTERNS) {
        const match = rule.pattern.exec(chunk);
        if (match) {
          failures.push(
            `${file}: uses ${rule.why}. State the point directly:\n    "${match[0].trim().slice(0, 140)}"`,
          );
        }
      }
    }
  }
}

let roiScanned = 0;
for (const dir of NO_ROI_THEATER_DIRS) {
  for (const file of walk(dir)) {
    if (ALLOWED_FILES.includes(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const chunk of copyChunks(file, source)) {
      roiScanned += 1;
      for (const rule of ROI_THEATER_PATTERNS) {
        const match = rule.pattern.exec(chunk);
        if (match) {
          failures.push(`${file}: uses ${rule.why}:\n    "${match[0].trim().slice(0, 140)}"`);
        }
      }
    }
  }
}

assert.ok(
  inspected > 10,
  `only inspected ${inspected} copy strings, so this guard is probably not looking at the right thing`,
);

if (failures.length) {
  console.error(`Fabricated-claim guard failed with ${failures.length} issue(s).`);
  console.error(
    "These pages carry no measured books, so they carry no dollar ROI, no invented clients, and they state points directly rather than by contrast.\n",
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        statisticsGuarded: NO_STATISTICS.length,
        antithesisChunksScanned: antithesisScanned,
        roiChunksScanned: roiScanned,
        copyStringsInspected: inspected,
        result: "passed",
      },
      null,
      2,
    ),
  );
}
