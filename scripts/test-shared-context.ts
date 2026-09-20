import assert from "node:assert/strict";
import { buildContextPack, policyApplies } from "../src/lib/revenue-os/shared-context";
import { learningDedupeKey } from "../src/lib/revenue-os/learning-inbox";
import type { LearnedPolicyEntry } from "../src/lib/revenue-os/memory";
const policy = (id: string, extra: Partial<LearnedPolicyEntry> = {}): LearnedPolicyEntry => ({
  id,
  tenant_id: "tenant",
  action_key: "learning:messaging",
  rule: `Rule ${id}`,
  rationale: "Correction",
  source: "approved_learning",
  coworker_id: null,
  scope_entity_type: null,
  scope_entity_id: null,
  superseded_by: null,
  superseded_at: null,
  created_at: "2026-09-20",
  proposal_type: "messaging",
  scope: null,
  confidence: "high",
  conflicts: null,
  affected_workers: [],
  authority: "approved",
  ...extra,
});
const rules = [
  policy("global"),
  policy("sales", { affected_workers: ["sales"] }),
  policy("other", { coworker_id: "marketing" }),
  policy("client", { scope_entity_type: "contact", scope_entity_id: "client" }),
  policy("disabled", { scope: { pluginId: "meeting-prep" } }),
  policy("legacy", { scope: { unknown: "specific" } }),
  policy("historical", { authority: "historical" }),
  policy("superseded", { superseded_at: "2026-09-20" }),
];
assert.deepEqual(
  buildContextPack(rules, { coworkerId: "sales" }).guidance.map((p) => p.id),
  ["global", "sales"],
);
assert.deepEqual(
  buildContextPack(rules, {}).guidance.map((p) => p.id),
  ["global"],
);
assert.equal(policyApplies(rules[3]!, { entity: { type: "contact", id: "wrong" } }), false);
assert.equal(policyApplies(rules[3]!, { entity: { type: "contact", id: "client" } }), true);
assert.equal(
  policyApplies(rules[4]!, { pluginId: "meeting-prep", enabledPluginIds: ["meeting-prep"] }),
  true,
);
assert.equal(policyApplies(rules[4]!, { pluginId: "meeting-prep", enabledPluginIds: [] }), false);
const bounded = buildContextPack([policy("large", { rule: "x".repeat(2000) })], { maxChars: 1000 });
assert.equal(bounded.guidance.length, 0);
assert.equal(bounded.missing.length, 1);
assert.notEqual(
  buildContextPack([policy("a")], {}).guidance[0]!.revision,
  buildContextPack([policy("a", { rule: "changed" })], {}).guidance[0]!.revision,
);
assert.notEqual(
  learningDedupeKey({ type: "messaging", rule: "Same rule", affectedWorkers: ["sales"] }),
  learningDedupeKey({ type: "messaging", rule: "Same rule", affectedWorkers: ["marketing"] }),
);
assert.equal(
  learningDedupeKey({
    type: "messaging",
    rule: "Same rule",
    scope: { entityId: "a", entityType: "contact" },
  }),
  learningDedupeKey({
    type: "messaging",
    rule: "Same rule",
    scope: { entityType: "contact", entityId: "a" },
  }),
);
console.log(
  "Shared context: scope, workers, disabled plugins, provenance, budget and dedupe checks passed.",
);

assert.equal(
  policyApplies(policy("untyped", { proposal_type: null }), { guidanceTypes: ["messaging"] }),
  false,
);
assert.deepEqual(
  buildContextPack(
    [policy("oversized", { rule: "x".repeat(2000), authority: "official" }), policy("fits")],
    { maxChars: 1000 },
  ).guidance.map((p) => p.id),
  ["fits"],
);
