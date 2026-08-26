import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEMO_SCENARIOS, DEMO_SCENARIO_SUMMARIES } from "../src/lib/admin/demo/scenarios";

assert.equal(DEMO_SCENARIO_SUMMARIES.length, 3, "The professional launcher must offer three distinct businesses");

for (const [scenarioId, pack] of Object.entries(DEMO_SCENARIOS)) {
  assert.equal(pack.id, scenarioId);
  assert.equal(pack.version, 1);
  assert.ok(pack.story.length >= 5, `${scenarioId}: guided story is incomplete`);
  assert.ok(pack.people.length >= 30, `${scenarioId}: needs a credible contact graph`);
  assert.ok(pack.opportunities.length >= 15, `${scenarioId}: needs a credible pipeline`);
  assert.ok(pack.conversations.length >= 8, `${scenarioId}: needs a credible inbox`);
  assert.ok(pack.conversations.every((conversation) => conversation.messages.length >= 3), `${scenarioId}: conversation history is too thin`);
  assert.ok(pack.tasks.length >= 15, `${scenarioId}: work queue is too thin`);
  assert.ok(pack.actions.length >= 5, `${scenarioId}: approval queue is too thin`);
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

const categoryCount = new Set(DEMO_SCENARIO_SUMMARIES.map((scenario) => scenario.category)).size;
assert.equal(categoryCount, DEMO_SCENARIO_SUMMARIES.length, "Scenarios must demonstrate distinct business models");

for (const file of ["src/components/home/CommandCenter.tsx", "src/components/sections/CommandCenterPage.tsx"]) {
  assert.match(readFileSync(file, "utf8"), /href="\/demo\/command-center"/, `${file}: public full-admin demo link is missing`);
  assert.doesNotMatch(readFileSync(file, "utf8"), /href="\/command-center\/demo"/, `${file}: obsolete standalone preview link remains`);
}

const legacyDemoRoute = readFileSync("src/app/command-center/demo/page.tsx", "utf8");
assert.match(legacyDemoRoute, /permanentRedirect\("\/demo\/command-center"\)/, "Legacy preview route must resolve to the full admin launcher");
assert.doesNotMatch(legacyDemoRoute, /<CommandCenterDemo|components\/command-center\/demo/, "Legacy preview route must not render the obsolete standalone demo");

console.log(JSON.stringify({ result: "passed", scenarios: DEMO_SCENARIO_SUMMARIES.map((scenario) => scenario.id) }, null, 2));
