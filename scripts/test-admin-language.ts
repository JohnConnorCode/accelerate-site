import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditAdminLanguage } from "./audit-admin-language.mjs";
import {
  adminNavLinks,
  adminPageName,
  resolveAdminNavLink,
  searchAdminNavLinks,
} from "../src/lib/admin/navigation";
import { getAdminBreadcrumbs } from "../src/lib/admin/breadcrumbs";

const root = process.cwd();
const report = auditAdminLanguage(root);
assert.deepEqual(report.problems, []);
assert(report.destinations.length >= 34);
for (const destination of report.destinations) {
  const label = adminPageName(destination.id);
  assert.equal(label, destination.label);
  assert.equal(resolveAdminNavLink(destination.href)?.id, destination.id);
  assert.equal(getAdminBreadcrumbs(destination.href)[0]?.label, label);
  assert(
    searchAdminNavLinks(adminNavLinks, label.toUpperCase()).some(
      (link) => link.id === destination.id && link.label === label,
    ),
  );
  for (const page of destination.pages) {
    assert(page.introductions.length > 0, page.file);
    if (page.route.includes("[")) {
      const concrete = page.route.replace(/\[[^\]]+\]/g, "fixture-record");
      assert.equal(getAdminBreadcrumbs(concrete)[0]?.label, label);
    }
  }
}
assert.equal(
  resolveAdminNavLink("/admin/ai?view=chat&purpose=architect&conversation=fixture")?.id,
  "architect",
);
assert.equal(resolveAdminNavLink("/admin/ai?view=chat")?.id, "ai");
assert.equal(resolveAdminNavLink("/admin/contacts-not-a-route"), undefined);
assert.deepEqual(getAdminBreadcrumbs("/admin/contacts/fixture"), [
  { label: adminPageName("contacts"), href: "/admin/contacts" },
  { label: "Timeline", href: "/admin/contacts/fixture" },
]);

const guidanceFile = "src/lib/admin/page-guidance.ts";
const guidance = readFileSync(guidanceFile, "utf8");
assert.deepEqual(
  auditAdminLanguage(root, { [guidanceFile]: guidance.replace("  today: {", '  "today": {') })
    .problems,
  [],
  "quoted/unquoted keys are equivalent",
);
assert(
  auditAdminLanguage(root, {
    [guidanceFile]: guidance.replace("  today: {", "  missingToday: {"),
  }).problems.some((p: string) => p.includes("today")),
  "missing real guidance fails",
);
assert(
  auditAdminLanguage(root, {
    [guidanceFile]: guidance.replace("/docs/start/daily-path", "/docs/not-a-guide"),
  }).problems.some((p: string) => p.includes("Missing guide target")),
);
const blueprintsFile = "src/components/admin/BlueprintsWorkspace.tsx";
const blueprints = readFileSync(blueprintsFile, "utf8");
assert(
  auditAdminLanguage(root, {
    [blueprintsFile]: blueprints.replace(
      'title={adminPageName("blueprints")}',
      'title="Workspace Blueprints"',
    ),
  }).problems.some((p: string) => p.includes("canonical Blueprints")),
  "literal root-name drift fails",
);
assert(
  auditAdminLanguage(root, {
    [blueprintsFile]: blueprints.replace(
      'title={adminPageName("blueprints")}',
      "title={'adminPageName(\"blueprints\")'}",
    ),
  }).problems.some((p: string) => p.includes("canonical Blueprints")),
  "prose is not a helper call",
);
const headerFile = "src/components/admin/PageHeader.tsx";
const header = readFileSync(headerFile, "utf8");
assert(
  auditAdminLanguage(root, {
    [headerFile]: header.replace('role="dialog"', 'role="presentation"'),
  }).problems.some((p: string) => p.includes("accessible optional help")),
);
console.log(
  JSON.stringify({
    result: "passed",
    destinations: report.destinations.length,
    introductions: report.destinations.reduce(
      (n: number, d: { pages: unknown[] }) => n + d.pages.length,
      0,
    ),
    boundary: "source and shared identity behavior; browser proof remains separate",
  }),
);
