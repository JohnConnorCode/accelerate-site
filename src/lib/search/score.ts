import type { SearchEntry, SearchGroup } from "./index";

/**
 * Ranking for site search.
 *
 * Pure and dependency-free so it runs identically on the server and in the
 * browser, and so it can be tested without a DOM or a database.
 *
 * The design goal is that the obvious query returns the obvious answer first:
 * typing "nonprofit" must surface the nonprofits page above an article that
 * merely mentions nonprofits, and typing "pricing" must surface Packages even
 * though the word does not appear in its title.
 */

/** A match on the title is worth more than a match anywhere else. */
const WEIGHTS = {
  titleExact: 1000,
  titlePrefix: 450,
  titleWord: 400,
  titleContains: 220,
  keywordExact: 300,
  keywordContains: 120,
  descriptionContains: 60,
} as const;

/** Breaks ties so results never reorder unpredictably between keystrokes. */
const GROUP_PRIORITY: Record<SearchGroup, number> = {
  Pages: 7,
  Docs: 6,
  Industries: 5,
  Services: 4,
  Work: 3,
  Packages: 2,
  Articles: 1,
  Changelog: 0,
};

export function normalize(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      // Strip accents so "cafe" finds "café".
      .replace(/[̀-ͯ]/g, "")
      // Hyphens and slashes become spaces so "follow-up" and "follow up" agree.
      .replace(/[-/_]+/g, " ")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Words carried by almost every entry, so matching on them is noise that swamps
 * the real signal. "book a call" ranked a changelog headline above the contact
 * page purely because "a" scored a word-boundary hit on both.
 *
 * Dropped only when something is left over: a search for "the" should still
 * search for "the" rather than silently returning everything.
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "and",
  "to",
  "in",
  "on",
  "at",
  "is",
  "it",
  "my",
  "our",
  "your",
  "with",
]);

export function queryTerms(query: string): string[] {
  const all = normalize(query).split(" ").filter(Boolean);
  const meaningful = all.filter((term) => term.length > 1 && !STOPWORDS.has(term));
  return meaningful.length ? meaningful : all;
}

function scoreField(
  haystack: string,
  term: string,
  weights: { exact: number; prefix?: number; word?: number; contains: number },
): number {
  if (!haystack) return 0;
  if (haystack === term) return weights.exact;
  if (weights.prefix && haystack.startsWith(term)) return weights.prefix;
  if (
    weights.word &&
    new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(haystack)
  )
    return weights.word;
  if (haystack.includes(term)) return weights.contains;
  return 0;
}

export interface ScoredEntry {
  entry: SearchEntry;
  score: number;
}

/**
 * Score one entry against the already-normalized query terms.
 *
 * Every term must match something, so "ai nonprofit" does not return every page
 * containing "ai". That is what makes a multi-word query narrow rather than
 * widen, which is what people expect and rarely get.
 */
export function scoreEntry(entry: SearchEntry, terms: string[]): number {
  const title = normalize(entry.title);
  const description = normalize(entry.description);
  const keywords = entry.keywords.map(normalize);
  const content = normalize(entry.content ?? "");

  let total = 0;
  let bodyMatch = false;
  for (const term of terms) {
    let best = scoreField(title, term, {
      exact: WEIGHTS.titleExact,
      prefix: WEIGHTS.titlePrefix,
      word: WEIGHTS.titleWord,
      contains: WEIGHTS.titleContains,
    });

    for (const keyword of keywords) {
      best = Math.max(
        best,
        scoreField(keyword, term, {
          exact: WEIGHTS.keywordExact,
          contains: WEIGHTS.keywordContains,
        }),
      );
    }

    if (!best && description.includes(term)) best = WEIGHTS.descriptionContains;

    if (!best && content.includes(term)) {
      best = 20;
      bodyMatch = true;
    }

    // A term that matches nothing disqualifies the entry entirely.
    if (!best) return 0;
    total += best;
  }

  // A body mention must not outrank a result matching every term in its metadata.
  if (bodyMatch) total *= 0.5;

  // Shorter titles win ties: "Nonprofits" should beat "AI for nonprofits and
  // membership organisations" when both match equally well.
  total += Math.max(0, 40 - title.length);
  total += GROUP_PRIORITY[entry.group] * 10;
  return total;
}

export function searchEntries(entries: SearchEntry[], query: string, limit = 24): SearchEntry[] {
  const terms = queryTerms(query);
  if (!terms.length) return [];

  const identifier = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/i.test(query.trim())
    ? query.trim().toLowerCase()
    : null;
  const scored: ScoredEntry[] = [];
  for (const entry of entries) {
    if (
      identifier &&
      ![entry.title, entry.description, entry.content ?? "", ...entry.keywords].some((field) =>
        field.toLowerCase().includes(identifier),
      )
    )
      continue;
    const score = scoreEntry(entry, terms);
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Deterministic beyond score, so results do not shuffle on rerender.
    if (a.entry.date && b.entry.date && a.entry.date !== b.entry.date)
      return b.entry.date.localeCompare(a.entry.date);
    return a.entry.title.localeCompare(b.entry.title);
  });

  return scored.slice(0, limit).map((item) => item.entry);
}

/** Split a string around a match so the UI can highlight without dangerouslySetInnerHTML. */
export function highlight(text: string, query: string): Array<{ text: string; match: boolean }> {
  const terms = queryTerms(query);
  if (!terms.length) return [{ text, match: false }];

  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  return parts.filter(Boolean).map((part) => ({
    text: part,
    match:
      pattern.test(part) &&
      normalize(part).length > 0 &&
      terms.some((term) => normalize(part) === term),
  }));
}
