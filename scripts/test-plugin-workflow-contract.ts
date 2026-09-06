import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parsePluginWorkflowInput,
  pluginWorkflowDeclaration,
} from "../src/lib/revenue-os/plugin-workflow-contract";
import { workflowTaskBatchSchema } from "../src/lib/revenue-os/workflow-task-contract";
import { stripeInvoiceInputSchema } from "../src/lib/revenue-os/stripe-contract";

import {
  compileWorkflowPolicy,
  assertWorkflowEvidenceSource,
  workflowRequestKey,
  workflowTaskEffectKey,
  stripeWorkflowEffectKey,
} from "../src/lib/revenue-os/plugin-workflow-policy";
import { createHash } from "node:crypto";
const taskPolicy = pluginWorkflowDeclaration("task-batch-opportunity-v1").policy;
const invoicePolicy = pluginWorkflowDeclaration("stripe-invoice-draft-v1").policy;
assert.equal(taskPolicy.tier, 2);
assert.equal(invoicePolicy.tier, 3);
const registration = {
  action: invoicePolicy.action,
  evidence: invoicePolicy.evidence,
  idempotency: invoicePolicy.idempotency,
  trustCeiling: "autonomous",
};
const rewritten = compileWorkflowPolicy(registration);
assert.equal(rewritten.policy.trustCeiling, "always-propose");
assert.equal(rewritten.warnings.length, 1);
for (const invalid of [
  { ...registration, evidence: undefined },
  { ...registration, idempotency: undefined },
  { ...registration, tier: 0 },
  { ...registration, evidence: taskPolicy.evidence },
  { ...registration, idempotency: taskPolicy.idempotency },
])
  assert.throws(() => compileWorkflowPolicy(invalid));
assert.throws(() => assertWorkflowEvidenceSource(taskPolicy, []), /canonical evidence source/);
assert.throws(
  () =>
    assertWorkflowEvidenceSource(taskPolicy, [
      { inputKey: "opportunityId", type: "workflow_contacts", columns: ["id"] },
    ]),
  /canonical evidence source/,
);

type FixtureManifest = {
  aiToolNames: string[];
  workflow: {
    tools: { inputSchema: { properties: Record<string, unknown> } }[];
    policy: { tier: number };
    contractHash: string;
    sources: unknown[];
    actions: string[];
    inputContract: string;
    inputSchema: { properties: { tasks: { maxItems: number } } };
  };
};
const id = "11111111-1111-4111-8111-111111111111";
const task = {
  title: "  Call customer  ",
  description: "  Confirm date  ",
  dueDate: "2026-09-09",
  assigneeUserId: id,
};
const input = { opportunityId: id, tasks: [task] };
assert.equal(
  workflowRequestKey(taskPolicy, "client-onboarding", id),
  `workflow:client-onboarding:${id}`,
);
assert.equal(
  workflowTaskEffectKey("client-onboarding", id, task),
  `plugin:${createHash("sha256")
    .update(JSON.stringify({ pluginId: "client-onboarding", source: id, ...task }))
    .digest("hex")}`,
);
assert.equal(stripeWorkflowEffectKey(id, id), `accelerate:${id}:${id}`);
assert.deepEqual(
  parsePluginWorkflowInput("task-batch-opportunity-v1", input),
  workflowTaskBatchSchema.parse(input),
);
assert.throws(() =>
  parsePluginWorkflowInput("task-batch-opportunity-v1", { ...input, meetingId: id }),
);
assert.throws(() =>
  parsePluginWorkflowInput("task-batch-opportunity-v1", {
    ...input,
    opportunityId: "x".repeat(36),
  }),
);
assert.throws(() =>
  parsePluginWorkflowInput("task-batch-opportunity-v1", {
    ...input,
    tasks: [{ ...task, dueDate: "2026-02-30" }],
  }),
);
assert.throws(() => parsePluginWorkflowInput("task-batch-meeting-v1", input));
assert.deepEqual(
  parsePluginWorkflowInput("task-batch-meeting-v1", { meetingId: id, tasks: [task] }),
  workflowTaskBatchSchema.parse({ meetingId: id, tasks: [task] }),
);
for (const key of ["__proto__", "constructor", "missing"])
  assert.throws(() => pluginWorkflowDeclaration(key), /Unknown host workflow contract/);
const invoice = {
  contactId: id,
  customerId: "cus_fixture",
  currency: "usd",
  daysUntilDue: 30,
  memo: "  Approved work  ",
  lines: [{ description: "Service", quantity: 1, unitAmount: 100 }],
};
assert.deepEqual(
  parsePluginWorkflowInput("stripe-invoice-draft-v1", invoice),
  stripeInvoiceInputSchema.parse(invoice),
);
assert.throws(() =>
  parsePluginWorkflowInput("stripe-invoice-draft-v1", {
    ...invoice,
    lines: [{ description: "Service", quantity: 2, unitAmount: 100000000 }],
  }),
);
assert.throws(() =>
  parsePluginWorkflowInput("stripe-invoice-draft-v1", { ...invoice, customerId: "not_a_customer" }),
);

