import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { type TestContext } from "node:test";
import { inspectDocs, type DocsInspectionInput } from "./verify-docs";
import { hasLiveAppRoute } from "./lib/prerender-routes.mjs";
import type { DocsSection } from "../src/content/docs/manifest";

function fixture(t: TestContext) {
  const docsDir = mkdtempSync(path.join(tmpdir(), "docs-coverage-"));
  t.after(() => rmSync(docsDir, { recursive: true, force: true }));
  const manifest: DocsSection[] = ["start", "reference"].map((id) => ({
    id,
    track: "operator",
    title: id,
    description: id,
    modules: id === "start" ? ["fixture-module"] : [],
    pages: [{ slug: [id, "overview"], title: id, description: id }],
  }));
  const write = (section: string, content: string) => {
    mkdirSync(path.join(docsDir, section), { recursive: true });
    writeFileSync(
      path.join(docsDir, section, "overview.mdx"),
      `---\ntitle: ${section}\ndescription: ${section}\nupdated: "2026-09-06"\n---\n${content}\n`,
    );
  };
  write("start", "Read the registered capabilities.\n<DocsCapabilityCatalog />");
  write("reference", "Inspect the registered tool inputs.\n<DocsAiToolCatalog />");
  const input: DocsInspectionInput = {
    docsDir,
    manifest,
    modules: [{ id: "fixture-module", docsUrl: "/docs/start" }],
    extensionIds: [],
    capabilityIds: ["fixture-capability"],
    toolIds: ["fixture-tool"],
    requireBuild: true,
    prerenderRoutes: [
      "/docs",
      "/docs/start",
      "/docs/start/overview",
      "/docs/reference",
      "/docs/reference/overview",
    ],
    renderedPages: {
      "/docs/start/overview": '<div id="fixture-capability"></div>',
      "/docs/reference/overview": '<div id="fixture-tool"></div><h2 id="inputs">Inputs</h2>',
    },
  };
  return { input, write };
}

test("complete source and build coverage passes", (t) => {
  const { input } = fixture(t);
  const result = inspectDocs(input);
  assert.equal(result.strictPassed, true);
  assert.equal(result.requiredRoutes.length, 5);
  assert.deepEqual(result.failures, []);
});
test("missing source page names the exact manifest entry", (t) => {
  const { input } = fixture(t);
  rmSync(path.join(input.docsDir!, "start/overview.mdx"));
  assert.ok(
    inspectDocs(input).failures.some((issue) => issue.includes('"start/overview" has no MDX')),
  );
});
test("orphan source pages cannot hide outside the manifest", (t) => {
  const { input, write } = fixture(t);
  write("orphan", "Unowned fixture.");
  assert.ok(inspectDocs(input).failures.some((issue) => issue.includes("Orphan MDX")));
});
test("duplicate module ownership is rejected", (t) => {
  const { input } = fixture(t);
  input.manifest![1]!.modules = ["fixture-module"];
  assert.ok(inspectDocs(input).failures.some((issue) => issue.includes("documented by both")));
});
test("a first-party module cannot use a broken or external help URL", (t) => {
  const { input } = fixture(t);
  for (const docsUrl of ["/docs/missing", "https://example.com/docs", "//example.com/docs"]) {
    input.modules![0]!.docsUrl = docsUrl;
    assert.ok(
      inspectDocs(input).failures.some((issue) => issue.includes('it must be "/docs/start"')),
    );
  }
});
test("relative and JSX docs links are checked while valid fragments preserve route ownership", (t) => {
  const { input, write } = fixture(t);
  write(
    "start",
    '<DocsCapabilityCatalog />\n[Valid](../reference/overview#inputs)\n[Broken](../missing)\n<a href="/docs/absent">Missing</a>',
  );
  const issues = inspectDocs(input).failures;
  assert.ok(issues.some((issue) => issue.includes('"../missing"')));
  assert.ok(issues.some((issue) => issue.includes('"/docs/absent"')));
  assert.ok(!issues.some((issue) => issue.includes('"../reference/overview#inputs"')));
});
test("catalog ownership cannot disappear or be duplicated across pages", (t) => {
  const { input, write } = fixture(t);
  write("reference", "<DocsCapabilityCatalog />");
  const issues = inspectDocs(input).failures;
  assert.ok(
    issues.some((issue) => issue.includes("DocsCapabilityCatalog must appear on exactly one page")),
  );
  assert.ok(
    issues.some((issue) => issue.includes("DocsAiToolCatalog must appear on exactly one page")),
  );
});
test("a missing leaf route fails even when its section was prerendered", (t) => {
  const { input } = fixture(t);
  input.prerenderRoutes = input.prerenderRoutes!.filter(
    (route) => route !== "/docs/reference/overview",
  );
  assert.ok(
    inspectDocs(input).failures.some((issue) =>
      issue.includes('"/docs/reference/overview" is missing'),
    ),
  );
});
test("orphan build routes fail exact manifest coverage", (t) => {
  const { input } = fixture(t);
  input.prerenderRoutes!.push("/docs/removed");
  assert.ok(
    inspectDocs(input).failures.some((issue) =>
      issue.includes("Orphan prerendered documentation route"),
    ),
  );
});
test("built references must contain every registered capability and tool once", (t) => {
  const { input } = fixture(t);
  input.renderedPages!["/docs/start/overview"] = "<div>No capability</div>";
  input.renderedPages!["/docs/reference/overview"] =
    '<div id="fixture-tool"></div><div id="fixture-tool"></div>';
  const issues = inspectDocs(input).failures;
  assert.ok(
    issues.some((issue) => issue.includes("fixture-capability") && issue.includes("found 0")),
  );
  assert.ok(issues.some((issue) => issue.includes("fixture-tool") && issue.includes("found 2")));
});
test("source-only and allow-missing results cannot claim full strict coverage", (t) => {
  const { input } = fixture(t);
  delete input.prerenderRoutes;
  assert.equal(inspectDocs(input).strictPassed, false);
  input.allowMissing = true;
  rmSync(path.join(input.docsDir!, "start/overview.mdx"));
  const result = inspectDocs(input);
  assert.equal(result.strictPassed, false);
  assert.ok(result.warnings.length);
});
test("report mode returns actionable incomplete JSON while strict mode fails without a build", (t) => {
  const { input } = fixture(t);
  const args = [
    "scripts/verify-docs.ts",
    "--strict",
    "--json",
    "--prerender",
    path.join(input.docsDir!, "absent-build.json"),
  ];
  const strict = spawnSync("node_modules/.bin/tsx", args, { encoding: "utf8" });
  assert.equal(strict.status, 1, strict.stderr);
  const report = spawnSync("node_modules/.bin/tsx", [...args, "--report"], { encoding: "utf8" });
  assert.equal(report.status, 0, report.stderr);
  const result = JSON.parse(report.stdout);
  assert.equal(result.strictPassed, false);
  assert.ok(result.failures.some((issue: string) => issue.includes("Build evidence is missing")));
});

