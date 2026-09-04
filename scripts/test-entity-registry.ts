import assert from "node:assert/strict";
import {
  getEntityType,
  linkEntities,
  mergeEntities,
  registerEntityType,
  softDeleteValue,
  traverseGraph,
} from "../src/lib/revenue-os/entity-registry";
import { MemorySupabase } from "./lib/memory-supabase";

const TENANT = "tenant-a";
const FOREIGN = "tenant-b";

function seed(mem: MemorySupabase) {
  mem.tables.webinars = [
    { id: "w1", tenant_id: TENANT, title: "Intro call recording" },
    { id: "w2", tenant_id: TENANT, title: "Intro call recording (duplicate import)" },
  ];
  mem.tables.webinar_rsvps = [
    { id: "r1", tenant_id: TENANT, webinar_id: "w2", email: "alex@example.com" },
  ];
  mem.tables.contacts = [{ id: "c1", tenant_id: TENANT, primary_email: "alex@example.com" }];
}

async function main() {
  const mem = new MemorySupabase({});
  seed(mem);
  const db = mem.client as never;

  // 1. Runtime type registration: a type the code has never seen.
  const webinar = await registerEntityType(db, {
    tenantId: TENANT,
    typeKey: "webinar",
    label: "Webinar",
    backingTable: "webinars",
    fkCatalog: [{ table: "webinar_rsvps", column: "webinar_id" }],
    identityFields: ["title"],
    softDeleteColumn: "archived_at:now",
  });
  assert.equal(webinar.typeKey, "webinar");
  assert.equal((await getEntityType(db, TENANT, "webinar"))?.label, "Webinar");
  // Re-registration is an idempotent refresh, not a duplicate. The
  // declaration replaces wholesale, so a complete re-registration keeps
  // every convention it still declares.
  await registerEntityType(db, {
    tenantId: TENANT,
    typeKey: "webinar",
    label: "Webinar (renamed)",
    backingTable: "webinars",
    fkCatalog: [{ table: "webinar_rsvps", column: "webinar_id" }],
    identityFields: ["title"],
    softDeleteColumn: "archived_at:now",
  });
  assert.equal(
    mem.rows("entity_types").filter((r) => r.type_key === "webinar").length,
    1,
    "re-registration must not duplicate the type row",
  );
  assert.equal((await getEntityType(db, TENANT, "webinar"))?.label, "Webinar (renamed)");

  const contact = await registerEntityType(db, {
    tenantId: TENANT,
    typeKey: "contact",
    label: "Contact",
    backingTable: "contacts",
    identityFields: ["primary_email"],
    softDeleteColumn: "archived_at:now",
  });
  assert.ok(contact);

  // 2. Tuple idempotency: repeated links are no-ops, never duplicates.
  const first = await linkEntities(db, {
    tenantId: TENANT,
    sourceType: "webinar",
    sourceId: "w1",
    targetType: "contact",
    targetId: "c1",
    linkType: "attended_by",
  });
  const second = await linkEntities(db, {
    tenantId: TENANT,
    sourceType: "webinar",
    sourceId: "w1",
    targetType: "contact",
    targetId: "c1",
    linkType: "attended_by",
  });
  assert.equal(first.link.id, second.link.id, "replayed link must resolve to the same edge");
  assert.equal(
    mem.rows("entity_links").length,
    1,
    "tuple writes must be idempotent no-ops",
  );
  // Same pair under a different link type is a distinct fact.
  await linkEntities(db, {
    tenantId: TENANT,
    sourceType: "webinar",
    sourceId: "w1",
    targetType: "contact",
    targetId: "c1",
    linkType: "invited",
  });
  assert.equal(mem.rows("entity_links").length, 2);

  // 3. Cross-tenant refusal: tenant B cannot use tenant A's namespace.
  await assert.rejects(
    () =>
      linkEntities(db, {
        tenantId: FOREIGN,
        sourceType: "webinar",
        sourceId: "w1",
        targetType: "contact",
        targetId: "c1",
      }),
    /Unknown entity type/,
    "cross-tenant links must fail closed on type resolution",
  );
  assert.equal(
    mem.rows("entity_links").filter((r) => r.tenant_id === FOREIGN).length,
    0,
    "no foreign-tenant edge may be written",
  );

  // 4. Bounded traversal: cycles terminate, depth is honored.
  await linkEntities(db, {
    tenantId: TENANT,
    sourceType: "contact",
    sourceId: "c1",
    targetType: "webinar",
    targetId: "w1",
  });
  const depth1 = await traverseGraph(db, {
    tenantId: TENANT,
    startType: "webinar",
    startId: "w1",
    maxDepth: 1,
  });
  assert.ok(depth1.nodes.some((n) => n.type === "contact" && n.id === "c1"));
  assert.ok(depth1.edges.length >= 1);
  const unbounded = await traverseGraph(db, {
    tenantId: TENANT,
    startType: "webinar",
    startId: "w1",
    maxDepth: 99,
  });
  assert.ok(
    unbounded.nodes.length <= 4,
    "visited tracking must terminate cycles instead of walking forever",
  );
  const edgeIds = new Set(
    unbounded.edges.map((e) => `${e.from.type}:${e.from.id}:${e.to.type}:${e.to.id}:${e.linkType}`),
  );
  assert.equal(
    edgeIds.size,
    unbounded.edges.length,
    "bidirectional walking must not report the same stored edge twice",
  );
  assert.equal(unbounded.edges.length, 3, "all three distinct edges surface exactly once");

  // 5. Generic merge on the runtime-registered type: links rewire, the FK
  // catalog reassigns, the loser retires through its declared convention,
  // and an audit receipt lands. Zero code changes for the new type.
  const merged = await mergeEntities(db, {
    tenantId: TENANT,
    typeKey: "webinar",
    winnerId: "w1",
    loserId: "w2",
    actorEmail: "founder@example.com",
    reason: "duplicate import",
  });
  assert.equal(merged.winnerId, "w1");
  const rsvp = mem.rows("webinar_rsvps").find((r) => r.id === "r1");
  assert.equal(rsvp?.webinar_id, "w1", "fk_catalog references must reassign");
  const loser = mem.rows("webinars").find((r) => r.id === "w2");
  assert.ok(
    typeof loser?.archived_at === "string",
    "loser must retire through archived_at:now",
  );
  assert.ok(
    mem.rows("audit_log").some((r) => r.action === "entity.merged"),
    "merge must leave an audit receipt",
  );
  // Retry-safe: a second run reports convergence instead of minting a
  // duplicate audit receipt for one business action.
  const linksBefore = mem.rows("entity_links").length;
  const auditsBefore = mem.rows("audit_log").length;
  const retry = await mergeEntities(db, {
    tenantId: TENANT,
    typeKey: "webinar",
    winnerId: "w1",
    loserId: "w2",
    actorEmail: "founder@example.com",
  });
  assert.equal(retry.alreadyMerged, true);
  assert.equal(retry.movedLinks, 0);
  assert.equal(mem.rows("entity_links").length, linksBefore);
  assert.equal(mem.rows("audit_log").length, auditsBefore, "no duplicate receipt on retry");

  // 6. Merge refuses without a declared retire convention.
  await registerEntityType(db, {
    tenantId: TENANT,
    typeKey: "note",
    label: "Note",
    backingTable: "webinars",
  });
  await assert.rejects(
    () =>
      mergeEntities(db, {
        tenantId: TENANT,
        typeKey: "note",
        winnerId: "w1",
        loserId: "w2",
        actorEmail: "founder@example.com",
      }),
    /soft_delete_column/,
    "merge without a retire convention must refuse loudly",
  );

  // 7. Soft-delete marker conventions are explicit, never guessed.
  assert.deepEqual(softDeleteValue("archived"), { column: "archived", value: true });
  assert.equal(softDeleteValue("archived_at:now").column, "archived_at");
  assert.throws(() => softDeleteValue("archived_at:someday"), /Unsupported/);

  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "runtime-type-registration",
        "tuple-idempotency",
        "cross-tenant-refusal",
        "bounded-traversal",
        "generic-merge-with-receipt",
        "merge-retry-converges",
        "missing-convention-refusal",
        "soft-delete-conventions",
      ],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
