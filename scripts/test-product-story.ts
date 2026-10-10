import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { businessAreas } from "../src/content/command-center-business";
import { capabilities } from "../src/content/command-center";
import { docsManifest } from "../src/content/docs/manifest";
import {
  adminBusinessGroups,
  adminNavSections,
  groupAdminNavLinks,
  filterNavSectionsByTenant,
  applyNavLayoutOverride,
  resolveAdminNavLink,
} from "../src/lib/admin/navigation";

// Every feature can be discovered once, with a guide and a real demo destination.
const routes = new Set(
  docsManifest.flatMap((section) => [
    `/docs/${section.id}`,
    ...section.pages.map((page) => `/docs/${page.slug.join("/")}`),
  ]),
);
const ids = capabilities.map((item) => item.id);
assert.equal(new Set(ids).size, ids.length);
const assigned = businessAreas.flatMap((area) => [...area.capabilityIds]);
assert.equal(new Set(assigned).size, assigned.length);
assert.deepEqual([...assigned].sort(), [...ids].sort());
for (const area of businessAreas) {
  assert.ok(existsSync(`public/images/docs/${area.image}.png`), area.image);
  for (const href of [area.guideHref, ...area.tasks.map((task) => task.href)])
    assert.ok(routes.has(href), `${area.id}: broken guide ${href}`);
  assert.ok(
    resolveAdminNavLink(area.demoHref.replace("/demo/command-center/northline-roofing", "/admin")),
    area.demoHref,
  );
  for (const item of capabilities.filter((capability) => capability.businessArea === area.id)) {
    assert.ok(routes.has(item.guideHref!), item.guideHref);
    assert.equal(item.demoHref, area.demoHref);
  }
}

// Grouping preserves the available destinations, layout hiding and module gating.
assert.equal(adminBusinessGroups.length, 7);
const members = adminBusinessGroups.flatMap((group) => group.members);
assert.equal(new Set(members).size, members.length);
for (const sections of [
  adminNavSections,
  filterNavSectionsByTenant(adminNavSections, {
    modules: { "stripe-invoicing": false, "client-onboarding": false },
  }),
  applyNavLayoutOverride(adminNavSections, {
    order: ["pipeline", "contacts", "today"],
    hidden: ["partners"],
  }),
]) {
  const grouped = groupAdminNavLinks(sections)
    .flatMap((group) => [group.primary!, ...group.links])
    .map((link) => link.id);
  assert.deepEqual(
    [...grouped].sort(),
    sections.flatMap((section) => section.links.map((link) => link.id)).sort(),
  );
}

// Run the documented exercise against both versions of the real report source.
// The adapted source lives in a disposable directory; the production rule stays unchanged.
const original = readFileSync("plugins/pipeline-watch/report.js", "utf8");
const workspace = mkdtempSync(path.join(tmpdir(), "pipeline-exercise-"));
try {
  mkdirSync(path.join(workspace, "plugins/pipeline-watch"), { recursive: true });
  for (const days of [7, 3]) {
    const source = days === 7 ? original : original.replace(">= 7 * 86400000", ">= 3 * 86400000");
    assert.ok(days === 7 || source !== original, "The exercise no longer matches the report.");
    writeFileSync(path.join(workspace, "plugins/pipeline-watch/report.js"), source);
    const result = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        path.resolve("node_modules/tsx/dist/loader.mjs"),
        path.resolve("scripts/try-pipeline-followup.ts"),
        "--days",
        String(days),
      ],
      { cwd: workspace, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
assert.equal(readFileSync("plugins/pipeline-watch/report.js", "utf8"), original);
console.log("Product discovery, navigation preservation and both follow-up exercises passed.");