test("a missing built fragment is reported against its source link", (t) => {
  const { input, write } = fixture(t);
  write(
    "start",
    "<DocsCapabilityCatalog />\nRead [the missing section](../reference/overview#absent).",
  );
  assert.ok(
    inspectDocs(input).failures.some(
      (issue) => issue.includes("missing built anchor") && issue.includes("#absent"),
    ),
  );
});
test("empty and explicit placeholder pages fail the content contract", (t) => {
  const { input, write } = fixture(t);
  for (const body of ["# Heading only", "Coming soon."]) {
    write("reference", body);
    assert.ok(
      inspectDocs(input).failures.some((issue) => issue.includes("empty or placeholder prose")),
    );
  }
});
test("catalog examples and commented components cannot claim ownership", (t) => {
  const { input, write } = fixture(t);
  write(
    "reference",
    "This fixture describes a component without rendering it.\n```mdx\n<DocsAiToolCatalog />\n```\n{/* <DocsAiToolCatalog /> */}",
  );
  assert.ok(
    inspectDocs(input).failures.some((issue) =>
      issue.includes("DocsAiToolCatalog must appear on exactly one page"),
    ),
  );
});

test("route groups preserve dynamic token pages without accepting prerendered tokens", () => {
  const routes = { "/(marketing)/plan/[token]/page": "app/(marketing)/plan/[token]/page.js" };
  assert.equal(hasLiveAppRoute("/plan/[token]", routes, new Set()), true);
  assert.equal(hasLiveAppRoute("/plan/[token]", routes, new Set(["/plan/[token]"])), false);
  assert.equal(hasLiveAppRoute("/proposal/[token]", routes, new Set()), false);
});

test("bundled plugins cannot substitute a generic guide or external README", (t) => {
  const { input } = fixture(t);
  input.requireBuild = false;
  input.prerenderRoutes!.push(
    "/docs/plugins",
    "/docs/plugins/overview",
    "/docs/plugins/fixture-plugin",
  );
  input.extensionIds = ["fixture-plugin"];
  input.modules!.push({ id: "fixture-plugin", docsUrl: "/docs/extend/plugins" });
  assert.ok(
    inspectDocs(input).failures.some((issue) => issue.includes('Bundled plugin "fixture-plugin"')),
  );
  const folder = path.join(input.docsDir!, "plugins");
  mkdirSync(folder);
  writeFileSync(
    path.join(folder, "overview.mdx"),
    '---\ntitle: Plugins\ndescription: Examples\nupdated: "2026-09-06"\n---\nChoose an example.',
  );
  writeFileSync(
    path.join(folder, "fixture-plugin.mdx"),
    '---\ntitle: Example\ndescription: A plugin guide\nupdated: "2026-09-06"\n---\nRun the report and inspect the source records.',
  );
  input.manifest!.push({
    id: "plugins",
    track: "builder",
    title: "Plugins",
    description: "Examples",
    pages: [
      { slug: ["plugins", "overview"], title: "Plugins", description: "Examples" },
      { slug: ["plugins", "fixture-plugin"], title: "Example", description: "A plugin guide" },
    ],
  });
  input.modules![1]!.docsUrl = "/docs/plugins/fixture-plugin";
  assert.deepEqual(inspectDocs(input).failures, []);
  input.modules![1]!.docsUrl = "https://example.com/README.md";
  assert.ok(
    inspectDocs(input).failures.some((issue) => issue.includes('Bundled plugin "fixture-plugin"')),
  );
});
