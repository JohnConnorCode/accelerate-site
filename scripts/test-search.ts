#!/usr/bin/env tsx
/**
 * Search is only useful if the obvious query returns the obvious answer first.
 *
 * This runs against the real index, not fixtures, so it also catches the case
 * that started it: a page that exists and is reachable from nowhere. The
 * nonprofits page was live for a day while the header, footer, and sitemap each
 * carried a hand-written list that nobody extended.
 */
import assert from "node:assert/strict";
import { buildSearchIndex } from "../src/lib/search";
import { normalize, searchEntries } from "../src/lib/search/score";

const index = buildSearchIndex();

function top(query: string, count = 5) {
  return searchEntries(index, query, count).map((entry) => entry.title);
}

function firstHref(query: string): string | undefined {
  return searchEntries(index, query, 1)[0]?.href;
}

async function main() {
  assert.ok(
    index.length > 20,
    `index has only ${index.length} entries, so it is probably not being built`,
  );

  const docs = index.filter((entry) => entry.group === "Docs");
  assert.ok(
    searchEntries(docs, "RFC threading", 5).some(
      (entry) => entry.href === "/docs/conversations/reply",
    ),
    "Guide body terminology must be searchable",
  );
  assert.ok(
    searchEntries(docs, "propose_send_email", 5).some(
      (entry) => entry.href === "/docs/intelligence/tools",
    ),
    "Generated tool names must be searchable",
  );
  assert.equal(searchEntries(docs, "Your first workflow", 1)[0]?.href, "/docs/start/daily-path");
  assert.equal(searchEntries(docs, "zxq_nonexistent_reference", 5).length, 0);

  // ---- Every industry is findable by its own name ------------------------

  const industries = index.filter((entry) => entry.group === "Industries");
  assert.ok(
    industries.length >= 10,
    `expected every vertical in the index, got ${industries.length}`,
  );
  for (const industry of industries) {
    const results = searchEntries(index, industry.title, 3);
    assert.equal(
      results[0]?.href,
      industry.href,
      `searching "${industry.title}" must return its own page first, got ${results[0]?.title ?? "nothing"}`,
    );
  }

  // The page this whole thing started with.
  assert.equal(
    firstHref("nonprofit"),
    "/industries/nonprofits",
    `"nonprofit" must find the nonprofits page, got ${top("nonprofit").join(", ")}`,
  );
  assert.equal(firstHref("nonprofits"), "/industries/nonprofits");
  assert.equal(
    firstHref("non profit"),
    "/industries/nonprofits",
    "the two-word spelling must work too",
  );

  // ---- Intent words that do not appear in any title ----------------------

  // Nobody searches "Packages"; they search "pricing".
  assert.equal(
    firstHref("pricing"),
    "/packages",
    `"pricing" must reach packages, got ${top("pricing").join(", ")}`,
  );
  assert.equal(
    firstHref("how much"),
    "/packages",
    `"how much" must reach packages, got ${top("how much").join(", ")}`,
  );
  assert.equal(
    firstHref("book a call"),
    "/contact",
    `"book a call" must reach contact, got ${top("book a call").join(", ")}`,
  );
  assert.equal(
    firstHref("demo"),
    "/demo/command-center",
    `"demo" must reach the full Command Center launcher, got ${top("demo").join(", ")}`,
  );
  assert.equal(
    firstHref("blog"),
    "/learn",
    `"blog" must reach the article library, got ${top("blog").join(", ")}`,
  );

  // ---- Multi-word queries narrow rather than widen -----------------------

  const broad = searchEntries(index, "ai", 100).length;
  const narrow = searchEntries(index, "ai nonprofit", 100).length;
  assert.ok(
    narrow < broad,
    `adding a term must narrow the result set: "ai" gave ${broad}, "ai nonprofit" gave ${narrow}`,
  );
  assert.ok(narrow > 0, "a reasonable two-word query must still return something");

  // A term matching nothing disqualifies the entry, so a nonsense pairing is
  // empty rather than returning everything that matched the first word.
  assert.equal(
    searchEntries(index, "nonprofit zzzzqqq", 10).length,
    0,
    "an unmatched term must disqualify the entry entirely",
  );

  // ---- Nothing matches, and that is a real answer ------------------------

  assert.deepEqual(
    searchEntries(index, "zzzzqqqxyz", 10),
    [],
    "a query matching nothing must return nothing rather than noise",
  );
  assert.deepEqual(searchEntries(index, "   ", 10), [], "whitespace is not a query");
  assert.deepEqual(searchEntries(index, "", 10), []);

  // ---- Ordering is deterministic ----------------------------------------

  // Results must not shuffle between keystrokes that produce the same query.
  for (const query of ["ai", "automation", "follow up", "law"]) {
    assert.deepEqual(
      top(query, 8),
      top(query, 8),
      `"${query}" must rank identically on repeat evaluation`,
    );
  }

  // ---- Every entry can actually be opened --------------------------------

  for (const entry of index) {
    assert.ok(entry.href.startsWith("/"), `${entry.title} has a non-relative href: ${entry.href}`);
    assert.ok(entry.title.trim(), `an entry has no title: ${entry.id}`);
    assert.ok(!entry.href.includes("undefined"), `${entry.title} has a broken href: ${entry.href}`);
  }

  const ids = index.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate entry ids would make React keys collide");

  // Case study detail pages redirect to the homepage, so indexing them would
  // send people somewhere they did not ask for.
  assert.equal(
    index.filter((entry) => entry.href.startsWith("/results/")).length,
    0,
    "no entry may point at a redirecting results detail page",
  );
  assert.equal(
    index.some((entry) => entry.href === "/work/northern-trust"),
    false,
    "the Northern Trust archive must stay out of public search",
  );

  // ---- Normalisation -----------------------------------------------------

  assert.equal(normalize("Follow-Up"), "follow up", "hyphens and case must not change matching");
  assert.equal(
    normalize("Café"),
    "cafe",
    "accents must be stripped so an unaccented query still matches",
  );
  assert.equal(normalize("  Medical & Dental  "), "medical dental");

  console.log(
    JSON.stringify(
      {
        entries: index.length,
        byGroup: Object.fromEntries(
          [...new Set(index.map((entry) => entry.group))].map((group) => [
            group,
            index.filter((entry) => entry.group === group).length,
          ]),
        ),
        result: "passed",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
