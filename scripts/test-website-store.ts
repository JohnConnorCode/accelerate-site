import "next/dist/server/node-environment-baseline";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemorySupabase } from "./lib/memory-supabase";
import { websiteFixture } from "./lib/website-fixture";
import { selectPublicWebsite } from "../src/lib/site-studio/website-public";
import { assertWebsiteOwner, writeWebsite } from "../src/lib/site-studio/website-store";
import { withSiteHostTransport } from "./lib/site-host-fixture";
import { runWithTenantRequestContext } from "../src/lib/tenancy/context";
import { bindTenantDatabaseForTest, callWebsiteRpc } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/constants";
import type { AdminAuthorization } from "../src/lib/admin/auth";
import {
  workAsyncStorage,
  type WorkStore,
} from "next/dist/server/app-render/work-async-storage.external";
import { PUBLIC_WEBSITE_TAG } from "../src/lib/site-studio/website-public";

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
  database.tables.tenants![0]!.status = "active";
  database.tables.tenant_memberships = [
    { tenant_id: tenant, user_id: auth.user.id, role: "admin", status: "active" },
  ];
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
      await withSiteHostTransport(database, auth, () =>
        runWithTenantRequestContext(
          { kind: "system", tenantId: foreign, tenantSlug: "other", source: "unrelated-context" },
          () =>
            writeWebsite(auth, {
              operation: "save",
              requestKey: key,
              expectedVersion: 0,
              document: websiteFixture,
            }),
        ),
      )
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
  await assert.rejects(
    callWebsiteRpc(auth.database, { p_actor_email: "forged@example.test" }, auth),
    /verified identity/,
  );
  await assert.rejects(
    callWebsiteRpc(
      auth.database,
      { p_actor_email: auth.user.email },
      { ...auth, database: bindTenantDatabaseForTest(database.client as never, foreign) },
    ),
    /context mismatch/,
  );
  database.tables.tenant_memberships![0]!.status = "revoked";
  await assert.rejects(
    callWebsiteRpc(auth.database, { p_actor_email: auth.user.email }, auth),
    /current active admin/,
  );
  database.tables.tenant_memberships![0]!.status = "active";
  database.tables.tenants![0]!.status = "suspended";
  await assert.rejects(
    callWebsiteRpc(auth.database, { p_actor_email: auth.user.email }, auth),
    /current active admin/,
  );
  assert.equal(database.rpcCalls.length, 1);
  database.tables.tenants![0]!.status = "active";
  database.rpc("write_site_website", (args) => ({
    requestKey: args.p_request_key,
    operation: args.p_operation,
    version: 2,
    draftRevisionId: draft,
    publishedRevisionId: args.p_operation === "unpublish" ? null : published,
    previousPublishedRevisionId: published,
    createdAt: new Date().toISOString(),
  }));
  // Exercise Next's real invalidation recording through the shared writer,
  // including callers that do not enter through the website HTTP route.
  for (const operation of ["save", "publish", "rollback", "unpublish"] as const) {
    const store = { incrementalCache: {} } as WorkStore;
    const command = {
      operation,
      requestKey: randomUUID(),
      expectedVersion: 1,
      ...(operation === "save" ? { document: websiteFixture } : {}),
      ...(operation === "rollback" || operation === "publish" ? { revisionId: published } : {}),
    };
    const write = () => withSiteHostTransport(database, auth, () => writeWebsite(auth, command));
    await workAsyncStorage.run(store, write);
    if (operation === "save") assert.equal(store.pendingRevalidatedTags, undefined);
    else {
      assert.ok(
        store.pendingRevalidatedTags?.some(
          (entry) =>
            entry.tag === PUBLIC_WEBSITE_TAG &&
            typeof entry.profile === "object" &&
            entry.profile.expire === 0,
        ),
        `${operation}: the next public read must block for fresh publication`,
      );
      assert.ok(
        store.pendingRevalidatedTags?.some((entry) => entry.tag.includes("/(marketing)/layout")),
        `${operation}: refresh public layouts as well as the data cache`,
      );
      // Retrying the same receipt still refreshes public output.
      assert.equal((await workAsyncStorage.run(store, write)).requestKey, command.requestKey);
    }
  }
  const invalidStore = { incrementalCache: {} } as WorkStore;
  await assert.rejects(
    workAsyncStorage.run(invalidStore, () =>
      writeWebsite(auth, {
        operation: "unpublish",
        requestKey: "invalid",
        expectedVersion: 1,
      }),
    ),
  );
  assert.equal(invalidStore.pendingRevalidatedTags, undefined);
  const warning = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args) => {
    warnings.push(args);
  };
  try {
    // No Next request context: refresh fails after commit, never the write.
    const receipt = await withSiteHostTransport(database, auth, () =>
      writeWebsite(auth, {
        operation: "unpublish",
        requestKey: randomUUID(),
        expectedVersion: 1,
      }),
    );
    assert.equal(receipt.operation, "unpublish");
    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0]![0]), /committed; public cache refresh unavailable/);
  } finally {
    console.warn = warning;
  }
  database.rpc("write_site_website", () => {
    throw new Error("Controlled storage failure");
  });
  const failedStore = { incrementalCache: {} } as WorkStore;
  await assert.rejects(
    workAsyncStorage.run(failedStore, () =>
      withSiteHostTransport(database, auth, () =>
        writeWebsite(auth, {
          operation: "unpublish",
          requestKey: randomUUID(),
          expectedVersion: 1,
        }),
      ),
    ),
  );
  assert.equal(failedStore.pendingRevalidatedTags, undefined);
  console.log(
    "PASS: public selection and owner authorization fail closed; publication and replay invalidate public caches, draft saves do not, and refresh failure preserves committed receipts.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
