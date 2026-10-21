import assert from "node:assert/strict";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { verticals } from "../src/content/verticals";
import { industryActivity } from "../src/content/industry-activity";
import { EXTENSION_MODULES } from "../src/lib/revenue-os/extension-modules.generated";
import { ModuleCard } from "../src/components/admin/ModuleCard";

assert.deepEqual(
  Object.keys(industryActivity).sort(),
  verticals.map((vertical) => vertical.slug).sort(),
);
for (const vertical of verticals) {
  const activity = industryActivity[vertical.slug];
  assert.equal(activity.events.length, 6, vertical.slug);
  assert(activity.context.startsWith("Illustrative · "), vertical.slug);
  assert(activity.events.filter((event) => event.system).length >= 2, vertical.slug);
  assert(activity.events.filter((event) => !event.system).length >= 2, vertical.slug);
  assert.doesNotMatch(activity.events.map((event) => event.text).join(" "), /\bleads\b|—/i);
}
assert.equal(
  new Set(Object.values(industryActivity).map((activity) => activity.events[0].text)).size,
  verticals.length,
);

for (const definition of EXTENSION_MODULES) {
  const html = renderToStaticMarkup(<ModuleCard module={definition} enabled />);
  assert(html.includes(`data-module-card="${definition.id}"`));
  assert.match(html, /Owner/);
  assert.match(html, /Autonomy/);
  assert.match(html, /No execution receipt loaded/);
  assert.doesNotMatch(html, /System: /);
}
// A new manifest needs no page-specific presentation entry.
const fixture = { ...EXTENSION_MODULES[0], id: "fixture-module", name: "Fixture module" };
const fixtureHtml = renderToStaticMarkup(
  <ModuleCard
    module={fixture}
    enabled={false}
    owner="Alex"
    lastAction={{ text: "Report completed", system: true, time: "09:12" }}
  />,
);
assert.match(fixtureHtml, /Fixture module/);
assert.match(fixtureHtml, /Disabled/);
assert.match(fixtureHtml, /Alex/);
assert.match(fixtureHtml, /System: /);
assert.match(fixtureHtml, /09:12/);

// Exercise the actual verifier, including its JSX line boundaries.
const fixturePath = "src/components/admin/BrandHeaderRegression.tsx";
assert(!existsSync(fixturePath));
try {
  writeFileSync(fixturePath, '<th\n className="px-4 font-mono"\n>Header</th>\n');
  const rejected = spawnSync(process.execPath, ["scripts/verify-brand-system.mjs"], {
    encoding: "utf8",
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /BrandHeaderRegression.tsx:1 restyles a table header/);
  writeFileSync(fixturePath, '<th\n className="text-right"\n>Header</th>\n');
  const accepted = spawnSync(process.execPath, ["scripts/verify-brand-system.mjs"], {
    encoding: "utf8",
  });
  assert.equal(accepted.status, 0, accepted.stderr);
} finally {
  unlinkSync(fixturePath);
}
assert.doesNotMatch(
  readFileSync("src/app/globals.css", "utf8"),
  /--(?:gold-|aurora-|mesh-\d|glow-(?:soft|medium|strong))/,
);
console.log(
  `PASS: ${verticals.length} trade streams, ${EXTENSION_MODULES.length} manifest cards, new-module rendering and multiline header enforcement.`,
);
