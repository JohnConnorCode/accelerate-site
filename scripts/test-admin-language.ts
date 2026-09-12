import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditAdminLanguage } from "./audit-admin-language.mjs";
import {
  adminNavLinks,
  adminNavSections,
  filterNavSectionsByTenant,
  adminPageName,
  resolveAdminNavLink,
  searchAdminNavLinks,
} from "../src/lib/admin/navigation";
import { getAdminBreadcrumbs } from "../src/lib/admin/breadcrumbs";

import { resolveAdminHref, resolveAdminPathname } from "../src/lib/admin/navigation-paths";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import { isModuleEnabled } from "../src/lib/revenue-os/modules";
import { resolveModuleForAdminPath } from "../src/lib/revenue-os/module-routes";

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

// Shell passes the query-qualified identity. Queries never become breadcrumb labels;
// record links keep their query while canonical parents retain stable destinations.
for (const query of ["?", "?view=history&return=overview"]) {
  assert.deepEqual(getAdminBreadcrumbs(`/admin/contacts${query}`), [
    { label: adminPageName("contacts"), href: "/admin/contacts" },
  ]);
  assert.deepEqual(getAdminBreadcrumbs(`/admin/contacts/fixture${query}`), [
    { label: adminPageName("contacts"), href: "/admin/contacts" },
    { label: "Timeline", href: `/admin/contacts/fixture${query}` },
  ]);
  assert.deepEqual(getAdminBreadcrumbs(`/admin/blueprints/fixture${query}`), [
    { label: adminPageName("blueprints"), href: "/admin/blueprints" },
  ]);
}
assert.deepEqual(getAdminBreadcrumbs("/admin/ai?purpose=architect&view=chat"), [
  { label: adminPageName("architect"), href: "/admin/ai?purpose=architect" },
]);

// Actual link/shell adapters round-trip under the same role/module inputs.
// Platform-only role visibility is intentional and remains owned by AdminShell.
const scenarios = Object.values(DEMO_SCENARIOS);
assert.equal(scenarios.length, 6);
const surfaces = [
  { name: "live", scenario: null, workspace: null },
  { name: "tenant", scenario: null, workspace: "fixture" },
  ...scenarios.map((pack) => ({ name: pack.id, scenario: pack.id, workspace: null })),
];
let routeChecks = 0;
for (const surface of surfaces) {
  for (const destination of adminNavLinks) {
    const outbound = resolveAdminHref(destination.href, surface.scenario, surface.workspace);
    const url = new URL(outbound, "https://admin.invalid");
    const canonical = resolveAdminPathname(url.pathname, surface.scenario, null) + url.search;
    assert.equal(
      resolveAdminNavLink(canonical)?.id,
      destination.id,
      `${surface.name}: ${outbound}`,
    );
    assert.equal(getAdminBreadcrumbs(canonical)[0]?.label, adminPageName(destination.id));
    const owner = resolveModuleForAdminPath(new URL(canonical, url.origin).pathname);
    assert(owner, `${destination.id} has no module owner`);
    routeChecks++;
  }
  for (const enabled of [false, true]) {
    const config = { modules: { campaigns: enabled, "core-command": false } };
    const links = filterNavSectionsByTenant(adminNavSections, config).flatMap(
      (group) => group.links,
    );
    assert.equal(
      links.some((link) => link.id === "delivery-runs"),
      enabled,
    );
    assert.equal(
      searchAdminNavLinks(links, "Email Sequences").some((link) => link.id === "delivery-runs"),
      enabled,
    );
    assert.equal(isModuleEnabled("campaigns", config), enabled);
    assert.equal(isModuleEnabled("core-command", config), true);
    assert(links.some((link) => link.id === "today"));
    for (const link of links) {
      const href = resolveAdminHref(link.href, surface.scenario, surface.workspace);
      const url = new URL(href, "https://admin.invalid");
      assert.equal(
        resolveAdminNavLink(resolveAdminPathname(url.pathname, surface.scenario, null) + url.search)
          ?.id,
        link.id,
      );
    }
  }
}
assert.equal(resolveAdminPathname("/t/fixture/admin", null, null), "/admin/today");
for (const pack of scenarios) {
  assert.equal(
    resolveAdminPathname(`/demo/command-center/${pack.id}`, pack.id, null),
    "/admin/today",
  );
  const href = resolveAdminHref("/admin/contacts/fixture?tab=history", pack.id);
  const url = new URL(href, "https://admin.invalid");
  assert.equal(
    resolveAdminPathname(url.pathname, pack.id, null) + url.search,
    "/admin/contacts/fixture?tab=history",
  );
}
assert.equal(resolveModuleForAdminPath("/admin/email-sequences")?.id, "campaigns");
console.log(
  JSON.stringify({ scenarioRouteMatrix: "passed", surfaces: surfaces.length, routeChecks }),
);

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
