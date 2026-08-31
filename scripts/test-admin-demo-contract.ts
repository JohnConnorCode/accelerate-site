import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEMO_SCENARIOS, DEMO_SCENARIO_SUMMARIES } from "../src/lib/admin/demo/scenarios";

const expectedScenarios = ["northline-roofing", "alder-ridge-law", "ledgerstone-advisory", "hearthline-realty", "common-table-network"];
assert.deepEqual(DEMO_SCENARIO_SUMMARIES.map((scenario) => scenario.id), expectedScenarios, "The launcher must offer the five targeted businesses in sales order");

for (const [scenarioId, pack] of Object.entries(DEMO_SCENARIOS)) {
  assert.equal(pack.id, scenarioId);
  assert.equal(pack.version, 3);
  assert.ok(pack.people.length >= 30, `${scenarioId}: needs a credible contact graph`);
  assert.ok(pack.opportunities.length >= 15, `${scenarioId}: needs a credible pipeline`);
  assert.ok(pack.conversations.length >= 8, `${scenarioId}: needs a credible inbox`);
  assert.ok(pack.conversations.every((conversation) => conversation.messages.length >= 3), `${scenarioId}: conversation history is too thin`);
  assert.ok(pack.tasks.length >= 15, `${scenarioId}: work queue is too thin`);
  assert.ok(pack.actions.length >= 5, `${scenarioId}: approval queue is too thin`);
  assert.ok(pack.content.campaignNames.length >= 3, `${scenarioId}: campaigns are not business-specific`);
  assert.ok(pack.content.contentTitles.length >= 4, `${scenarioId}: editorial data is not business-specific`);
  assert.ok(pack.content.resourceTitles.length >= 4, `${scenarioId}: resources are not business-specific`);
  assert.ok(pack.content.roadmapTitles.length >= 6, `${scenarioId}: roadmap data is not business-specific`);
  assert.ok(pack.tenant.brand.domain.endsWith(".example"), `${scenarioId}: demo tenant must use a reserved domain`);
  assert.ok(pack.people.every((contact) => contact.email.endsWith(`@${pack.tenant.brand.domain}`)), `${scenarioId}: every address must stay inside the fictional domain`);
  assert.equal(new Set(pack.people.map((contact) => contact.id)).size, pack.people.length, `${scenarioId}: duplicate contact id`);
  assert.equal(new Set(pack.people.map((contact) => contact.email)).size, pack.people.length, `${scenarioId}: duplicate contact email`);
  const people = new Set(pack.people.map((contact) => contact.id));
  assert.ok(pack.opportunities.every((item) => people.has(item.personId)), `${scenarioId}: orphaned opportunity`);
  assert.ok(pack.conversations.every((item) => people.has(item.personId)), `${scenarioId}: orphaned conversation`);
  assert.ok(pack.tasks.every((item) => people.has(item.personId)), `${scenarioId}: orphaned task`);
  assert.ok(pack.actions.every((item) => people.has(item.personId)), `${scenarioId}: orphaned approval`);
}

const authoredCorpora = Object.entries(DEMO_SCENARIOS).map(([id, pack]) => ({
  id,
  values: [
    ...pack.people.map((item) => item.name),
    ...pack.opportunities.flatMap((item) => [item.name, item.nextAction]),
    ...pack.conversations.flatMap((item) => [item.subject, ...item.messages.map((message) => message.body)]),
    ...pack.tasks.map((item) => item.title),
    ...pack.actions.flatMap((item) => [item.title, item.description, item.body || ""]),
    ...pack.content.campaignNames,
    ...pack.content.contentTitles,
    ...pack.content.resourceTitles,
    ...pack.content.roadmapTitles,
  ].map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).filter(Boolean),
}));
for (let left = 0; left < authoredCorpora.length; left += 1) {
  for (let right = left + 1; right < authoredCorpora.length; right += 1) {
    const a = authoredCorpora[left]!;
    const b = authoredCorpora[right]!;
    const duplicates = a.values.filter((value) => b.values.includes(value));
    assert.deepEqual(duplicates, [], `${a.id}/${b.id}: customer-facing fixture copy is duplicated across businesses`);
  }
}

const categoryCount = new Set(DEMO_SCENARIO_SUMMARIES.map((scenario) => scenario.category)).size;
assert.equal(categoryCount, DEMO_SCENARIO_SUMMARIES.length, "Scenarios must demonstrate distinct business models");

