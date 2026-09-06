#!/usr/bin/env tsx
/**
 * Controlled-production proof for the MCP tenant-isolation fix.
 *
 * Before this fix, /api/public/[tenantSlug]/mcp resolved every request's
 * database context via accelerateSystemContext (hardcoded to the platform
 * tenant) and an unbound createPlatformServiceRoleClient, regardless of
 * which tenant's key actually authenticated. Any tenant's MCP key could read
 * and write across the whole shared database.
 *
 * This proof exercises the REAL fixed code path directly — resolveTenantProviderSecrets,
 * createServiceRoleClient, runWithTenantRequestContext — against two controlled tenants
 * in production, not a reimplementation and not MemorySupabase. It follows the exact
 * safety pattern of verify-tenant-production-isolation.mjs: pinned project ref, explicit
 * confirmation flag, fictional .invalid identities, and a finally block that always
 * suspends the controlled tenants even if an assertion fails.
 *
 * Requires GOOGLE_TOKEN_ENCRYPTION_KEY to be configured, since the MCP key this proof
 * writes goes through the same encryptSecret/decryptSecret envelope every tenant MCP
 * key uses in production.
 */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { encryptSecret } from "../src/lib/revenue-os/encryption";
import { resolveTenantProviderSecrets } from "../src/lib/tenancy/providers";
import { createServiceRoleClient } from "../src/lib/supabase/server";
import { runWithTenantRequestContext } from "../src/lib/tenancy/context";

const PROJECT_REF = process.env.ISOLATION_PROOF_PROJECT_REF;
if (!PROJECT_REF) {
  throw new Error(
    "ISOLATION_PROOF_PROJECT_REF is required. The proof pins every mutation to one Supabase project you control; it must never be inferred from the ambient environment.",
  );
}
const CONFIRMATION = "--confirm-controlled-production-isolation";
if (!process.argv.includes(CONFIRMATION)) {
  throw new Error(`Refusing production mutations without ${CONFIRMATION}`);
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_EMAIL",
  "GOOGLE_TOKEN_ENCRYPTION_KEY",
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.equal(
  new URL(url).hostname,
  `${PROJECT_REF}.supabase.co`,
  "controlled isolation proof must target only the pinned Supabase project",
);
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const proofKey = "mcp-tenant-isolation-proof-v1";
const tenants = [
  { slug: "mcp-isolation-proof-alpha", name: "MCP Isolation Proof Alpha" },
  { slug: "mcp-isolation-proof-beta", name: "MCP Isolation Proof Beta" },
];

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match || data.users.length < 1000) return match || null;
  }
  throw new Error("Auth directory is too large to safely search");
}

async function ensureTenant(
  spec: { slug: string; name: string },
  actorId: string,
  actorEmail: string,
) {
  const { data: existing, error: lookupError } = await service
    .from("tenants")
    .select("id,slug,name,status")
    .eq("slug", spec.slug)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.status === "archived") {
    throw new Error(
      `Controlled proof workspace ${spec.slug} is archived and cannot be safely reused`,
    );
  }
  if (existing) return existing;
  const { data, error } = await service.rpc("platform_create_tenant", {
    p_slug: spec.slug,
    p_name: spec.name,
    p_actor_user_id: actorId,
    p_actor_email: actorEmail,
  });
  if (error || !data) throw error || new Error(`Could not create ${spec.slug}`);
  return data as { id: string; slug: string; name: string; status: string };
}

async function setStatus(
  tenantId: string,
  slug: string,
  status: string,
  actorId: string,
  actorEmail: string,
) {
  const { data, error } = await service.rpc("platform_set_tenant_status", {
    p_tenant_id: tenantId,
    p_status: status,
    p_actor_user_id: actorId,
    p_actor_email: actorEmail,
  });
  if (error || !data) throw error || new Error(`Could not set ${slug} to ${status}`);
  return data;
}

type ProofTenant = { id: string; slug: string; name: string; status: string };

const actor = await findUserByEmail(process.env.ADMIN_EMAIL!.trim().toLowerCase());
if (!actor?.email) throw new Error("Configured platform owner was not found in Auth");
const actorId = actor.id;
const actorEmail = actor.email;

const proofTenants: ProofTenant[] = [];
let proofError: unknown = null;
let proofResult: Record<string, unknown> | null = null;

