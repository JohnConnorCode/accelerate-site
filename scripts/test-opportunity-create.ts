import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { NextRequest, NextResponse } from "next/server";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { createOpportunity } from "../src/lib/revenue-os/pipeline";
import { resolveOrCreateIdentity } from "../src/lib/revenue-os/identity";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import type { Row } from "./lib/memory-supabase";

const fixture = globalThis as typeof globalThis & {
  opportunityAuth?: unknown;
  opportunityWriter?: typeof createOpportunity;
};
const tenant = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const input = {
  requestId: randomUUID(),
  name: "Fictional Customer",
  email: "customer@example.test",
  companyName: "Fictional Company",
  estimatedValue: "500",
  nextActionAt: "",
};
const mem = new AuthorizedMemorySupabase({
  companies: [tenant, other].map((tenant_id) => ({
    id: randomUUID(),
    tenant_id,
    name: "Fictional Company",
    domain: "example.test",
  })),
  contacts: [tenant, other].map((tenant_id) => ({
    id: randomUUID(),
    tenant_id,
    full_name: "Fictional Customer",
    primary_email: input.email,
    alternate_emails: [],
  })),
});
const database = bindTenantDatabase(mem.client, tenant, true);
fixture.opportunityAuth = { database, user: { email: "admin@example.test" } };
fixture.opportunityWriter = createOpportunity;
async function main() {
  const bundle = await build({
    entryPoints: ["src/app/api/admin/revenue-os/pipeline/route.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "controlled-auth-and-shared-writer",
        setup(builder) {
          builder.onResolve({ filter: /^@\/lib\/admin\/auth$/ }, () => ({
            path: "auth",
            namespace: "fixture",
          }));
          builder.onResolve({ filter: /^@\/lib\/revenue-os\/pipeline$/ }, () => ({
            path: "pipeline",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents:
              args.path === "auth"
                ? "export const requireAdmin=async()=>globalThis.opportunityAuth;"
                : "export const createOpportunity=(...args)=>globalThis.opportunityWriter(...args); export const transitionOpportunity=()=>{throw Error('not in this check')}; export const transitionStatusFromError=()=>400; export const updateOpportunityDetails=transitionOpportunity;",
          }));
        },
      },
    ],
  });
  const compiled = { exports: {} as { POST: (request: NextRequest) => Promise<NextResponse> } };
  new Function("require", "module", "exports", bundle.outputFiles[0]!.text)(
    createRequire(import.meta.url),
    compiled,
    compiled.exports,
  );
  const post = (body: unknown, raw = false) =>
    compiled.exports.POST(
      new NextRequest("https://workspace.example.test/api/admin/revenue-os/pipeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: raw ? String(body) : JSON.stringify(body),
      }),
    );
  try {
    fixture.opportunityAuth = NextResponse.json({ error: "Sign in" }, { status: 401 });
    assert.equal((await post(input)).status, 401);
    assert.equal(mem.rpcCalls.length, 0);
    fixture.opportunityAuth = { database, user: { email: "admin@example.test" } };
    for (const body of [
      { ...input, requestId: undefined },
      { ...input, name: "" },
      { ...input, email: "bad" },
      { ...input, estimatedValue: -1 },
      { ...input, tenant_id: other },
      { ...input, actorEmail: "imposter@example.test" },
    ])
      assert.equal((await post(body)).status, 400);
    assert.equal((await post("{", true)).status, 400);
    assert.equal((await post("x".repeat(20_000), true)).status, 413);
    assert.equal(mem.rpcCalls.length, 0, "invalid/unauthorized input never reaches the writer");
    const saved = await post(input);
    assert.equal(saved.status, 201);
    const first = await saved.json();
    const retry = await post(input);
    assert.equal(retry.status, 201);
    assert.deepEqual(await retry.json(), first);
    assert.equal(mem.rows("opportunities").length, 1);
    assert.equal((await post({ ...input, estimatedValue: 999 })).status, 409);
    assert.equal(mem.rows("opportunities").length, 1);
    const second = await post({ ...input, requestId: randomUUID() });
    assert.equal(second.status, 201);
    assert.notEqual((await second.json()).opportunity.id, first.opportunity.id);
    assert.equal(mem.rows("opportunities").length, 2);
    const original = fixture.opportunityWriter;
    fixture.opportunityWriter = async () => {
      throw new Error("controlled unavailable receipt");
    };
    const unavailable = await post(input);
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).code, "save_unconfirmed");
    fixture.opportunityWriter = original;
    assert.equal((await post(input)).status, 201);
    fixture.opportunityAuth = {
      database: bindTenantDatabase(mem.client, other, true),
      user: { email: "other@example.test" },
    };
    const foreign = await post(input);
    assert.equal(foreign.status, 201);
    assert.notEqual((await foreign.json()).opportunity.id, first.opportunity.id);
    // Both contenders can read no identity before the winning insert commits.
    // Exercise the resolver's unique-conflict reread using the normal queries.
    const race = new AuthorizedMemorySupabase();
    const raw = race.client;
    const client = {
      ...raw,
      from(table: string) {
        const query = raw.from(table);
        if (!["companies", "contacts"].includes(table)) return query;
        return new Proxy(query, {
          get(target, key, receiver) {
            if (key !== "insert") {
              const value = Reflect.get(target, key, receiver);
              return typeof value === "function" ? value.bind(target) : value;
            }
            return (row: Row) => {
              (race.tables[table] ??= []).push({ ...row, id: randomUUID() });
              return {
                select: () => ({
                  single: async () => ({
                    data: null,
                    error: { code: "23505", message: "concurrent identity" },
                  }),
                }),
              };
            };
          },
        });
      },
    };
    const identity = await resolveOrCreateIdentity(
      bindTenantDatabase(client as never, tenant, true),
      { name: "Fictional Customer", email: input.email, source: "manual" },
    );
    assert.equal(race.rows("companies").length, 1);
    assert.equal(race.rows("contacts").length, 1);
    assert.equal(identity.contact.id, race.rows("contacts")[0]!.id);
    console.log(
      "PASS: real POST adapter calls shared create service; auth, strict bounded input, retained-key replay, conflict, deliberate second intent, unavailable receipt and tenant-scoped transport; identity insert-race rereads. Database/HTTP auth are controlled doubles here; native SQL proof is separate.",
    );
  } finally {
    delete fixture.opportunityAuth;
    delete fixture.opportunityWriter;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