const scenarioMark = readFileSync("src/components/admin/DemoScenarioMark.tsx", "utf8");
const adminShell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
const demoBoundary = readFileSync("src/components/admin/AdminDemoBoundary.tsx", "utf8");
const demoLauncher = readFileSync("src/app/(marketing)/demo/command-center/page.tsx", "utf8");
for (const scenario of DEMO_SCENARIO_SUMMARIES) assert.match(scenarioMark, new RegExp(scenario.id), `${scenario.id}: custom logo artwork is missing`);
assert.match(adminShell, /<DemoScenarioMark/, "Demo workspaces must replace the Accelerate brand mark with their scenario mark");
assert.match(demoLauncher, /<DemoScenarioMark/, "The launcher must preview each scenario mark");
assert.doesNotMatch(demoLauncher, /lg:col-span-3|Inside this workspace/, "Launcher cards must share one size and must not stack a second story list on the chooser");
assert.match(demoLauncher, /DEMO_SCENARIO_SHELL_NAMES/, "Launcher titles must use the short operating names, not the full legal lockup");
assert.doesNotMatch(demoBoundary, /AdminDemoGuide|Guided tour|Open guided tour/, "The exploration-first workspace must not render the paused guided tour");

for (const file of ["src/components/home/CommandCenter.tsx", "src/components/sections/CommandCenterPage.tsx"]) {
  assert.match(readFileSync(file, "utf8"), /href="\/demo\/command-center"/, `${file}: public full-admin demo link is missing`);
  assert.doesNotMatch(readFileSync(file, "utf8"), /href="\/command-center\/demo"/, `${file}: obsolete standalone preview link remains`);
}

const legacyDemoRoute = readFileSync("src/app/(marketing)/command-center/demo/page.tsx", "utf8");
assert.match(legacyDemoRoute, /permanentRedirect\("\/demo\/command-center"\)/, "Legacy preview route must resolve to the full admin launcher");
assert.doesNotMatch(legacyDemoRoute, /<CommandCenterDemo|components\/command-center\/demo/, "Legacy preview route must not render the obsolete standalone demo");

for (const file of [
  "src/app/admin/today/page.tsx",
  "src/components/admin/NotificationBell.tsx",
  "src/components/admin/RevenueAICommand.tsx",
]) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /Sparkles/, `${file}: generic AI marks must not decorate repeated operational items`);
}

const demoRuntime = readFileSync("src/lib/admin/demo/runtime.ts", "utf8");
const fetchJson = readFileSync("src/lib/admin/fetchJson.ts", "utf8");
const adminReadBody = readFileSync("src/components/admin/AdminReadBody.tsx", "utf8");
const adminStyles = readFileSync("src/app/globals.css", "utf8");
const bookingsPage = readFileSync("src/app/admin/bookings/page.tsx", "utf8");
assert.match(adminReadBody, /contentClassName="admin-content-stack"/, "Shared async admin reads must preserve page section rhythm after data resolves");
assert.match(adminStyles, /\.admin-content-stack[\s\S]*?display:\s*grid;[\s\S]*?gap:/, "Admin section rhythm must be owned by one shared layout rule");
assert.doesNotMatch(bookingsPage, /Roofing campaign|roofing opportunities/, "Shared Bookings copy must not leak the home-services scenario into other tenants");
assert.match(demoRuntime, /activeRuntime\?\.scenarioId === scenarioId/, "Demo fetch intercept must be idempotent per scenario so first client reads cannot miss the runtime");
assert.match(demoRuntime, /__accelerateAdminDemoRuntime = scenarioId/, "Installing the demo runtime must publish the readiness marker immediately");
assert.doesNotMatch(demoRuntime, /items: \[\], data: \[\], schemaReady: true/, "Unknown demo admin APIs must not look like a successful empty workspace");
assert.match(demoRuntime, /This fictional workspace has no handler for this request/, "Unknown demo admin APIs must fail closed with an explicit error");
assert.match(demoRuntime, /tokenHealth:\s*\{\s*accessEnvelopeValid:\s*true,\s*refreshEnvelopeValid:\s*true,\s*expiresAt:/, "Demo Setup must satisfy the shared Google credential-health response contract");
assert.match(fetchJson, /waitForDemoRuntime/, "Admin reads must wait for the fictional runtime before touching protected APIs");

console.log(JSON.stringify({ result: "passed", scenarios: DEMO_SCENARIO_SUMMARIES.map((scenario) => scenario.id) }, null, 2));
