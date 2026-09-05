import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every public hero enters through one shared lifecycle
 * (PublicHeroEntrance + HeroEntranceItem steps). Before this gate, heroes
 * drifted into four parallel systems (work-hero-enter CSS classes,
 * EntranceGroup wrappers, page-local framer-motion, homepage flags), so the
 * same header animated differently per page and every new page re-broke it.
 * These assertions fail the moment a hero bypasses the shared path again.
 */

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      files.push(...sourceFiles(path));
    } else if (/\.tsx$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

const root = process.cwd();
const tsxFiles = sourceFiles(join(root, "src"));
const read = (file: string) => readFileSync(join(root, file), "utf8");

// 1. The legacy per-hero CSS delay system is retired from all markup.
for (const file of tsxFiles) {
  const source = readFileSync(file, "utf8");
  assert.ok(
    !/work-hero-(enter|meta|d[0-9])\b/.test(source),
    `${file} uses the retired work-hero CSS entrance; use PublicHeroEntrance steps instead`,
  );
}

// 2. The migrated hero owners render the shared lifecycle (not a lookalike).
for (const file of [
  "src/app/(marketing)/work/page.tsx",
  "src/components/sections/LearnHub.tsx",
  "src/components/work/CaseStudy.tsx",
  "src/app/(marketing)/learn/[slug]/page.tsx",
]) {
  const source = read(file);
  assert.ok(
    source.includes("PublicHeroEntrance") && source.includes("HeroEntranceItem"),
    `${file} must enter through PublicHeroEntrance + HeroEntranceItem steps`,
  );
}

// 3. The motion QA journey asserts the live shared lifecycle, not the dead classes.
const motionQa = read("scripts/qa-public-motion.mjs");
assert.ok(
  !/work-hero-(enter|meta|d[0-9])\b/.test(motionQa),
  "qa-public-motion must assert data-motion-role/data-hero-step, not retired work-hero selectors",
);
assert.ok(
  motionQa.includes('[data-motion-role="public-hero"]'),
  "qa-public-motion must cover the shared hero lifecycle",
);

// 4. The contract names the hero owner so the next author finds it.
const contract = read("docs/contracts/WORK-MOTION-CONTRACT.md");
assert.ok(
  contract.includes("PublicHeroEntrance"),
  "WORK-MOTION-CONTRACT must document PublicHeroEntrance as the hero owner",
);

console.log(JSON.stringify({ result: "passed", checks: 4 }));
