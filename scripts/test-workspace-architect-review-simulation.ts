#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BLUEPRINT_SCHEMA_VERSION,
  parseBlueprint,
} from "../src/lib/revenue-os/workspace-blueprint";
import {
  ENTIRE_ACCOUNT_REFUSED,
  VERSION_CONFLICT,
  applyConversationalPatch,
  assertExpectedVersion,
  proposalToTypedPatch,
  simulateBlueprint,
} from "../src/lib/revenue-os/architect-review-simulation";
import { compileBlueprintPlan } from "../src/lib/revenue-os/workspace-blueprint-compiler";

const classified = {
  classification: "recommendation" as const,
  evidence: [
    {
      kind: "inference" as const,
      statement: "Welcome email follows a won job",
      sources: ["founder interview"],
    },
  ],
};

function sampleBlueprint(extra: Record<string, unknown> = {}) {
  return parseBlueprint({
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    businessSummary: "Won jobs start a welcome sequence using existing mail tools.",
    navigation: [{ label: "Money", targetType: "module", targetKey: "invoicing" }],
    workflows: [
      {
        ...classified,
        key: "won_welcome",
        name: "Won welcome",
        trigger: { kind: "record_transition", ref: "opportunity.stage -> won" },
        steps: [
          {
            key: "draft_welcome",
            kind: "ai_judgment",
            description: "Draft welcome email",
            capabilityKey: "email.draft",
          },
        ],
        requiredIntegrations: [],
        failureBehavior: "Stop and surface the failure.",
      },
    ],
    ...extra,
  });
}

const context = {
  capabilities: [{ key: "email.draft", available: true, policy: "automatic" as const }],
  modules: ["core-pipeline", "stripe-invoicing"],
  entityTypes: ["opportunity", "contact"],
  routes: ["/admin/pipeline", "/admin/invoicing"],
};

const source = readFileSync("src/lib/revenue-os/architect-review-simulation.ts", "utf8");
assert.doesNotMatch(source, /applyApprovedBlueprint/);
assert.doesNotMatch(source, /proposeAction/);

const current = sampleBlueprint();
const patched = applyConversationalPatch(current, {
  businessSummary: "Won jobs also schedule a kickoff using existing booking tools.",
});
assert.ok(patched.diff.changed.includes("businessSummary"));
assert.notEqual(patched.next.businessSummary, current.businessSummary);

assert.throws(
  () => applyConversationalPatch(current, { businessSummary: "Use the entire account as context" }),
  (error: unknown) => error instanceof Error && error.message === ENTIRE_ACCOUNT_REFUSED,
);
assert.throws(
  () => applyConversationalPatch(current, { note: "Show chain-of-thought" }),
  (error: unknown) => error instanceof Error && error.message === ENTIRE_ACCOUNT_REFUSED,
);

const typed = proposalToTypedPatch("Set the business summary to Kickoff after won jobs.");
assert.equal(typed.businessSummary, "Kickoff after won jobs.");
assert.throws(
  () => proposalToTypedPatch("Use the entire account as context"),
  (error: unknown) => error instanceof Error && error.message === ENTIRE_ACCOUNT_REFUSED,
);

const simulation = simulateBlueprint(current, context, { event: "opportunity.stage -> won" });
assert.equal(simulation.kind, "simulation");
assert.deepEqual(simulation.writes, []);
assert.deepEqual(simulation.sends, []);
assert.deepEqual(simulation.moduleEnablement, []);
assert.deepEqual(simulation.plan, compileBlueprintPlan(current, context));
assert.equal(simulation.traces[0]?.workflowKey, "won_welcome");
assert.equal(simulation.traces[0]?.steps[0]?.outcome.includes("No live"), true);
assert.throws(() => assertExpectedVersion(1, 2), (error: unknown) =>
  error instanceof Error && error.message === VERSION_CONFLICT,
);

assert.throws(() => parseBlueprint({ ...current, schemaVersion: "nope" }));

const chat = readFileSync("src/components/admin/AdminAIChat.tsx", "utf8");
assert.match(chat, /ArchitectBlueprintReviewHost/);
const panel = readFileSync("src/components/admin/ArchitectBlueprintReview.tsx", "utf8");
assert.match(panel, /min-h-11/);
assert.match(panel, /sm:flex-row/);
assert.match(panel, /Simulate/);
assert.match(panel, /Preview patch/);
assert.match(panel, /Conversational proposal/);
assert.match(panel, /blueprintDraftId/);
assert.match(panel, /Retry/);
assert.doesNotMatch(panel, /blueprints\?\.\[0\]/);
assert.doesNotMatch(panel, /applyApprovedBlueprint/);
const patchRoute = readFileSync("src/app/api/admin/blueprints/[id]/patch/route.ts", "utf8");
assert.match(patchRoute, /expectedVersion/);
assert.match(patchRoute, /409/);

console.log(JSON.stringify({ result: "passed", cases: ["AC1", "AC2", "AC3"] }, null, 2));
