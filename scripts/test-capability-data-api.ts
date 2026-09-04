import assert from "node:assert/strict";
import { registerEntityType } from "../src/lib/revenue-os/entity-registry";
import {
  getCapabilityNamespace,
  queryCapabilityEntities,
  runCapabilityRecipe,
  setCapabilityNamespace,
  type CapabilityGrant,
} from "../src/lib/revenue-os/capability-data-api";
import { MemorySupabase } from "./lib/memory-supabase";

const TENANT = "tenant-a";
const FOREIGN = "tenant-b";

function grant(overrides: Partial<CapabilityGrant> = {}): CapabilityGrant {
  return {
    capabilityId: "webinar-pack",
    tenantId: TENANT,
    entities: ["webinar"],
    recipes: ["entity_count", "link_degree", "recent_links"],
    namespace: true,
    ...overrides,
  };
}

async function main() {
  const mem = new MemorySupabase({
    webinars: [
      { id: "w1", tenant_id: TENANT, title: "Intro call", status: "live", secret_note: "x" },
      { id: "w2", tenant_id: TENANT, title: "Deep dive", status: "draft", secret_note: "y" },
      { id: "w9", tenant_id: FOREIGN, title: "Foreign webinar", status: "live" },
    ],
  });
  const db = mem.client as never;
  await registerEntityType(db, {
    tenantId: TENANT,
    typeKey: "webinar",
    label: "Webinar",
    backingTable: "webinars",
    identityFields: ["title"],
    softDeleteColumn: "archived_at:now",
  });
  // Seed readable columns through re-registration (declaration is truth).
  await registerEntityType(db, {
    tenantId: TENANT,
    typeKey: "webinar",
    label: "Webinar",
    backingTable: "webinars",
    identityFields: ["title"],
    softDeleteColumn: "archived_at:now",
  });
  mem.tables.entity_types!.find((r) => r.type_key === "webinar")!.metadata = {
    readable_columns: ["title", "status"],
  };

  // 1. Happy-path scoped query with usage receipt.
  const res = await queryCapabilityEntities(db, grant(), { type: "webinar" });
  assert.equal(res.rows.length, 2, "tenant scope hides the foreign row");
  assert.equal(res.usage.operation, "query:webinar");
  assert.equal(res.usage.truncated, false);
  assert.ok(res.usage.budgetRemaining < 120);

  // 2. Filters: allowlisted columns and ops only.
  const live = await queryCapabilityEntities(db, grant(), {
    type: "webinar",
    filters: [{ column: "status", op: "eq", value: "live" }],
  });
  assert.equal(live.rows.length, 1);
  await assert.rejects(
    () => queryCapabilityEntities(db, grant(), { type: "webinar", filters: [{ column: "secret_note", op: "eq", value: "x" }] }),
    /not readable/,
    "unlisted columns must refuse even when they exist",
  );
  await assert.rejects(
    () => queryCapabilityEntities(db, grant(), { type: "webinar", filters: [{ column: "status", op: "in", value: "live" }] }),
    /Unsupported/,
    "non-array in-filter must refuse",
  );

  // 3. Grant boundaries: ungranted type, unknown type, disabled type.
  await assert.rejects(
    () => queryCapabilityEntities(db, grant({ entities: [] }), { type: "webinar" }),
    /not granted/,
  );
  await assert.rejects(
    () => queryCapabilityEntities(db, grant({ entities: ["nope"] }), { type: "nope" }),
    /Unknown entity type/,
  );
  mem.tables.entity_types!.find((r) => r.type_key === "webinar")!.is_disabled = true;
  await assert.rejects(() => queryCapabilityEntities(db, grant(), { type: "webinar" }), /disabled/);
  mem.tables.entity_types!.find((r) => r.type_key === "webinar")!.is_disabled = false;

  // 4. Cross-tenant: foreign tenant sees nothing, never another tenant's rows.
  await assert.rejects(
    () => queryCapabilityEntities(db, grant({ tenantId: FOREIGN }), { type: "webinar" }),
    /not granted|Unknown entity type/,
    "foreign tenant must not resolve another tenant's type",
  );

  // 5. Recipes: enumerated only, granted only.
  const count = await runCapabilityRecipe(db, grant(), { recipe: "entity_count", params: { type: "webinar" } });
  assert.equal(count.result.count, 2);
  await assert.rejects(
    () => runCapabilityRecipe(db, grant(), { recipe: "drop_tables", params: {} }),
    /not granted/,
    "unknown recipes must refuse",
  );
  await assert.rejects(
    () => runCapabilityRecipe(db, grant({ recipes: [] }), { recipe: "entity_count", params: { type: "webinar" } }),
    /not granted/,
    "ungranted recipes must refuse",
  );
  const degree = await runCapabilityRecipe(db, grant(), { recipe: "link_degree", params: { id: "w1" } });
  assert.equal(degree.result.degree, 0);
  const recent = await runCapabilityRecipe(db, grant(), { recipe: "recent_links", params: { limit: 5 } });
  assert.ok(Array.isArray(recent.result.links));

  // 6. Namespace: roundtrip, idempotent re-set, key validation, size cap.
  await setCapabilityNamespace(db, grant(), "draft", { title: "Q3 series" });
  const got = await getCapabilityNamespace(db, grant(), "draft");
  assert.deepEqual(got.value, { title: "Q3 series" });
  await setCapabilityNamespace(db, grant(), "draft", { title: "Q3 series" });
  assert.equal(
    mem.rows("admin_settings").filter((r) => String(r.key).startsWith("capability:")).length,
    1,
    "namespace re-set must upsert, not duplicate",
  );
  const missing = await getCapabilityNamespace(db, grant(), "absent");
  assert.equal(missing.value, null);
  await assert.rejects(() => setCapabilityNamespace(db, grant(), "BAD KEY!", {}), /Invalid namespace key/);
  await assert.rejects(
    () => setCapabilityNamespace(db, grant(), "big", { blob: "x".repeat(9000) }),
    /exceeds/,
  );
  await assert.rejects(
    () => getCapabilityNamespace(db, grant({ namespace: false }), "draft"),
    /not granted/,
  );
  // Corrupt stored values fail closed instead of being guessed.
  mem.tables.admin_settings!.find((r) => String(r.key).endsWith(":draft"))!.value = "{oops";
  await assert.rejects(() => getCapabilityNamespace(db, grant(), "draft"), /corrupt/);

  // 7. Rate budget trips fail-closed (120 calls/min). A fresh capability id
  // isolates the bucket so earlier checks cannot shift the count.
  const probe = grant({ capabilityId: "rate-probe" });
  for (let i = 0; i < 120; i += 1) {
    await getCapabilityNamespace(db, probe, "absent");
  }
  await assert.rejects(() => getCapabilityNamespace(db, probe, "absent"), /rate budget exhausted/);

  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "scoped-query",
        "column-op-allowlist",
        "grant-boundaries",
        "cross-tenant-refusal",
        "recipe-allowlist",
        "namespace-roundtrip",
        "namespace-validation",
        "rate-budget-trips",
      ],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
