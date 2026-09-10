/**
 * Fixture generator for the Blueprint demo surface.
 *
 * Runs the real domain pipeline (parse → capability validation → review
 * model) over a fictional manufacturing Blueprint and writes the detail
 * payload consumed by the fictional demo runtime. Regenerate with:
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/gen-blueprint-demo-fixture.ts
 *
 * then run the Blueprint suite plus the demo QA:
 *
 *   npm run test:workspace-blueprint && npm run qa:blueprint-review
 *
 * The Playwright suite (qa:blueprint-review) asserts against the generated copy.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BLUEPRINT_SCHEMA_VERSION,
  buildReviewModel,
  parseBlueprint,
  summarizePreflight,
  validateAgainstCapabilities,
  type BlueprintLiveContext,
} from "../src/lib/revenue-os/workspace-blueprint";

function classified(classification: string, extra: Record<string, unknown> = {}) {
  return {
    classification,
    evidence: [
      {
        kind: classification === "fact" ? "fact" : "inference",
        statement: "Deposit precedes the production handoff",
        sources: ["founder interview"],
        quote: "Once the deposit arrives, we send the order to production.",
      },
    ],
    ...extra,
  };
}

const document = {
  schemaVersion: BLUEPRINT_SCHEMA_VERSION,
  businessSummary:
    "Example Manufacturing Co. sells custom projects: deposit, sampling, client review, bulk production, QA, shipment, final payment.",
  evidenceRefs: [
    {
      kind: "fact",
      statement: "Clients approve samples before bulk production",
      sources: ["founder interview"],
      quote: "After we finish samples, the customer approves them before we run production.",
    },
  ],
  assumptions: ["Deposits are required before production for new clients"],
  unresolvedQuestions: ["Who approves discounts over 10%?"],
  navigation: [
    { label: "Sales", targetType: "board", targetKey: "sales_pipeline" },
    { label: "Production", targetType: "board", targetKey: "production" },
    { label: "Money", targetType: "module", targetKey: "invoicing" },
  ],
  entities: [
    classified("recommendation", {
      key: "production_order",
      label: "Production Order",
      description: "Custom manufacturing order from deposit to delivery",
      reuseLevel: 4,
      confidence: "high",
      unresolvedQuestions: [],
    }),
  ],
  relationships: [],
  workTypes: [],
  boards: [
    classified("recommendation", {
      key: "production",
      name: "Production",
      sourceType: "production_order",
      groupingField: "stage",
      columns: [
        { key: "sampling", label: "Sampling", lifecycleStates: ["sampling"] },
        { key: "client_review", label: "Client Review", lifecycleStates: ["client_review"] },
        { key: "production", label: "Production", lifecycleStates: ["production"] },
        { key: "qa", label: "QA", lifecycleStates: ["qa"] },
        { key: "shipping", label: "Shipping", lifecycleStates: ["shipping"] },
        { key: "delivered", label: "Delivered", lifecycleStates: ["delivered"] },
      ],
      cardFields: ["customer", "due_date"],
    }),
    classified("recommendation", {
      key: "sales_pipeline",
      name: "Sales Pipeline",
      sourceType: "opportunity",
      groupingField: "stage",
      columns: [
        { key: "new", label: "New", lifecycleStates: ["new"] },
        { key: "proposal", label: "Proposal", lifecycleStates: ["proposal"] },
        { key: "won", label: "Won", lifecycleStates: ["won"] },
      ],
      cardFields: ["value"],
    }),
  ],
  views: [],
  dashboards: [],
  workflows: [
    classified("recommendation", {
      key: "won_opportunity_onboarding",
      name: "Won opportunity to production onboarding",
      trigger: { kind: "record_transition", ref: "opportunity.stage -> won" },
      steps: [
        { key: "create_project", kind: "deterministic", description: "Create production order", capabilityKey: "orders.create" },
        { key: "draft_welcome", kind: "ai_judgment", description: "Draft welcome email", capabilityKey: "email.draft" },
        { key: "send_welcome", kind: "action", description: "Send welcome email after approval", capabilityKey: "email.send" },
      ],
      requiredIntegrations: ["drive"],
      failureBehavior: "Retry deterministic steps twice; queue approval expiry after 7 days.",
    }),
  ],
  triggers: [],
  coworkers: [
    classified("recommendation", {
      key: "operations",
      name: "Operations",
      purpose: "Keep production orders moving and escalate stuck client reviews",
      workKinds: ["review_stuck_order"],
      requiredCapabilities: ["orders.read"],
      relevantEntities: ["production_order"],
      autonomyPolicy: "ask_until_trusted",
      escalation: "Escalate client reviews waiting more than 3 days",
    }),
  ],
  skills: [],
  attentionRules: [
    classified("inference", {
      key: "stuck_client_review",
      entityType: "production_order",
      condition: "stage = client_review AND waiting > 3 days",
      severity: "work",
    }),
  ],
  reports: [],
  integrationRequirements: [
    { capability: "drive", reason: "Automatic project folders", requiredFor: ["won_opportunity_onboarding"] },
  ],
  permissionPolicies: [],
  autonomyPolicies: [],
  installedAppRecommendations: [],
  migrationPlan: { behavior: "Existing records retain current state", retainExistingState: true },
};

const context: BlueprintLiveContext = {
  capabilities: [
    { key: "orders.create", available: true, policy: "automatic" },
    { key: "orders.read", available: true, policy: "automatic" },
    { key: "email.draft", available: true, policy: "automatic" },
    { key: "email.send", available: true, policy: "approval_required" },
    { key: "drive", available: false, policy: null },
  ],
  modules: ["invoicing"],
  entityTypes: ["company", "contact", "invoice", "opportunity", "production_order"],
  routes: ["/admin/invoicing"],
};

const blueprint = parseBlueprint(document);
const validation = validateAgainstCapabilities(blueprint, context);
const payload = {
  blueprintId: "11111111-1111-4111-8111-111111111111",
  title: "Example Manufacturing Blueprint",
  status: "draft",
  version: 1,
  parentVersion: null,
  changeSummary: "Initial setup",
  createdAt: "2026-09-08T00:00:00.000Z",
  document: blueprint,
  review: buildReviewModel(blueprint, validation),
  blocked: validation.blocked,
  approvals: validation.approvals,
  preflight: summarizePreflight(blueprint),
};
const root = dirname(fileURLToPath(import.meta.url));
const target = join(root, "..", "src", "lib", "admin", "demo", "blueprint-fixture.ts");
writeFileSync(
  target,
  `/** Fictional Blueprint detail. Generated — do not hand-edit. See scripts/gen-blueprint-demo-fixture.ts. */\nexport interface DemoBlueprintDetail {\n  blueprintId: string;\n  title: string;\n  status: string;\n  version: number;\n  parentVersion: number | null;\n  changeSummary: string;\n  createdAt: string;\n  document: Record<string, unknown>;\n  review: Record<string, unknown> & { businessSummary: string };\n  blocked: unknown[];\n  approvals: unknown[];\n  preflight: Record<string, number>;\n}\nexport const DEMO_BLUEPRINT_DETAIL: DemoBlueprintDetail = ${JSON.stringify(payload, null, 2)};\n`,
);
console.log(`Wrote ${target}`);
