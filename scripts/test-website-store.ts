import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemorySupabase } from "./lib/memory-supabase";
import { websiteFixture } from "./lib/website-fixture";
import { selectPublicWebsite } from "../src/lib/site-studio/website-public";
import { assertWebsiteOwner, writeWebsite } from "../src/lib/site-studio/website-store";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/constants";
import type { AdminAuthorization } from "../src/lib/admin/auth";

async function main() {
  const tenant = ACCELERATE_TENANT_ID,
    foreign = randomUUID();
  const draft = randomUUID(),
    published = randomUUID();
  const database = new MemorySupabase({
    tenants: [{ id: tenant, status: "active" }],
    site_websites: [
      {
        tenant_id: tenant,
        draft_revision_id: draft,
        published_revision_id: published,
        has_published: true,
      },
    ],
    site_website_revisions: [
      {
        tenant_id: tenant,
        id: draft,
        document: {
          ...websiteFixture,
          identity: { name: "PRIVATE DRAFT", tagline: "Never public" },
        },
      },
      {
        tenant_id: foreign,
        id: published,
        document: {
          ...websiteFixture,
          identity: { name: "FOREIGN PRIVATE", tagline: "Never public" },
        },
      },
      { tenant_id: tenant, id: published, document: websiteFixture },
    ],
  });
  assert.deepEqual(await selectPublicWebsite(database.client as never), {
    mode: "published",
    revisionId: published,
    document: websiteFixture,
  });
  database.tables.site_websites![0]!.published_revision_id = null;
  assert.deepEqual(await selectPublicWebsite(database.client as never), { mode: "unpublished" });
  database.tables.site_websites![0]!.has_published = false;
  assert.deepEqual(await selectPublicWebsite(database.client as never), { mode: "bootstrap" });
  database.tables.site_websites![0]!.published_revision_id = randomUUID();
  assert.deepEqual(await selectPublicWebsite(database.client as never), { mode: "unavailable" });
  database.tables.site_websites = [];
  assert.deepEqual(await selectPublicWebsite(database.client as never), { mode: "bootstrap" });
  database.fail("site_websites", { message: "Database unavailable" });
  assert.deepEqual(await selectPublicWebsite(database.client as never), { mode: "unavailable" });
  database.recover("site_websites");
  database.tables.tenants![0]!.status = "suspended";
  assert.deepEqual(await selectPublicWebsite(database.client as never), { mode: "unavailable" });

  const auth: AdminAuthorization = {
    kind: "actor",
    isPlatformAdmin: true,
    role: "admin",
    user: { id: randomUUID(), email: "owner@example.test" },
    tenant: {
      id: tenant,
      slug: "accelerate",
      name: "Workshop",
      status: "active",
      config: { modules: { "site-studio": true } },
    },
    database: bindTenantDatabaseForTest(database.client as never, tenant),
  };
  assert.doesNotThrow(() => assertWebsiteOwner(auth));
  assert.throws(
    () => assertWebsiteOwner({ ...auth, isPlatformAdmin: false }),
    /installation owner/,
  );
  assert.throws(
    () => assertWebsiteOwner({ ...auth, tenant: { ...auth.tenant, id: foreign } }),
    /installation owner/,
  );
  assert.throws(
    () => assertWebsiteOwner({ ...auth, tenant: { ...auth.tenant, status: "suspended" } }),
    /installation owner/,
  );
  assert.throws(
    () => assertWebsiteOwner({ ...auth, tenant: { ...auth.tenant, config: {} } }),
    /disabled/,
  );
  const key = randomUUID();
  database.rpc("write_site_website", (args) => {
    assert.equal(args.p_actor_email, auth.user.email);
    assert.equal(args.p_revision_id, null);
    assert.deepEqual(args.p_document, websiteFixture);
    return {
      requestKey: key,
      operation: "save",
      version: 1,
      draftRevisionId: draft,
      publishedRevisionId: null,
      previousPublishedRevisionId: null,
      createdAt: new Date().toISOString(),
    };
  });
  assert.equal(
    (
      await writeWebsite(auth, {
        operation: "save",
        requestKey: key,
        expectedVersion: 0,
        document: websiteFixture,
      })
    ).version,
    1,
  );
  await assert.rejects(
    writeWebsite(
      { ...auth, isPlatformAdmin: false },
      { operation: "unpublish", requestKey: randomUUID(), expectedVersion: 1 },
    ),
    /installation owner/,
  );
  assert.equal(database.rpcCalls.length, 1);
  console.log(
    "PASS: public selector never returns drafts or foreign revisions, explicit unpublish cannot resurrect bootstrap, storage failures fail closed, and only the enabled installation owner can reach website writes.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