try {
  for (const spec of tenants) {
    proofTenants.push((await ensureTenant(spec, actorId, actorEmail)) as ProofTenant);
  }
  for (const tenant of proofTenants) {
    await setStatus(tenant.id, tenant.slug, "active", actorId, actorEmail);
  }

  // Issue a real MCP key for Alpha only, through the exact envelope
  // integration_connections stores in production (see configure_mcp in
  // /api/admin/tenant/providers/route.ts).
  const alpha = proofTenants[0]!;
  const beta = proofTenants[1]!;
  const alphaMcpKey = `revos_mcp_proof_${Date.now()}`;
  const { error: connError } = await service.from("integration_connections").upsert(
    {
      tenant_id: alpha.id,
      provider: "mcp",
      status: "connected",
      encrypted_credentials: { api_key: encryptSecret(alphaMcpKey) },
      environment_fallback_allowed: false,
    },
    { onConflict: "tenant_id,provider" },
  );
  if (connError) throw connError;

  // The actual fixed code path: resolve the key exactly as the route does.
  const resolvedAsAlpha = await resolveTenantProviderSecrets(alpha.slug, "mcp");
  assert.ok(resolvedAsAlpha, "Alpha's MCP key must resolve");
  assert.equal(resolvedAsAlpha!.apiKey, alphaMcpKey, "resolved key must decrypt to the issued key");
  assert.equal(
    resolvedAsAlpha!.context.tenantId,
    alpha.id,
    "resolveTenantProviderSecrets(alpha.slug) must resolve Alpha's real tenant id, not a hardcoded platform tenant",
  );

  // Beta never configured an MCP key: resolving Beta's slug must not find Alpha's.
  const resolvedAsBeta = await resolveTenantProviderSecrets(beta.slug, "mcp");
  assert.equal(
    resolvedAsBeta?.apiKey ?? null,
    null,
    "Beta must not resolve any MCP key, and must never resolve Alpha's",
  );

  // Write through the tenant-bound client exactly as the route does after
  // authentication, and prove the row lands tagged to Alpha, not floating
  // with no tenant_id the way the unbound platform client used to leave it.
  const proofEmail = "mcp-isolation-proof-contact@tenant-isolation.invalid";
  await runWithTenantRequestContext(resolvedAsAlpha!.context, async () => {
    const boundClient = createServiceRoleClient(resolvedAsAlpha!.context);
    const { data: existing } = await boundClient
      .from("contacts")
      .select("id")
      .eq("primary_email", proofEmail)
      .maybeSingle();
    const contact = {
      full_name: "MCP Isolation Proof Contact",
      primary_email: proofEmail,
      source: proofKey,
    };
    const { error } = existing
      ? await boundClient.from("contacts").update(contact).eq("id", existing.id)
      : await boundClient.from("contacts").insert(contact);
    if (error) throw error;
  });

  const { data: writtenRow, error: writtenError } = await service
    .from("contacts")
    .select("id,tenant_id")
    .eq("primary_email", proofEmail)
    .maybeSingle();
  if (writtenError) throw writtenError;
  assert.ok(writtenRow, "the tenant-bound write must have landed a row");
  assert.equal(
    writtenRow!.tenant_id,
    alpha.id,
    "a write through Alpha's bound MCP context must carry Alpha's tenant_id, not null and not Beta's",
  );

  // Prove the reverse: a client bound to Beta's context cannot see Alpha's row.
  const betaSystemContext = {
    kind: "system" as const,
    tenantId: beta.id,
    tenantSlug: beta.slug,
    source: "mcp-isolation-proof",
  };
  const betaVisibleRows = await runWithTenantRequestContext(betaSystemContext, async () => {
    const boundClient = createServiceRoleClient(betaSystemContext);
    const { data } = await boundClient
      .from("contacts")
      .select("id")
      .eq("primary_email", proofEmail);
    return data ?? [];
  });
  assert.equal(
    betaVisibleRows.length,
    0,
    "a client bound to Beta's tenant context must not see Alpha's controlled contact",
  );

  proofResult = {
    result: "passed",
    tenants: proofTenants.map((t) => ({ slug: t.slug, status: "suspended" })),
    alphaKeyResolvedToAlphaTenant: true,
    betaCannotResolveAlphaKey: true,
    boundWriteCarriedCorrectTenantId: true,
    betaBoundReadExcludedAlphaRow: true,
  };
} catch (error) {
  proofError = error;
} finally {
  const cleanup = await Promise.allSettled(
    proofTenants.map((tenant) =>
      setStatus(tenant.id, tenant.slug, "suspended", actorId, actorEmail),
    ),
  );
  const cleanupFailures = cleanup.filter((r) => r.status === "rejected");
  if (cleanupFailures.length) {
    const message = `${cleanupFailures.length} controlled proof tenant(s) could not be suspended; immediate operator reconciliation is required`;
    proofError = proofError
      ? new AggregateError(
          [proofError, ...cleanupFailures.map((r) => (r as PromiseRejectedResult).reason)],
          message,
        )
      : new AggregateError(
          cleanupFailures.map((r) => (r as PromiseRejectedResult).reason),
          message,
        );
  }
}

if (proofError) throw proofError;
console.log(JSON.stringify(proofResult, null, 2));
