import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF = "skjypuwkceoiunyhhqlm";
const CONFIRMATION = "--confirm-controlled-production-isolation";
if (!process.argv.includes(CONFIRMATION)) {
  throw new Error(`Refusing production mutations without ${CONFIRMATION}`);
}

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ADMIN_EMAIL"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, `${PROJECT_REF}.supabase.co`, "controlled isolation proof must target only the fixed Accelerate Supabase project");
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const proofKey = "tenant-isolation-proof-v1";
const tenants = [
  { slug: "isolation-proof-alpha", name: "Isolation Proof Alpha", userEmail: "isolation-proof-alpha@accelerate.invalid" },
  { slug: "isolation-proof-beta", name: "Isolation Proof Beta", userEmail: "isolation-proof-beta@accelerate.invalid" },
];

async function findUserByEmail(email) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match || data.users.length < 1000) return match || null;
  }
  throw new Error("Auth directory is too large to safely search");
}

async function ensureProofUser(email) {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error || new Error("Could not create controlled proof user");
  return data.user;
}

async function ensureTenant(spec, actor) {
  const { data: existing, error: lookupError } = await service.from("tenants")
    .select("id,slug,name,status")
    .eq("slug", spec.slug)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.status === "archived") {
    throw new Error(`Controlled proof workspace ${spec.slug} is archived and cannot be safely reused`);
  }
  if (existing) return existing;
  const { data, error } = await service.rpc("platform_create_tenant", {
    p_slug: spec.slug,
    p_name: spec.name,
    p_actor_user_id: actor.id,
    p_actor_email: actor.email,
  });
  if (error || !data) throw error || new Error(`Could not create ${spec.slug}`);
  return data;
}

async function setStatus(tenant, status, actor) {
  const { data, error } = await service.rpc("platform_set_tenant_status", {
    p_tenant_id: tenant.id,
    p_status: status,
    p_actor_user_id: actor.id,
    p_actor_email: actor.email,
  });
  if (error || !data) throw error || new Error(`Could not set ${tenant.slug} to ${status}`);
  return data;
}

async function setMembership(tenant, user, actor) {
  const { data, error } = await service.rpc("platform_upsert_tenant_membership", {
    p_tenant_id: tenant.id,
    p_user_id: user.id,
    p_invited_email: user.email,
    p_membership_status: "active",
    p_actor_user_id: actor.id,
    p_actor_email: actor.email,
  });
  if (error || !data) throw error || new Error(`Could not bind ${user.email} to ${tenant.slug}`);
  return data;
}

