import assert from "node:assert/strict";
import { installAdminDemoRuntime } from "../src/lib/admin/demo/runtime";
import { MemorySupabase } from "./lib/memory-supabase";
import { getRevenueAiTools, validateToolOutput } from "../src/lib/revenue-os/ai-tools";
import {
  applySourceAuthority,
  listSourceAuthorities,
  prepareSourceAuthorityCommand,
  registerSourceAuthority,
  type SourceAuthorityEntry,
} from "../src/lib/revenue-os/source-authority";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { runWithTenantRequestContext, type TenantActorContext } from "../src/lib/tenancy/context";
import { executeRuntimeAction } from "../src/lib/revenue-os/runtime-actions";
import { retrieveKnowledge } from "../src/lib/revenue-os/knowledge";
const tenant = "11111111-1111-4111-8111-111111111111";
const base = {
  systemKey: "canonical_crm",
  displayName: "Canonical CRM",
  truthDomains: ["contact_identity"],
  authorityTier: "official" as const,
  ownerEmail: "owner@example.test",
  lastVerifiedAt: "2026-01-01T00:00:00.000Z",
  verificationLapseDays: 3650,
  expectedVersion: 0,
};
const entry: SourceAuthorityEntry = {
  id: tenant,
  version: 1,
  tenant_id: tenant,
  system_key: "canonical_crm",
  display_name: "Canonical CRM",
  truth_domains: ["contact_identity"],
  authority_tier: "official",
  owner_email: base.ownerEmail,
  last_verified_at: base.lastVerifiedAt,
  verification_lapse_days: 3650,
  applies_to: null,
  request_key: "receipt",
  created_at: base.lastVerifiedAt,
  updated_at: base.lastVerifiedAt,
};
async function verifyDemoRecovery() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { value: storage, configurable: true });
  Object.defineProperty(globalThis, "window", {
    value: {
      location: { origin: "https://demo.example" },
      open() {},
      fetch() {
        throw new Error("Protected network request escaped the demo");
      },
    },
    configurable: true,
  });
  let runtime = installAdminDemoRuntime("northline-roofing");
  const command = { ...base, systemKey: "reviewed_uploads", requestKey: "lost-response" };
  const post = (payload: Record<string, unknown> = command) =>
    window.fetch("/api/admin/source-authority", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  try {
    const response = await post();
    assert.equal(response.status, 200);
    const first = await response.json();
    assert.equal(first.entry.version, 1, "Use the source owner, never a generic demo receipt");
    // The caller loses this reply and reloads the fictional runtime.
    runtime.restore();
    runtime = installAdminDemoRuntime("northline-roofing");
    const recovered = await (await post()).json();
    assert.equal(recovered.replayed, true);
    assert.equal(recovered.auditId, first.auditId);
    assert.equal(recovered.entry.version, 1);
    const later = await (
      await post({
        ...command,
        authorityTier: "approved",
        expectedVersion: 1,
        requestKey: "later-save",
      })
    ).json();
    assert.equal(later.entry.version, 2);
    const earlier = await (await post()).json();
    assert.equal(earlier.entry.version, 1, "A later update cannot mutate the earlier receipt");
    assert.equal(earlier.replayed, true);
    const list = await (await window.fetch("/api/admin/source-authority")).json();
    assert.equal(
      list.entries.filter((item: SourceAuthorityEntry) => item.system_key === command.systemKey)
        .length,
      1,
    );
    assert.equal(
      list.entries.find((item: SourceAuthorityEntry) => item.system_key === command.systemKey)
        .version,
      2,
    );
    assert.equal((await post({ ...command, displayName: "Conflicting request" })).status, 409);
    assert.equal((await post({ ...command, requestKey: "stale-version" })).status, 409);
  } finally {
    runtime.restore();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
}
async function main() {
  await verifyDemoRecovery();
  const querySchema = getRevenueAiTools().find(
    (tool) => tool.name === "search_knowledge_base",
  )!.outputSchema;
  validateToolOutput("search_knowledge_base", querySchema, {
    contract: "fixture",
    found: false,
    query: "fixture",
    chunks: [],
    conflicts: [],
    generatedAt: base.lastVerifiedAt,
    entitySummary: null,
    refusalReason: "No matching evidence",
  });
  assert.throws(
    () =>
      validateToolOutput("search_knowledge_base", querySchema, {
        contract: "fixture",
        found: true,
        query: "fixture",
        chunks: [],
        conflicts: [],
        generatedAt: base.lastVerifiedAt,
        entitySummary: "invalid",
      }),
    /entitySummary/,
  );
  const normalized = prepareSourceAuthorityCommand({
    ...base,
    systemKey: "Canonical_CRM",
    truthDomains: ["contact_identity", "contact_identity"],
  });
  assert.equal(normalized.systemKey, "canonical_crm");
  assert.deepEqual(normalized.truthDomains, ["contact_identity"]);
  assert.deepEqual(normalized, prepareSourceAuthorityCommand(base));
  for (const invalid of [
    null,
    [],
    { ...base, truthDomains: [5] },
    { ...base, appliesTo: { entityTypes: "contact" } },
    { ...base, ownerEmail: "invalid" },
    { ...base, lastVerifiedAt: "infinity" },
    { ...base, expectedVersion: -1 },
    { ...base, tenantId: tenant },
  ])
    assert.throws(() => prepareSourceAuthorityCommand(invalid));
  const mem = new MemorySupabase({
    tenants: [{ id: tenant, status: "active" }],
    tenant_memberships: [{ tenant_id: tenant, user_id: tenant, role: "admin", status: "active" }],
    source_authority_registry: [{ ...entry }],
    companies: [{ id: tenant, name: "Fixture", domain: "fixture.test" }],
    contacts: [],
    opportunities: [],
    activities: [],
  });
  const database = bindTenantDatabaseForTest(mem.client as never, tenant);
  assert.equal((await listSourceAuthorities(database))[0]?.id, tenant);
  await assert.rejects(() => listSourceAuthorities(mem.client as never), /tenant-bound/);
  const actor: TenantActorContext = {
    kind: "actor",
    tenant: { id: tenant, slug: "fixture", name: "Fixture", status: "active", config: {} },
    user: { id: tenant, email: base.ownerEmail },
    role: "admin",
    isPlatformAdmin: false,
    database,
  };
  const oldFetch = globalThis.fetch,
    oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://controlled-source.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "controlled-host-key";
  let calls = 0;
  let errorCode: string | undefined;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(
      String(url),
      "https://controlled-source.example.test/rest/v1/rpc/register_source_authority",
    );
    assert.equal(new Headers(init?.headers).get("x-tenant-id"), tenant);
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.p_actor_id, tenant);
    assert.equal(payload.p_actor_email, base.ownerEmail);
    assert.equal(payload.p_command.expectedVersion, 0);
    if (errorCode)
      return Response.json(
        { code: errorCode, message: "private database diagnostic" },
        { status: 400 },
      );
    return Response.json({
      requestKey: payload.p_request_key,
      entry,
      auditId: tenant,
      replayed: false,
    });
  };
  try {
    const receipt = await runWithTenantRequestContext(actor, () =>
      registerSourceAuthority(database, { ...base, actorEmail: base.ownerEmail }),
    );
    const proposalTool = getRevenueAiTools().find(
      (tool) => tool.name === "register_source_authority",
    )!;
    const proposed = await proposalTool.execute(
      { supabase: database, actorEmail: base.ownerEmail },
      { ...base, appliesTo: { entityTypes: ["contact"] } },
    );
    assert.equal(
      mem.rows("source_authority_registry").length,
      1,
      "proposal never changes source trust",
    );
    const queued = mem.rows("action_queue")[0]!;
    assert.equal(queued.status, "pending");
    const approvedPayload = queued.payload as Record<string, unknown>;
    assert.ok(approvedPayload.requestKey);
    assert.deepEqual(approvedPayload.appliesTo, { entityTypes: ["contact"] });
    assert.equal(approvedPayload.expectedVersion, 0);
    assert.ok(proposed);
    await runWithTenantRequestContext(actor, () =>
      executeRuntimeAction(database, "register_source_authority", approvedPayload, base.ownerEmail),
    );
    assert.equal(calls, 2, "reviewed execution uses the same verified host command");
    assert.equal(receipt.auditId, tenant);
    assert.equal(calls, 2);
    assert.equal(mem.rpcCalls.length, 0);
    errorCode = "XX000";
    await assert.rejects(
      runWithTenantRequestContext(actor, () =>
        registerSourceAuthority(database, { ...base, actorEmail: base.ownerEmail }),
      ),
      /Save is unconfirmed/,
    );
    errorCode = "40001";
    await assert.rejects(
      runWithTenantRequestContext(actor, () =>
        registerSourceAuthority(database, { ...base, actorEmail: base.ownerEmail }),
      ),
      /source changed/,
    );
    errorCode = "55000";
    await assert.rejects(
      runWithTenantRequestContext(actor, () =>
        registerSourceAuthority(database, { ...base, actorEmail: base.ownerEmail }),
      ),
      /audit history/,
    );
    const before = calls;
    await assert.rejects(
      runWithTenantRequestContext(actor, () =>
        registerSourceAuthority(database, { ...base, actorEmail: "forged@example.test" }),
      ),
    );
    mem.tables.tenant_memberships![0]!.status = "revoked";
    await assert.rejects(
      runWithTenantRequestContext(actor, () =>
        registerSourceAuthority(database, { ...base, actorEmail: base.ownerEmail }),
      ),
    );
    assert.equal(calls, before, "revoked or forged actors never reach the host");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
  const chunk = {
    source: "canonical_record",
    entityType: "contact",
    entityId: tenant,
    content: "Title: VP",
    occurredAt: base.lastVerifiedAt,
  };
  const index = new Map([
    ["canonical_crm", entry],
    [
      "conversations",
      { ...entry, system_key: "conversations", authority_tier: "working" as const },
    ],
  ]);
  const tagged = applySourceAuthority(
    [
      chunk,
      { ...chunk, source: "conversation", content: "Title: intern" },
      { ...chunk, source: "unknown" },
    ],
    index,
  );
  assert.equal(tagged.chunks[0]?.authorityTier, "official");
  assert.equal(tagged.conflicts.length, 1);
  assert.match(tagged.conflicts[0]!.detail, /Potential conflict/);
  assert.match(tagged.conflicts[0]!.detail, /neither is auto-resolved/);
  assert.equal(tagged.chunks.find((x) => x.systemKey === "unknown")?.current, false);
  const stale = applySourceAuthority(
    [chunk],
    new Map([["canonical_crm", { ...entry, verification_lapse_days: 1 }]]),
  );
  assert.equal(stale.chunks[0]?.stale, true);
  assert.equal(stale.chunks[0]?.current, false);
  const restricted = new Map([
    [
      "canonical_crm",
      { ...entry, applies_to: { entityTypes: ["company"], coworkerIds: ["reviewer"] } },
    ],
  ]);
  assert.equal(applySourceAuthority([chunk], restricted).chunks[0]?.authorityTier, "low");
  assert.equal(
    applySourceAuthority([{ ...chunk, entityType: "company", coworkerId: "reviewer" }], restricted)
      .chunks[0]?.authorityTier,
    "official",
  );
  assert.equal(
    applySourceAuthority(
      [{ ...chunk, source: "document", systemKey: "uploads" }],
      new Map([["drive", entry]]),
    ).chunks[0]?.authorityTier,
    "low",
  );
  const result = await retrieveKnowledge(database, { domain: "fixture.test" });
  assert.equal(
    result.chunks.find((x) => x.source === "canonical_record")?.authorityTier,
    "official",
  );
  assert.ok(Array.isArray(result.conflicts));
  mem.fail("source_authority_registry", { message: "private failure" });
  const unavailable = await retrieveKnowledge(database, { domain: "fixture.test" });
  assert.ok(unavailable.missing?.some((x) => x.includes("Source authority is unavailable")));
  assert.ok(unavailable.chunks.every((x) => !x.current && x.authorityTier === "low"));
  const tools = getRevenueAiTools();
  const proposal = tools.find((x) => x.name === "register_source_authority")!;
  assert.equal(proposal.confirmationRequired, true);
  assert.equal(proposal.impact, "internal_write");
  const properties = proposal.inputSchema.properties as Record<string, unknown>;
  assert.ok(properties.appliesTo);
  assert.ok(properties.expectedVersion);
  assert.equal(tools.find((x) => x.name === "list_source_authorities")?.impact, "read");
  console.log(
    JSON.stringify({
      result: "passed",
      checks:
        "demo routing and immutable recovery after reload, normalization, verified host boundary, redacted failures, scopes, stale and conflicting retrieval, grounded search and agent proposal discovery",
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
