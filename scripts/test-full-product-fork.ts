import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { distributionProfile } from "../src/lib/distribution/profile";
import { isAgencyAsset, isAgencyPage } from "../src/lib/distribution/routes";
import { createNeutralWebsite } from "../src/lib/site-studio/neutral-website";
import { createBundledWebsite } from "../src/lib/site-studio/website-seed";
import { parseWebsiteDocument } from "../src/lib/site-studio/website-document";
import { assertWebsiteForms, websiteFormTokens } from "../src/lib/site-studio/website-forms";
import { websiteTextFields } from "../src/lib/site-studio/website-authoring";
import { middleware } from "../src/middleware";
import { POST as recordAnalytics } from "../src/app/api/analytics/events/route";
import { tenant } from "../src/config/tenant";
import { buildSearchIndex } from "../src/lib/search";
import { validateWebsiteCommandForms } from "../src/lib/site-studio/website-store";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/constants";
import { MemorySupabase } from "./lib/memory-supabase";
import type { AdminAuthorization } from "../src/lib/admin/auth";

async function main() {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const event = {
    eventId: crypto.randomUUID(),
    visitorId: crypto.randomUUID(),
    name: "cta_click",
    path: "/",
  };
  const request = (body: unknown = event, origin = "http://localhost") =>
    new NextRequest("http://localhost/api/analytics/events", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  let writes = 0;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    globalThis.fetch = async () => {
      writes++;
      throw new Error("Unexpected external request");
    };
    assert.equal((await recordAnalytics(request({}, "https://foreign.example"))).status, 403);
    assert.equal((await recordAnalytics(request({}))).status, 400);
    const absent = await recordAnalytics(request());
    assert.equal(absent.status, 202);
    assert.deepEqual(await absent.json(), { accepted: false, reason: "not_configured" });
    assert.equal(writes, 0);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://database.example";
    assert.deepEqual(await (await recordAnalytics(request())).json(), {
      accepted: false,
      reason: "not_configured",
    });
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
    globalThis.fetch = async (_url, init) => {
      writes++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.event_id, event.eventId);
      assert.equal(body.tenant_id, ACCELERATE_TENANT_ID);
      assert.match(
        String(init?.headers && new Headers(init.headers).get("prefer")),
        /resolution=ignore-duplicates/,
      );
      return new Response(null, { status: 201 });
    };
    assert.deepEqual(await (await recordAnalytics(request())).json(), { accepted: true });
    assert.deepEqual(await (await recordAnalytics(request())).json(), { accepted: true });
    assert.equal(writes, 2, "Replay uses the same event identity and database deduplication");
    console.error = () => undefined;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "Controlled unavailable database" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    assert.deepEqual(await (await recordAnalytics(request())).json(), { accepted: false });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "invalid-url";
    assert.deepEqual(
      await (await recordAnalytics(request())).json(),
      { accepted: false },
      "Client construction errors also degrade without a 500",
    );
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
  assert.equal(distributionProfile({}), "neutral");
  assert.equal(distributionProfile({ NEXT_PUBLIC_DISTRIBUTION_PROFILE: "branded" }), "branded");
  assert.doesNotMatch(JSON.stringify(tenant), /acceleratewith|John Connor|john-accelerate/i);
  assert.equal(tenant.capabilities.publicBooking, false);
  assert.ok(
    buildSearchIndex().every(
      (entry) =>
        entry.group === "Docs" || entry.href === "/" || entry.href === "/demo/command-center",
    ),
  );
  const document = createNeutralWebsite();
  assert.deepEqual(createBundledWebsite(), document);
  assert.equal(document.pages[0]!.content.kind, "document");
  assert.doesNotMatch(JSON.stringify(document), /acceleratewith|John Connor|\/images\//i);
  for (const path of [
    "/about",
    "/services",
    "/team/john-connor",
    "/learn/example",
    "/work/example",
    "/%61bout",
  ])
    assert.equal(isAgencyPage(path), true, path);
  for (const path of [
    "/admin",
    "/docs",
    "/demo/command-center",
    "/f/token",
    "/api/public/forms/token",
    "/site-assets/photo.jpg",
  ])
    assert.equal(isAgencyPage(path), false, path);
  for (const path of [
    "/images/john.jpg",
    "/work/example/image.webp",
    "/logo.png",
    "/%69mages/john.jpg",
  ])
    assert.equal(isAgencyAsset(path), true, path);
  assert.equal(isAgencyAsset("/site-assets/photo.jpg"), false);
  const root = "http://localhost:3000";
  const about = await middleware(new NextRequest(`${root}/about`));
  assert.equal(new URL(about.headers.get("x-middleware-rewrite")!).pathname, "/site-pages/about");
  assert.equal((await middleware(new NextRequest(`${root}/images/john.jpg`))).status, 404);
  assert.equal(
    (await middleware(new NextRequest(`${root}/_next/image?url=%2Fimages%2Fjohn.jpg&w=640&q=75`)))
      .status,
    404,
  );
  assert.equal(
    (await middleware(new NextRequest(`${root}/docs`))).headers.get("x-middleware-rewrite"),
    null,
  );
  assert.throws(() =>
    parseWebsiteDocument({
      ...document,
      pages: [{ ...document.pages[0], path: "/site-pages/about" }],
    }),
  );
  const token = "a".repeat(64);
  const page = document.pages[0]!;
  assert.equal(page.content.kind, "document");
  if (page.content.kind !== "document") throw new Error("Expected editable homepage");
  page.content.document.root.push({
    id: "inquiry",
    type: "section",
    children: [{ id: "inquiry-form", type: "form", props: { token, heading: "Get in touch" } }],
  });
  parseWebsiteDocument(document);
  assert.deepEqual(websiteFormTokens(document), [token]);
  assert.ok(websiteTextFields(page).every((field) => field.value !== token));
  const form = {
    id: "form",
    tenantId: "owner",
    schema: { elements: [{ name: "email", type: "text" as const }] },
    name: "Contact",
    description: "Controlled form fixture",
  };
  await assertWebsiteForms(document, "owner", async () => form);
  await assert.rejects(
    assertWebsiteForms(document, "other", async () => form),
    /published form from this workspace/,
  );
  await assert.rejects(
    assertWebsiteForms(document, "owner", async () => null),
    /published form from this workspace/,
  );
  await assert.rejects(
    assertWebsiteForms(document, "owner", async () => {
      throw new Error("offline");
    }),
    /offline/,
  );
  await assertWebsiteForms(createNeutralWebsite(), "owner", async () => {
    throw new Error("Unused providers must not be contacted");
  });
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const requestKey = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const auth: AdminAuthorization = {
    kind: "actor",
    isPlatformAdmin: true,
    role: "admin",
    user: { id: crypto.randomUUID(), email: "owner@example.test" },
    tenant: {
      id: ACCELERATE_TENANT_ID,
      slug: "owner",
      name: "Owner",
      status: "active",
      config: {},
    },
    database: bindTenantDatabaseForTest(new MemorySupabase().client as never, ACCELERATE_TENANT_ID),
  };
  let replay = false,
    published = true,
    enabled = true,
    foreign = false,
    formReads = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://website-form-fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "controlled-website-form-key";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "website-form-fixture.supabase.co");
    const table = url.pathname.split("/").at(-1);
    if (table === "site_website_revisions") {
      assert.equal(url.searchParams.get("tenant_id"), `eq.${auth.tenant.id}`);
      assert.equal(url.searchParams.get("id"), `eq.${revisionId}`);
      return Response.json([{ document }]);
    }
    if (table === "site_website_receipts") {
      assert.equal(url.searchParams.get("tenant_id"), `eq.${auth.tenant.id}`);
      assert.equal(url.searchParams.get("request_key"), `eq.${requestKey}`);
      return Response.json(replay ? [{ request_key: requestKey }] : []);
    }
    if (table === "form_definitions") {
      formReads++;
      assert.equal(url.searchParams.get("share_token"), `eq.${token}`);
      return Response.json([
        {
          ...form,
          tenant_id: foreign ? crypto.randomUUID() : auth.tenant.id,
          status: published ? "published" : "archived",
        },
      ]);
    }
    assert.equal(table, "tenants");
    return Response.json([{ status: "active", config: { modules: { "form-builder": enabled } } }]);
  };
  try {
    const save = { operation: "save" as const, requestKey, expectedVersion: 0, document };
    await validateWebsiteCommandForms(auth, save);
    await validateWebsiteCommandForms(auth, {
      operation: "publish",
      requestKey,
      expectedVersion: 1,
      revisionId,
    });
    await validateWebsiteCommandForms(auth, {
      operation: "rollback",
      requestKey,
      expectedVersion: 2,
      revisionId,
    });
    published = false;
    await assert.rejects(
      validateWebsiteCommandForms(auth, save),
      /published form from this workspace/,
    );
    replay = true;
    const readsBeforeRetry = formReads;
    await validateWebsiteCommandForms(auth, save);
    assert.equal(
      formReads,
      readsBeforeRetry,
      "A completed retry reaches the atomic writer without rechecking archived forms",
    );
    replay = false;
    published = true;
    enabled = false;
    await assert.rejects(
      validateWebsiteCommandForms(auth, save),
      /published form from this workspace/,
    );
    enabled = true;
    foreign = true;
    await assert.rejects(
      validateWebsiteCommandForms(auth, save),
      /published form from this workspace/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
  console.log(
    "Full-product fork: neutral defaults, shared seed, route/asset isolation, reserved paths, form ownership/unavailability, and protected AI bindings passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