async function userClient(user, tenantId) {
  const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (linkError || !link.properties?.hashed_token) throw linkError || new Error("Could not create controlled proof session");
  const verifier = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: verified, error: verifyError } = await verifier.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (verifyError || !verified.session) throw verifyError || new Error("Could not verify controlled proof session");
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${verified.session.access_token}`, "x-tenant-id": tenantId } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const actor = await findUserByEmail(process.env.ADMIN_EMAIL.trim().toLowerCase());
if (!actor?.email) throw new Error("Configured platform owner was not found in Auth");

const proofTenants = [];
let proofError = null;
let proofResult = null;
try {
  const proofUsers = await Promise.all(tenants.map((spec) => ensureProofUser(spec.userEmail)));
  for (const spec of tenants) proofTenants.push(await ensureTenant(spec, actor));
  for (let index = 0; index < proofTenants.length; index += 1) {
    await setStatus(proofTenants[index], "active", actor);
    await setMembership(proofTenants[index], proofUsers[index], actor);
  }

const sharedEmail = "same-contact@tenant-isolation.invalid";
const sharedProvider = "resend";
const sharedIdempotencyKey = `${proofKey}:job`;
for (const tenant of proofTenants) {
  const contact = {
    tenant_id: tenant.id,
    full_name: "Controlled Isolation Contact",
    primary_email: sharedEmail,
    source: proofKey,
  };
  const { data: existingContact, error: existingContactError } = await service.from("contacts")
    .select("id").eq("tenant_id", tenant.id).eq("primary_email", sharedEmail).maybeSingle();
  if (existingContactError) throw existingContactError;
  const { error: contactError } = existingContact
    ? await service.from("contacts").update(contact).eq("id", existingContact.id)
    : await service.from("contacts").insert(contact);
  if (contactError) throw contactError;
  const provider = {
    tenant_id: tenant.id,
    provider: sharedProvider,
    account_email: "no-provider-effect@tenant-isolation.invalid",
    status: "revoked",
    settings: { proof: proofKey, external_effects: false },
  };
  const { data: existingProvider, error: existingProviderError } = await service.from("integration_connections")
    .select("id").eq("tenant_id", tenant.id).eq("provider", sharedProvider).maybeSingle();
  if (existingProviderError) throw existingProviderError;
  const { error: providerError } = existingProvider
    ? await service.from("integration_connections").update(provider).eq("id", existingProvider.id)
    : await service.from("integration_connections").insert(provider);
  if (providerError) throw providerError;
  const job = {
    tenant_id: tenant.id,
    job_key: proofKey,
    status: "success",
    summary: { proof: proofKey, external_effects: false },
    idempotency_key: sharedIdempotencyKey,
  };
  const { data: existingJob, error: existingJobError } = await service.from("job_runs")
    .select("id").eq("tenant_id", tenant.id).eq("idempotency_key", sharedIdempotencyKey).maybeSingle();
  if (existingJobError) throw existingJobError;
  const { error: jobError } = existingJob
    ? await service.from("job_runs").update(job).eq("id", existingJob.id)
    : await service.from("job_runs").insert(job);
  if (jobError) throw jobError;
}

const { count: duplicateContacts, error: contactCountError } = await service.from("contacts")
  .select("id", { count: "exact", head: true }).eq("primary_email", sharedEmail);
if (contactCountError) throw contactCountError;
const { count: duplicateProviders, error: providerCountError } = await service.from("integration_connections")
  .select("id", { count: "exact", head: true }).eq("provider", sharedProvider).eq("account_email", "no-provider-effect@tenant-isolation.invalid");
if (providerCountError) throw providerCountError;
const { count: duplicateJobs, error: jobCountError } = await service.from("job_runs")
  .select("id", { count: "exact", head: true }).eq("idempotency_key", sharedIdempotencyKey);
if (jobCountError) throw jobCountError;
assert.equal(duplicateContacts, 2, "identical contact identity must persist once per controlled tenant");
assert.equal(duplicateProviders, 2, "identical provider identity must persist once per controlled tenant");
assert.equal(duplicateJobs, 2, "identical idempotency key must persist once per controlled tenant");

const alphaClient = await userClient(proofUsers[0], proofTenants[0].id);
const { data: alphaRows, error: alphaReadError } = await alphaClient.from("contacts").select("id,tenant_id").eq("primary_email", sharedEmail);
if (alphaReadError) throw alphaReadError;
assert.equal(alphaRows?.length, 1, "tenant admin must see exactly its own controlled contact");
assert.equal(alphaRows?.[0]?.tenant_id, proofTenants[0].id, "tenant admin read returned another workspace's row");

const tamperedClient = await userClient(proofUsers[0], proofTenants[1].id);
const { data: tamperedRows, error: tamperedError } = await tamperedClient.from("contacts").select("id,tenant_id").eq("primary_email", sharedEmail);
assert.ok(tamperedError || !tamperedRows?.length, "tampered tenant context exposed a cross-tenant row");

  for (const tenant of proofTenants) await setStatus(tenant, "suspended", actor);
const suspendedClient = await userClient(proofUsers[0], proofTenants[0].id);
const { data: suspendedRows, error: suspendedError } = await suspendedClient.from("contacts").select("id").eq("primary_email", sharedEmail);
assert.ok(suspendedError || !suspendedRows?.length, "suspended tenant retained operational read access");

const { count: auditCount, error: auditError } = await service.from("platform_audit_log")
  .select("id", { count: "exact", head: true })
  .in("tenant_id", proofTenants.map((tenant) => tenant.id))
  .in("action", ["tenant.created", "tenant.active", "tenant.suspended", "tenant.membership_granted"]);
if (auditError) throw auditError;
assert.ok((auditCount || 0) >= 6, "controlled lifecycle actions did not leave the required platform audit receipts");

  proofResult = {
    result: "passed",
    tenants: proofTenants.map((tenant) => ({ slug: tenant.slug, status: "suspended" })),
    duplicateIdentityRows: duplicateContacts,
    duplicateProviderRows: duplicateProviders,
    duplicateIdempotencyRows: duplicateJobs,
    sameTenantRows: alphaRows?.length || 0,
    tamperedContext: tamperedError ? "rejected" : "empty",
    suspendedContext: suspendedError ? "rejected" : "empty",
    auditReceipts: auditCount,
    externalEffects: false,
  };
} catch (error) {
  proofError = error;
} finally {
  // A failed assertion must never strand a controlled production tenant in an
  // active state. Suspension is idempotent and preserves every proof receipt.
  const cleanup = await Promise.allSettled(proofTenants.map((tenant) => setStatus(tenant, "suspended", actor)));
  const cleanupFailures = cleanup.filter((result) => result.status === "rejected");
  if (cleanupFailures.length) {
    const cleanupMessage = `${cleanupFailures.length} controlled proof tenant(s) could not be suspended; immediate operator reconciliation is required`;
    proofError = proofError
      ? new AggregateError([proofError, ...cleanupFailures.map((result) => result.reason)], cleanupMessage)
      : new AggregateError(cleanupFailures.map((result) => result.reason), cleanupMessage);
  }
}

if (proofError) throw proofError;
console.log(JSON.stringify(proofResult, null, 2));
