#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RETAINED_SOURCE_DISPOSITIONS } from "../src/lib/revenue-os/retained-source-dispositions";

const inventory = JSON.parse(
  readFileSync("docs/verification/admin-route-inventory.json", "utf8"),
) as {
  routes: Array<{ route: string; followUp?: { key?: string }; page?: string }>;
};

const retainedRoutes = inventory.routes.filter(
  (route) => route.followUp?.key === "canonical-retained-tools-parity",
);
assert.ok(retainedRoutes.length >= 10, "inventory must list the retained source-tool routes");

for (const route of retainedRoutes) {
  const disposition = RETAINED_SOURCE_DISPOSITIONS.find((entry) => entry.route === route.route);
  assert.ok(disposition, `${route.route} needs an explicit field disposition`);
  assert.ok(disposition.fields.length > 0, `${route.route} disposition cannot be empty`);
  const page = readFileSync(route.page ?? `src/app${route.route}/page.tsx`, "utf8");
  assert.match(
    page,
    /AdminReadBody|AdminAsyncRegion/,
    `${route.route} must keep loading, error and retry on the page identity`,
  );
  assert.match(page, /onRetry/, `${route.route} must expose retry for a failed read`);
}

const contactsApi = readFileSync("src/app/api/admin/contacts/route.ts", "utf8");
assert.match(contactsApi, /retainedSourceDispositions/);
assert.match(contactsApi, /attachRevenueLinkageWithTelemetry/);
assert.doesNotMatch(contactsApi, /createRevenueTask|ingestInboundLead|sendRecordedEmail/);

const resourcesApi = readFileSync("src/app/api/admin/resources/route.ts", "utf8");
assert.match(resourcesApi, /retainedSourceDispositions/);
assert.doesNotMatch(resourcesApi, /createRevenueTask|ingestInboundLead/);

console.log(
  JSON.stringify({
    result: "passed",
    retainedRoutes: retainedRoutes.map((route) => route.route),
    dispositions: RETAINED_SOURCE_DISPOSITIONS.length,
  }),
);
