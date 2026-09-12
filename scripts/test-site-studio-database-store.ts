import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { DatabaseSiteDraftRepository } from "../src/lib/site-studio/database-store";
import { servicePageTemplate } from "../src/lib/site-studio/templates";
import { withSiteHostTransport } from "./lib/site-host-fixture";
import type { AdminAuthorization } from "../src/lib/admin/auth";
import { draftChecksum } from "../src/lib/site-studio/store";

async function main() {
  const tenant = randomUUID(),
    other = randomUUID(),
    id = randomUUID();
  const doc = servicePageTemplate({
    serviceName: "Inspection",
    audience: "Property owners",
    outcome: "Review a report",
  });
  const snapshot = {
    id,
    slug: doc.metadata.slug,
    title: doc.metadata.title,
    document: doc,
    source: "template",
    status: "draft",
    version: 1,
    checksum: draftChecksum(doc),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const mem = new MemorySupabase({
    tenants: [{ id: tenant, status: "active", config: { modules: { "site-studio": true } } }],
    site_drafts: [
      { id, tenant_id: tenant, draft: snapshot, discarded_at: null },
      {
        id: randomUUID(),
        tenant_id: other,
        draft: { ...snapshot, title: "Foreign secret" },
        discarded_at: null,
      },
    ],
  });
  const actor: AdminAuthorization = {
    kind: "actor",
    isPlatformAdmin: false,
    role: "admin",
    user: { id: randomUUID(), email: "owner@example.test" },
    tenant: {
      id: tenant,
      slug: "fixture",
      name: "Fixture",
      status: "active",
      config: { modules: { "site-studio": true } },
    },
    database: bindTenantDatabaseForTest(mem.client as never, tenant),
  };
  mem.tables.tenant_memberships = [
    { tenant_id: tenant, user_id: actor.user.id, role: "admin", status: "active" },
  ];
  assert.throws(
    () => new DatabaseSiteDraftRepository({ ...actor, database: mem.client as never }),
    /tenant-bound/,
  );
  const repo = new DatabaseSiteDraftRepository(actor);
  assert.equal((await repo.list()).length, 1);
  assert.equal((await repo.get(id))?.title, snapshot.title);
  let writes = 0;
  mem.rpc("write_site_draft", (args) => {
    writes++;
    assert.equal(args.p_actor_email, "owner@example.test");
    assert.equal(args.p_operation, "revise");
    assert.equal(args.p_expected_checksum, snapshot.checksum);
    assert.equal(args.p_id, id);
    assert.equal(Object.hasOwn(args.p_draft as object, "expectedChecksum"), false);
    return { ...(args.p_draft as object), version: 2 };
  });
  const result = await withSiteHostTransport(mem, actor, () =>
    repo.save({
      id,
      expectedChecksum: snapshot.checksum,
      title: snapshot.title,
      slug: snapshot.slug,
      document: doc,
      source: "template",
    }),
  );
  assert.equal(result.version, 2);
  assert.equal(writes, 1);
  mem.tables.tenants![0]!.config = { modules: { "site-studio": false } };
  await assert.rejects(() => repo.list(), /disabled/);
  await assert.rejects(
    () =>
      repo.save({ title: snapshot.title, slug: snapshot.slug, document: doc, source: "template" }),
    /disabled/,
  );
  assert.equal(writes, 1);
  console.log(
    "PASS: production Site Studio adapter scope, transport envelope, returned revision and disabled-module refusal (controlled database transport).",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
