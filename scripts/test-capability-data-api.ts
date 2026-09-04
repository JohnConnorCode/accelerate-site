import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bindTenantDatabase } from "../src/lib/supabase/server";
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
  const db = bindTenantDatabase(mem.client, TENANT, true);
  await registerEntityType(db, {
    tenantId: TENANT,
    typeKey: "webinar",
    label: "Webinar",
    backingTable: "webinars",
    identityFields: ["title"],
    softDeleteColumn: "archived_at:now",
    readableColumns: ["title", "status"],
  });
  // Re-registration preserves an explicit readable field declaration.
  await registerEntityType(db, {
    tenantId: TENANT,
    typeKey: "webinar",
    label: "Webinar",
    backingTable: "webinars",
    identityFields: ["title"],
    softDeleteColumn: "archived_at:now",
    readableColumns: ["title", "status"],
  });
  mem.tables.entity_types![0]!.is_disabled = false;

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
    () =>
      queryCapabilityEntities(db, grant(), {
        type: "webinar",
        filters: [{ column: "secret_note", op: "eq", value: "x" }],
      }),
    /not readable/,
    "unlisted columns must refuse even when they exist",
  );
  await assert.rejects(
    () =>
      queryCapabilityEntities(db, grant(), {
        type: "webinar",
        filters: [{ column: "status", op: "in", value: "live" }],
      }),
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
    /tenant-bound/,
    "foreign tenant must not resolve another tenant's type",
  );

  // 5. Recipes: enumerated only, granted only.
  const count = await runCapabilityRecipe(db, grant(), {
    recipe: "entity_count",
    params: { type: "webinar" },
  });
  assert.equal(count.result.count, 2);
  await assert.rejects(
    () => runCapabilityRecipe(db, grant(), { recipe: "drop_tables", params: {} }),
    /not granted/,
    "unknown recipes must refuse",
  );
  await assert.rejects(
    () =>
      runCapabilityRecipe(db, grant({ recipes: [] }), {
        recipe: "entity_count",
        params: { type: "webinar" },
      }),
    /not granted/,
    "ungranted recipes must refuse",
  );
  const degree = await runCapabilityRecipe(db, grant(), {
    recipe: "link_degree",
    params: { type: "webinar", id: "w1" },
  });
  assert.equal(degree.result.degree, 0);
  const recent = await runCapabilityRecipe(db, grant(), {
    recipe: "recent_links",
    params: { limit: 5 },
  });
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
  await assert.rejects(
    () => setCapabilityNamespace(db, grant(), "BAD KEY!", {}),
    /Invalid namespace key/,
  );
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

  // Denied authority must not touch the database, for any of the four shapes.
  let touches = 0;
  const raw = mem.client as SupabaseClient;
  const tracked = {
    ...raw,
    from: (table: string) => {
      touches++;
      return raw.from(table);
    },
  } as SupabaseClient;
  const bound = bindTenantDatabase(tracked, TENANT, true);
  const operations = [
    (database: SupabaseClient, g: CapabilityGrant) =>
      queryCapabilityEntities(database, g, { type: "webinar" }),
    (database: SupabaseClient, g: CapabilityGrant) =>
      runCapabilityRecipe(database, g, { recipe: "entity_count", params: { type: "webinar" } }),
    (database: SupabaseClient, g: CapabilityGrant) => getCapabilityNamespace(database, g, "draft"),
    (database: SupabaseClient, g: CapabilityGrant) =>
      setCapabilityNamespace(database, g, "draft", {}),
  ];
  for (const op of operations) {
    await assert.rejects(() => op(tracked, grant()), /tenant-bound/);
    await assert.rejects(() => op(bound, grant({ tenantId: FOREIGN })), /tenant-bound/);
  }
  assert.equal(touches, 0);
  assert.equal(
    res.rows[0]?.secret_note,
    undefined,
    "responses never widen the readable projection",
  );
  await assert.rejects(
    () =>
      runCapabilityRecipe(db, grant({ entities: [] }), {
        recipe: "entity_count",
        params: { type: "webinar" },
      }),
    /not granted/,
  );
  mem.tables.entity_types![0]!.is_disabled = true;
  await assert.rejects(
    () => runCapabilityRecipe(db, grant(), { recipe: "entity_count", params: { type: "webinar" } }),
    /disabled/,
  );
  mem.tables.entity_types![0]!.is_disabled = false;
  for (const limit of [NaN, Infinity, -1, 0, 1.2, 101]) {
    await assert.rejects(
      () => queryCapabilityEntities(db, grant(), { type: "webinar", limit }),
      /limit/,
    );
    await assert.rejects(
      () => runCapabilityRecipe(db, grant(), { recipe: "recent_links", params: { limit } }),
      /limit/,
    );
  }
  for (const column of ["*", "secrets(value)", "alias:secret_note", "name,secret_note"]) {
    mem.tables.entity_types![0]!.metadata = { readable_columns: [column] };
    await assert.rejects(
      () => queryCapabilityEntities(db, grant(), { type: "webinar" }),
      /identifier/,
    );
    await assert.rejects(
      () =>
        registerEntityType(db, {
          tenantId: TENANT,
          typeKey: "invalid",
          label: "Invalid",
          backingTable: "webinars",
          readableColumns: [column],
        }),
      /identifier/,
    );
  }
  mem.tables.entity_types![0]!.metadata = { readable_columns: ["title", "status"] };
  await registerEntityType(db, {
    tenantId: TENANT,
    typeKey: "webinar",
    label: "Renamed",
    backingTable: "webinars",
  });
  assert.deepEqual(
    mem.tables.entity_types![0]!.metadata,
    { readable_columns: ["title", "status"] },
    "omitting fields preserves the declaration",
  );
  const graphGrant = grant({ capabilityId: "graph-probe" });
  mem.tables.entity_types!.push({
    type_key: "private_note",
    tenant_id: TENANT,
    is_disabled: false,
  });
  mem.tables.entity_links = [
    {
      id: "self",
      tenant_id: TENANT,
      source_type: "webinar",
      source_id: "w1",
      target_type: "webinar",
      target_id: "w1",
      link_type: "self",
      metadata: { private: "never return" },
    },
    {
      id: "allowed",
      tenant_id: TENANT,
      source_type: "webinar",
      source_id: "w1",
      target_type: "webinar",
      target_id: "w2",
    },
    {
      id: "hidden",
      tenant_id: TENANT,
      source_type: "webinar",
      source_id: "w1",
      target_type: "private_note",
      target_id: "secret",
    },
    {
      id: "foreign",
      tenant_id: FOREIGN,
      source_type: "webinar",
      source_id: "w1",
      target_type: "webinar",
      target_id: "w2",
    },
    {
      id: "same-id-different-type",
      tenant_id: TENANT,
      source_type: "private_note",
      source_id: "w1",
      target_type: "webinar",
      target_id: "w2",
    },
  ];
  const visible = await runCapabilityRecipe(db, graphGrant, {
    recipe: "recent_links",
    params: { limit: 1 },
  });
  assert.equal((visible.result.links as unknown[]).length, 1);
  assert.equal(visible.usage.truncated, true);
  assert.equal(visible.usage.rowsRead, 2);
  const linked = await runCapabilityRecipe(db, graphGrant, {
    recipe: "link_degree",
    params: { type: "webinar", id: "w1" },
  });
  assert.equal(
    linked.result.degree,
    2,
    "self-links count once and ungranted endpoints are excluded",
  );
  assert.equal(linked.usage.rowsRead, 3, "usage includes both endpoint queries");
  await assert.rejects(
    () => runCapabilityRecipe(db, graphGrant, { recipe: "link_degree", params: { id: "w1" } }),
    /not granted/,
  );
  mem.tables.entity_types![0]!.is_disabled = true;
  const disabledGraph = await runCapabilityRecipe(db, graphGrant, { recipe: "recent_links" });
  assert.deepEqual(disabledGraph.result.links, []);
  mem.tables.entity_types![0]!.is_disabled = false;
  const capped = await queryCapabilityEntities(db, grant(), { type: "webinar", limit: 1 });
  assert.equal(capped.usage.rowsRead, 2);
  assert.equal(capped.usage.truncated, true);
  const namespaceGrant = grant({ capabilityId: "namespace-probe" });
  await assert.rejects(
    () => setCapabilityNamespace(db, namespaceGrant, "unicode", { text: "😀".repeat(2100) }),
    /exceeds/,
  );
  for (const bad of [{ loss: undefined }, { bad: NaN }, { bad: () => 1 }, new Date()])
    await assert.rejects(() => setCapabilityNamespace(db, namespaceGrant, "lossy", bad), /JSON/);
  await setCapabilityNamespace(db, namespaceGrant, "private", { ok: true });
  const privateRow = mem.rows("admin_settings").find((r) => String(r.key).endsWith(":private"))!;
  privateRow.is_secret = true;
  await assert.rejects(() => getCapabilityNamespace(db, namespaceGrant, "private"), /Secret/);
  await assert.rejects(() => setCapabilityNamespace(db, namespaceGrant, "private", {}), /Secret/);
  assert.equal(privateRow.is_secret, true);
  // Simulate a concurrent change after the read: neither receipt nor overwrite.
  await setCapabilityNamespace(db, namespaceGrant, "race", { version: 1 });
  const raceKey = "capability:namespace-probe:race";
  const racing = bindTenantDatabase(
    {
      ...raw,
      from: (table: string) => {
        const builder = raw.from(table);
        return new Proxy(builder, {
          get(target, key, receiver) {
            const member = Reflect.get(target, key, receiver);
            if (key === "update" && table === "admin_settings")
              return (...args: unknown[]) => {
                mem.rows(table).find((row) => row.key === raceKey)!.value = JSON.stringify({
                  version: 2,
                });
                return Reflect.apply(member, target, args);
              };
            return typeof member === "function" ? member.bind(target) : member;
          },
        });
      },
    } as SupabaseClient,
    TENANT,
    true,
  );
  await assert.rejects(
    () => setCapabilityNamespace(racing, namespaceGrant, "race", { version: 3 }),
    /concurrently/,
  );
  assert.equal(
    mem.rows("admin_settings").find((row) => row.key === raceKey)!.value,
    JSON.stringify({ version: 2 }),
  );
  const unavailable = new MemorySupabase();
  unavailable.fail("entity_types", { message: "offline" });
  await assert.rejects(
    () =>
      runCapabilityRecipe(bindTenantDatabase(unavailable.client, TENANT, true), graphGrant, {
        recipe: "recent_links",
      }),
    /offline/,
  );

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
        "host-tenant-binding",
        "recipe-entity-grants",
        "graph-endpoint-grants",
        "identifier-injection-refusal",
        "UTF8-and-JSON-bounds",
        "secret-namespace-refusal",
        "namespace-concurrency",
        "truthful-lookahead-usage",
      ],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
