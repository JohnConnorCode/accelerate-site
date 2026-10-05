import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const prior = { ...process.env };
const priorError = console.error;
const logs = [];
const sensitive = "private-provider-token-that-must-not-escape";
const state = () => ({ calls: [], membership: null, membershipError: null, error: null });
const sources = {
  "@supabase/ssr": `export function createServerClient(url, key, options) {
    globalThis.__recovery.client = options;
    const run = async (name, input) => {
      const s = globalThis.__recovery; s.calls.push({name, input});
      options.cookies.setAll([{name:"fixture-code-verifier", value:"", options:{maxAge:0}}]);
      if(s.throwAuth) throw new Error(s.throwAuth);
      return {error:s.error, data:{user:{id:"owner",email:"founder@local.test"}}};
    };
    return {auth:{exchangeCodeForSession:(code)=>run("exchange",code),
      verifyOtp:(input)=>run("verify",input), resetPasswordForEmail:(email,options)=>run("reset",{email,options}),
      getUser:()=>run("user",null)}};
  }`,
  "@/lib/tenancy/lifecycle": `export async function activateInvitedTenantMembership(input){
    const s=globalThis.__recovery; s.calls.push({name:"activate", input});
    if(s.throwMembership) throw new Error(s.throwMembership);
  }`,
  "@/lib/command-center/runtime": "export const commandCenterOrigin = null;",
  "@/config/tenant": "export const tenant = {brand:{name:'Fictional Workspace'}};",
  "@/lib/supabase/server": `export function createPlatformServiceRoleClient(){
    const s=globalThis.__recovery;
    if(s.throwDatabase) throw new Error(s.throwDatabase);
    const query={}; for(const key of ['select','eq','in','limit'])query[key]=()=>query;
    query.maybeSingle=async()=>({data:s.membership,error:s.membershipError});
    return {from:()=>query, auth:{admin:{generateLink:async()=>{
      s.calls.push({name:'generate'});return {data:{properties:{hashed_token:'fictional-hash'}},error:s.error};
    }}}};
  }`,
  "@/lib/rate-limit": `import {NextResponse} from 'next/server';
    export async function rateLimit(key,limit,window){
      globalThis.__recovery.limit={key,limit,window};
      return globalThis.__recovery.rate || {success:true};
    }
    export function rateLimitResponse(result,body){return NextResponse.json(body,{status:result.status,headers:{'Cache-Control':'no-store'}});}`,
  "@/lib/email/resend": `export const FROM_EMAIL='fictional@local.test';
    export function getResend(){return {emails:{send:async(input)=>{
      const s=globalThis.__recovery; s.calls.push({name:'send',input});return {error:s.error};
    }}};}`,
  "@/lib/email/templates": "export function adminPasswordResetEmail(url){return url;}",
};
mkdirSync(".accelerate", { recursive: true });
const dir = mkdtempSync(join(process.cwd(), ".accelerate/password-recovery-"));
try {
  console.error = (...args) => logs.push(args.join(" "));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_fictional";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3019";
  process.env.ADMIN_EMAIL = "founder@local.test";
  delete process.env.RESEND_API_KEY;
  const routes = {};
  for (const [name, entry] of Object.entries({
    callback: "src/app/auth/callback/route.ts",
    reset: "src/app/api/admin/password-reset/route.ts",
  })) {
    const outfile = join(dir, `${name}.cjs`);
    await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      format: "cjs",
      platform: "node",
      packages: "external",
      plugins: [
        {
          name: "controlled-auth-and-membership",
          setup(b) {
            b.onResolve({ filter: /.*/ }, (args) =>
              args.path in sources ? { path: args.path, namespace: "controlled" } : null,
            );
            b.onLoad({ filter: /.*/, namespace: "controlled" }, (args) => ({
              contents: sources[args.path],
              resolveDir: process.cwd(),
            }));
          },
        },
      ],
    });
    routes[name] = require(outfile);
  }
  const callback = (query) =>
    routes.callback.GET(new NextRequest(`http://localhost:3019/auth/callback?${query}`));
  const reset = (email = "founder@local.test", body = JSON.stringify({ email })) =>
    routes.reset.POST(
      new NextRequest("http://localhost:3019/api/admin/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
        body,
      }),
    );
  let checks = 0;
  async function test(name, run) {
    globalThis.__recovery = state();
    await run();
    checks++;
    console.log(`PASS ${name}`);
  }
  function failure(response, error) {
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")).searchParams.get("error"), error);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert(!response.headers.get("location").includes(sensitive));
  }
  await test("missing configuration gives setup guidance before provider access", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    failure(await callback("code=fictional&next=/admin/update-password"), "not_configured");
    assert.equal((await reset()).status, 503);
    assert.equal(globalThis.__recovery.calls.length, 0);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  });
  await test("PKCE preserves recovery destination, verifier cookies and bounded private exchange", async () => {
    const r = await callback("code=fictional&next=/admin/update-password");
    assert.equal(new URL(r.headers.get("location")).pathname, "/admin/update-password");
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.equal(r.cookies.get("fixture-code-verifier").value, "");
    assert.deepEqual(globalThis.__recovery.calls, [{ name: "exchange", input: "fictional" }]);
    const nativeFetch = globalThis.fetch;
    let signal;
    try {
      globalThis.fetch = async (_input, options) => {
        signal = options.signal;
        return new Response("controlled");
      };
      await globalThis.__recovery.client.global.fetch("http://localhost/controlled");
      assert(signal instanceof AbortSignal);
      assert.equal(signal.aborted, false);
    } finally {
      globalThis.fetch = nativeFetch;
    }
  });
  await test("token-hash recovery remains provider-verified", async () => {
    const r = await callback("token_hash=fictional&type=recovery");
    assert.equal(new URL(r.headers.get("location")).pathname, "/admin/update-password");
    assert.deepEqual(globalThis.__recovery.calls, [
      { name: "verify", input: { token_hash: "fictional", type: "recovery" } },
    ]);
  });
  await test("failed or thrown exchanges preserve cleared cookies and redact provider details", async () => {
    for (const thrown of [false, true]) {
      globalThis.__recovery = state();
      globalThis.__recovery[thrown ? "throwAuth" : "error"] = sensitive;
      const r = await callback("code=fictional&next=/admin/update-password");
      failure(r, "reset_failed");
      assert.equal(r.cookies.get("fixture-code-verifier").value, "");
    }
    failure(await callback("token_hash=fictional&type=recovery"), "reset_failed");
  });
  await test("external redirects and malformed invitations cannot activate memberships", async () => {
    for (const next of ["//evil.test", "/\\evil.test", "https://evil.test"]) {
      const r = await callback(`code=fictional&next=${encodeURIComponent(next)}`);
      assert.equal(new URL(r.headers.get("location")).pathname, "/workspace");
    }
    globalThis.__recovery = state();
    failure(
      await callback("token_hash=fictional&type=invite&tenant_id=invalid&workspace=valid"),
      "auth_failed",
    );
    assert.equal(globalThis.__recovery.calls.length, 0);
  });
  await test("invitation activation and failure cookies retain existing boundary", async () => {
    const query =
      "token_hash=fictional&type=invite&tenant_id=00000000-0000-4000-8000-000000000001&workspace=harbor";
    const r = await callback(query);
    assert.equal(new URL(r.headers.get("location")).pathname, "/t/harbor/admin/today");
    assert.deepEqual(
      globalThis.__recovery.calls.map((x) => x.name),
      ["verify", "user", "activate"],
    );
    globalThis.__recovery.throwMembership = sensitive;
    const rejected = await callback(query);
    failure(rejected, "invite_unavailable");
    assert(rejected.cookies.get("fixture-code-verifier"));
  });
  await test("invalid and expired recovery callbacks return immediate reset guidance", async () => {
    failure(await callback("next=/admin/update-password&error_code=otp_expired"), "reset_failed");
    assert.equal(globalThis.__recovery.calls.length, 0);
  });
  await test("reset retains rate policy, input validation and unknown-email privacy", async () => {
    assert.equal((await reset("unknown@local.test")).status, 200);
    assert.equal(globalThis.__recovery.calls.length, 0);
    assert.equal(globalThis.__recovery.limit.limit, 3);
    assert.equal(globalThis.__recovery.limit.window, 15 * 60 * 1000);
    assert.equal((await reset(null)).status, 400);
    assert.equal((await reset(null, "bad-json")).status, 400);
    globalThis.__recovery.rate = { success: false, status: 429 };
    assert.equal((await reset()).status, 429);
  });
  await test("membership and provider outages cannot claim a sent reset email", async () => {
    for (const mode of ["membershipError", "throwDatabase", "throwAuth", "error"]) {
      globalThis.__recovery = state();
      globalThis.__recovery[mode] = sensitive;
      const r = await reset();
      assert.equal(r.status, 503);
      assert.equal(r.headers.get("cache-control"), "no-store");
      assert(!(await r.text()).includes(sensitive));
      if (["membershipError", "throwDatabase"].includes(mode))
        assert.equal(globalThis.__recovery.calls.length, 0);
    }
    assert(logs.length > 0);
    assert(logs.every((x) => !x.includes(sensitive)));
  });
  await test("native reset keeps the PKCE verifier and exact recovery callback", async () => {
    const r = await reset();
    assert.equal(r.status, 200);
    assert(r.cookies.get("fixture-code-verifier"));
    assert.equal(
      globalThis.__recovery.calls[0].input.options.redirectTo,
      "http://localhost:3019/auth/callback?next=%2Fadmin%2Fupdate-password",
    );
  });
  await test("active member and optional configured sender use verified recovery tokens", async () => {
    globalThis.__recovery.membership = { tenant_id: "fictional-tenant" };
    assert.equal((await reset("member@local.test")).status, 200);
    globalThis.__recovery = state();
    process.env.RESEND_API_KEY = "fictional-controlled-key";
    const r = await reset();
    assert.equal(r.status, 200);
    const sent = globalThis.__recovery.calls.find((x) => x.name === "send");
    assert(sent);
    const url = new URL(sent.input.html);
    assert.equal(url.searchParams.get("type"), "recovery");
    assert.equal(url.searchParams.get("token_hash"), "fictional-hash");
    delete process.env.RESEND_API_KEY;
  });
  console.log(
    JSON.stringify({
      result: "passed",
      checks,
      proof: "Actual routes with controlled provider and membership adapters; no external sends",
    }),
  );
} finally {
  console.error = priorError;
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "ADMIN_EMAIL",
    "RESEND_API_KEY",
  ]) {
    if (prior[key] === undefined) delete process.env[key];
    else process.env[key] = prior[key];
  }
  delete globalThis.__recovery;
  rmSync(dir, { recursive: true, force: true });
}
