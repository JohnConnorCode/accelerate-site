import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { encryptTenantSecret } from "../src/lib/revenue-os/encryption";
import {
  tenantPostizClient,
  postizAdapter,
  postizOrigin,
  PostizError,
} from "../src/lib/revenue-os/postiz-adapter";
import { prepareSocialWeek } from "../src/lib/revenue-os/social-marketing";
import { socialDraftSchema } from "../src/lib/revenue-os/social-marketing-contract";
async function main() {
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222";
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-social-fixture-encryption-only";
  process.env.POSTIZ_ORIGIN = "https://postiz.example.test";
  const secretA = "organization-a-key-for-controlled-test",
    secretB = "organization-b-key-for-controlled-test";
  const connections: Record<
    string,
    {
      status: string;
      credential_version: number;
      account_email: string;
      encrypted_credentials: { api_key: string };
    }
  > = Object.fromEntries(
    [
      [a, secretA],
      [b, secretB],
    ].map(([tenant, key], i) => [
      tenant!,
      {
        status: "connected",
        credential_version: 1,
        account_email: `org-${i}`,
        encrypted_credentials: { api_key: encryptTenantSecret(key!, tenant!, "postiz", "api_key") },
      },
    ]),
  );
  const configs: Record<
    string,
    { status: string; config: { modules: Record<string, boolean> }; updated_at: string }
  > = Object.fromEntries(
    [a, b].map((tenant) => [
      tenant,
      {
        status: "active",
        config: { modules: { "social-marketing": true } },
        updated_at: "2026-09-12T00:00:00Z",
      },
    ]),
  );
  function database(tenant: string) {
    return bindTenantDatabase(
      {
        from(table: string) {
          const filters: Record<string, unknown> = {};
          const builder = {
            select() {
              return builder;
            },
            eq(k: string, v: unknown) {
              filters[k] = v;
              return builder;
            },
            maybeSingle: async () => ({
              data: structuredClone(
                filters.tenant_id && filters.tenant_id !== tenant
                  ? null
                  : table === "tenants"
                    ? configs[tenant]
                    : connections[tenant],
              ),
              error: null,
            }),
          };
          return Object.assign(builder, { single: builder.maybeSingle });
        },
      } as unknown as SupabaseClient,
      tenant,
      true,
    );
  }
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string; key: string }[] = [];
  let timeout = false,
    malformed = false,
    identityMismatch = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const key = new Headers(init?.headers).get("authorization")!;
    const tenantIndex = key === secretA ? 0 : key === secretB ? 1 : -1;
    assert.equal(url.origin, "https://postiz.example.test");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    assert.equal(init?.cache, "no-store");
    requests.push({ url: url.href, method: init?.method ?? "GET", key });
    if (tenantIndex < 0) return Response.json({ error: "private secret payload" }, { status: 401 });
    if (url.pathname.endsWith("/is-connected"))
      return Response.json({
        connected: true,
        organizationId: identityMismatch ? "foreign-org" : `org-${tenantIndex}`,
        accelerateProtocol: 1,
      });
    if (url.pathname.endsWith("/integrations"))
      return Response.json([
        {
          id: `page-${tenantIndex}`,
          name: "Company",
          identifier: "linkedin-page",
          disabled: false,
        },
      ]);
    if (url.pathname.includes("/analytics/post/"))
      return Response.json([
        {
          label: "Likes",
          data: [
            { total: 3, date: "2026-09-11" },
            { total: 7, date: "2026-09-12" },
          ],
        },
      ]);
    if (url.pathname.endsWith("/posts") && init?.method === "POST") {
      if (timeout) throw new Error(`Timeout including ${secretA}`);
      if (malformed) return Response.json({ accepted: true });
      const body = JSON.parse(String(init.body));
      assert.equal(body.type, "now");
      assert.equal(body.posts[0].integration.id, `page-${tenantIndex}`);
      return Response.json([{ postId: `post-${tenantIndex}`, integration: `page-${tenantIndex}` }]);
    }
    throw new Error("Unexpected controlled provider request");
  };
  try {
    assert.equal((await postizAdapter.verify({ apiKey: secretA })).accountDetails?.id, "org-0");
    const weeklyInput = {
      source: {
        title: "T".repeat(200),
        url: "https://example.test/guide",
        excerpt: "First verified fact.\n\nSecond verified fact.\n\nThird verified fact.",
      },
      channelId: "page-0",
      weekStart: new Date(Date.now() + 86400000).toISOString(),
      timeZone: "UTC",
    };
    const week = await prepareSocialWeek(database(a), weeklyInput);
    assert.equal(week.drafts.length, 3);
    assert.equal(week.drafts[0]!.title.length, 200);
    assert.ok(week.drafts.every((draft) => draft.content.endsWith(weeklyInput.source.url)));
    await assert.rejects(
      prepareSocialWeek(database(a), {
        ...weeklyInput,
        source: {
          ...weeklyInput.source,
          url: "https://example.test/" + "x".repeat(1600),
          excerpt: "x".repeat(1500) + "\n\nSecond.\n\nThird.",
        },
      }),
      /complete post fits/,
    );
    const clientA = await tenantPostizClient(database(a));
    const clientB = await tenantPostizClient(database(b));
    assert.equal((await clientA.channels())[0]!.id, "page-0");
    assert.equal((await clientB.channels())[0]!.id, "page-1");
    assert.deepEqual(await clientA.metrics("post-0"), [
      { label: "Likes", value: 7, date: "2026-09-12" },
    ]);
    const abort = new AbortController();
    const abortedClient = await tenantPostizClient(database(a), { signal: abort.signal });
    abort.abort();
    const beforeAbort = requests.length;
    await assert.rejects(abortedClient.submitNow("page-0", "Cancelled work", null));
    assert.equal(requests.length, beforeAbort, "Cancelled work must not start any provider call");
    const sendsBefore = () => requests.filter((r) => r.method === "POST").length;
    await assert.rejects(clientA.submitNow("page-1", "Foreign page", null), /active LinkedIn/);
    assert.equal(sendsBefore(), 0);
    assert.equal((await clientA.submitNow("page-0", "Approved post", null)).postId, "post-0");
    timeout = true;
    await assert.rejects(
      clientA.submitNow("page-0", "Approved post", null),
      (e: unknown) =>
        e instanceof PostizError && e.outcome === "unknown" && !e.message.includes(secretA),
    );
    timeout = false;
    malformed = true;
    await assert.rejects(
      clientA.submitNow("page-0", "Approved post", null),
      (e: unknown) => e instanceof PostizError && e.outcome === "unknown",
    );
    malformed = false;
    const original = connections[b]!.encrypted_credentials.api_key;
    connections[b]!.encrypted_credentials.api_key = connections[a]!.encrypted_credentials.api_key;
    await assert.rejects(tenantPostizClient(database(b)));
    connections[b]!.encrypted_credentials.api_key = original;
    identityMismatch = true;
    await assert.rejects(tenantPostizClient(database(a)), /organization changed/);
    identityMismatch = false;
    connections[a]!.credential_version++;
    await assert.rejects(
      clientA.submitNow("page-0", "Stale credential", null),
      /connection changed/,
    );
    configs[b]!.config.modules["social-marketing"] = false;
    await assert.rejects(tenantPostizClient(database(b)), /disabled/);
    const history = await tenantPostizClient(database(b), { historyOnly: true });
    assert.equal((await history.channels()).length, 1);
    await assert.rejects(
      history.submitNow("page-1", "History cannot send", null),
      /History access/,
    );
    for (const origin of [
      "http://postiz.example.test",
      "https://u:p@postiz.example.test",
      "https://postiz.example.test/path",
      "https://postiz.example.test?key=secret",
    ]) {
      process.env.POSTIZ_ORIGIN = origin;
      assert.throws(postizOrigin);
    }
    assert.equal(
      socialDraftSchema.safeParse({
        id: a,
        revision: 0,
        title: "Example",
        content: "Fact",
        channelId: "page-0",
        scheduledAt: "2026-11-01T01:30:00-05:00",
        timeZone: "America/Chicago",
        sources: [{ title: "Source", url: "https://example.test", excerpt: "Fact" }],
        mediaId: null,
      }).success,
      true,
    );
    console.log(
      "Passed Postiz identity, tenant credential/channel isolation, redaction, timeout and malformed acceptance, revocation, disabled history, fixed HTTPS origin and explicit DST-offset validation.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}
void main();