// Exercise the actual build command in an owned disposable fixture, never by
// modifying the contributor's working tree or loading plugin code into Node.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = mkdtempSync(join(tmpdir(), "accelerate-contract-drift-"));
try {
  for (const dir of ["extensions", "plugins"])
    cpSync(join(root, dir), join(fixture, dir), { recursive: true });
  mkdirSync(join(fixture, "scripts/lib"), { recursive: true });
  mkdirSync(join(fixture, "src/lib/revenue-os"), { recursive: true });
  for (const path of [
    "scripts/build-extension-modules.mjs",
    "scripts/lib/bounded-workflow-schema.mjs",
    "scripts/lib/plugin-documentation.mjs",
    "scripts/lib/plugin-history.mjs",
    "src/lib/revenue-os/modules.ts",
    "src/lib/revenue-os/module-settings-policy.ts",
    "src/lib/revenue-os/plugin-settings-contract.ts",
    "src/lib/revenue-os/radar-profile-contract.ts",
    "src/lib/revenue-os/plugin-workflow-contract.ts",
    "src/lib/revenue-os/plugin-tool-contract.ts",
    "src/lib/revenue-os/invoice-page-contract.ts",
    "src/lib/revenue-os/plugin-workflow-policy.ts",
    "src/lib/revenue-os/action-reversibility-contract.ts",
    "src/lib/revenue-os/workflow-task-contract.ts",
    "src/lib/revenue-os/stripe-contract.ts",
  ])
    cpSync(join(root, path), join(fixture, path));
  for (const file of readdirSync(join(root, "extensions")).filter((file) =>
    file.endsWith(".module.json"),
  )) {
    const manifest = JSON.parse(readFileSync(join(root, "extensions", file), "utf8"));
    if (manifest.historyRoute) {
      const page = join("src/app", manifest.historyRoute, "page.tsx");
      mkdirSync(dirname(join(fixture, page)), { recursive: true });
      cpSync(join(root, page), join(fixture, page));
    }
  }
  symlinkSync(realpathSync(join(root, "node_modules")), join(fixture, "node_modules"));
  const build = () =>
    execFileSync(process.execPath, ["scripts/build-extension-modules.mjs"], {
      cwd: fixture,
      encoding: "utf8",
      stdio: "pipe",
    });
  const check = () =>
    spawnSync(process.execPath, ["scripts/build-extension-modules.mjs", "--check"], {
      cwd: fixture,
      encoding: "utf8",
    });
  build();
  assert.equal(check().status, 0);
  const path = join(fixture, "extensions/client-onboarding.module.json");
  const original = readFileSync(path, "utf8");
  for (const mutate of [
    (m: FixtureManifest) => {
      m.aiToolNames = [];
    },
    (m: FixtureManifest) => {
      m.aiToolNames.push("send_email");
    },
    (m: FixtureManifest) => {
      m.workflow.tools.pop();
    },
    (m: FixtureManifest) => {
      m.workflow.tools.push(m.workflow.tools[0]!);
    },
    (m: FixtureManifest) => {
      m.workflow.tools[0]!.inputSchema.properties = {};
    },
    (m: FixtureManifest) => {
      m.workflow.policy.tier = 0;
    },
    (m: FixtureManifest) => {
      m.workflow.contractHash = "0".repeat(64);
    },
    (m: FixtureManifest) => {
      m.workflow.sources = [];
    },
    (m: FixtureManifest) => {
      m.workflow.actions.push("send_email");
    },
    (m: FixtureManifest) => {
      m.workflow.actions = [];
    },
    (m: FixtureManifest) => {
      m.workflow.inputSchema.properties.tasks.maxItems = 100;
    },
    (m: FixtureManifest) => {
      m.workflow.inputContract = "constructor";
    },
  ]) {
    const manifest = JSON.parse(original);
    mutate(manifest);
    writeFileSync(path, JSON.stringify(manifest));
    const result = check();
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /declaration drift|Unknown host workflow contract|canonical evidence source/,
    );
    writeFileSync(path, original);
  }
  const radarPath = join(fixture, "extensions/opportunity-radar.module.json");
  const radarOriginal = readFileSync(radarPath, "utf8");
  for (const mutate of [
    (manifest: { settings: { label: string }[]; settingsContract: string }) => {
      manifest.settings[0]!.label = "Drifted field";
    },
    (manifest: { settings: { label: string }[]; settingsContract: string }) => {
      manifest.settingsContract = "constructor";
    },
  ]) {
    const manifest = JSON.parse(radarOriginal);
    mutate(manifest);
    writeFileSync(radarPath, JSON.stringify(manifest));
    const result = check();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /settings declaration drift|Unknown plugin settings contract/);
    writeFileSync(radarPath, radarOriginal);
  }
  // Editing the canonical validator must invalidate the committed projection.
  const contractPath = join(fixture, "src/lib/revenue-os/workflow-task-contract.ts");
  writeFileSync(contractPath, readFileSync(contractPath, "utf8").replace(".max(200)", ".max(190)"));
  assert.notEqual(check().status, 0);
  build();
  assert.equal(check().status, 0);
  const generated = join(fixture, "src/lib/revenue-os/extension-modules.generated.ts");
  writeFileSync(generated, readFileSync(generated, "utf8") + "\n// drift\n");
  assert.notEqual(check().status, 0);
  // The build treats executable source as bytes, even for hostile modules.
  writeFileSync(
    join(fixture, "plugins/client-onboarding/workflow.js"),
    'throw new Error("MUST NOT EXECUTE IN NODE");',
  );
  build();
  assert.equal(check().status, 0);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
console.log(
  "Workflow contracts: shared validator parity, bounded generation, stale schemas/action grants, invalid contract IDs and no build-time plugin execution passed.",
);
