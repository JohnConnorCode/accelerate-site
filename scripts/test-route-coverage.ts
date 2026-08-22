#!/usr/bin/env tsx
/**
 * Every industry page must be reachable and indexable.
 *
 * The nonprofits page shipped, went live, and stayed invisible: the header and
 * footer each carried a hand-written list of nine industries that nobody
 * extended, and the sitemap had the same hardcoded list. A page nothing links to
 * is a page that does not exist, and the failure is silent by construction,
 * because the page itself returns 200 the whole time.
 *
 * All three now derive from `verticals`. This asserts they still do.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verticals } from "../src/content/verticals";

const SURFACES = [
  { file: "src/components/layout/Header.tsx", what: "the primary navigation" },
  { file: "src/components/layout/Footer.tsx", what: "the footer" },
  { file: "src/app/sitemap.ts", what: "the sitemap" },
];

assert.ok(verticals.length > 0, "no verticals defined, so this guard checks nothing");

const failures: string[] = [];

for (const surface of SURFACES) {
  const source = readFileSync(surface.file, "utf8");

  // A hardcoded industry path is the defect itself, whatever else the file does.
  const hardcoded = [...source.matchAll(/["'`]\/industries\/([a-z0-9-]+)["'`]/g)].map((match) => match[1]!);
  if (hardcoded.length) {
    failures.push(`${surface.file}: hardcodes ${hardcoded.length} industry path(s) (${[...new Set(hardcoded)].join(", ")}). Derive from verticals instead, or the next industry ships invisible.`);
  }

  const derives = /verticals\s*\.\s*map|\.\.\.\s*INDUSTRY_LINKS|INDUSTRY_LINKS/.test(source) && /from "@\/content\/verticals"/.test(source);
  if (!derives) {
    failures.push(`${surface.file}: ${surface.what} does not derive its industry links from the vertical content.`);
  }
}

// Every vertical needs a slug that can actually resolve to a route.
for (const vertical of verticals) {
  if (!/^[a-z0-9-]+$/.test(vertical.slug)) failures.push(`vertical "${vertical.name}" has a slug that will not route cleanly: ${vertical.slug}`);
  if (!vertical.name.trim()) failures.push(`vertical ${vertical.slug} has no name, so its nav entry would be blank`);
}

const slugs = verticals.map((vertical) => vertical.slug);
assert.equal(new Set(slugs).size, slugs.length, `duplicate vertical slugs: ${slugs.join(", ")}`);

// The page that started this must stay present.
assert.ok(slugs.includes("nonprofits"), "the nonprofits vertical is missing from the content");

if (failures.length) {
  console.error(`Route coverage failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ verticals: verticals.length, surfacesChecked: SURFACES.length, result: "passed" }, null, 2));
}
