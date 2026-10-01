import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isConfiguredAdmin } from "@/lib/admin/access";
import type { AdminAuthorization } from "@/lib/admin/auth";
import { readBoundedJson } from "@/lib/ai/bounded-json";
import {
  createApprovedTenantWriter,
  createPlatformServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import type { TenantSummary, TenantSystemContext } from "@/lib/tenancy/context";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const grantSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  user_id: z.uuid(),
  client_id: z.uuid(),
  resource: z.url(),
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
});

/** One pre-registered OAuth client per workspace. A client ID must never select two resources. */
export function configuredWorkspaceMcpOAuthClients(): Record<string, string> {
  const parsed = z
    .record(slug, z.uuid())
    .parse(JSON.parse(process.env.MCP_WORKSPACE_OAUTH_CLIENTS || "{}"));
  const ids = Object.values(parsed);
  const siteIds = (process.env.SITE_STUDIO_OAUTH_CLIENT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (new Set(ids).size !== ids.length || ids.some((id) => siteIds.includes(id)))
    throw new Error("OAuth client IDs must be unique across MCP resources");
  return parsed;
}

export function workspaceMcpOAuthConfig(tenantSlug: string) {
  const tenant = slug.parse(tenantSlug);
  const clientId = configuredWorkspaceMcpOAuthClients()[tenant];
  if (!clientId) throw new Error("Workspace MCP OAuth client is not configured");
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "");
  if (site.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(site.hostname))
    throw new Error("Workspace MCP OAuth requires an HTTPS installation URL");
  return {
    clientId,
    resource: new URL(`/api/public/${tenant}/mcp/oauth`, site).href,
    metadata: new URL(`/.well-known/oauth-protected-resource/api/public/${tenant}/mcp/oauth`, site)
      .href,
    issuer: new URL("/auth/v1", process.env.NEXT_PUBLIC_SUPABASE_URL).href,
  };
}

export async function authenticateWorkspaceMcp(token: string, tenantSlug: string) {
  const config = workspaceMcpOAuthConfig(tenantSlug);
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const verified = await authClient.auth.getClaims(token);
  const claims = verified.data?.claims;
  if (
    verified.error ||
    !claims ||
    claims.iss !== config.issuer ||
    claims.aud !== config.resource ||
    claims.role !== "mcp_workspace" ||
    claims.client_id !== config.clientId ||
    !z.uuid().safeParse(claims.sub).success ||
    !z.uuid().safeParse(claims.session_id).success ||
    typeof claims.exp !== "number" ||
    claims.exp <= Date.now() / 1000
  )
    throw new Error("Workspace MCP OAuth token is invalid or has the wrong audience");

  const userResult = await authClient.auth.getUser(token);
  const user = userResult.data.user;
  if (userResult.error || !user || user.id !== claims.sub || user.is_anonymous || !user.email)
    throw new Error("Workspace MCP identity is unavailable");
  const native = await fetch(`${config.issuer}/user/oauth/grants`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    signal: AbortSignal.timeout(5000),
    redirect: "error",
    cache: "no-store",
  });
  if (!native.ok) throw new Error("OAuth grant verification unavailable");
  const grants = z
    .array(z.object({ client: z.object({ id: z.string() }) }))
    .parse(await readBoundedJson(native, 128_000));
  if (!grants.some((grant) => grant.client.id === config.clientId))
    throw new Error("OAuth grant was revoked");

  const platform = createPlatformServiceRoleClient("workspace-mcp-oauth");
  const tenantResult = await platform
    .from("tenants")
    .select("id,slug,name,status,config")
    .eq("slug", tenantSlug)
    .maybeSingle();
  const tenant = tenantResult.data as TenantSummary | null;
  if (tenantResult.error || tenant?.status !== "active")
    throw new Error("Workspace is unavailable");
  const context: TenantSystemContext = {
    kind: "system",
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    source: "workspace-mcp-oauth",
  };
  const database = createServiceRoleClient(context);
  const [membership, delegation] = await Promise.all([
    database
      .from("tenant_memberships")
      .select("role,status")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    database
      .from("workspace_mcp_delegations")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .eq("client_id", config.clientId)
      .eq("resource", config.resource)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (
    membership.error ||
    membership.data?.role !== "admin" ||
    membership.data.status !== "active" ||
    delegation.error ||
    !delegation.data
  )
    throw new Error("Workspace MCP delegation is missing, expired, or revoked");
  const grant = grantSchema.parse(delegation.data);
  const authorized = await database.rpc("authorize_workspace_mcp_delegation", {
    p_grant_id: grant.id,
    p_user_id: user.id,
    p_client_id: config.clientId,
    p_session_id: claims.session_id,
    p_resource: config.resource,
  });
  if (authorized.error) throw new Error("Workspace MCP session or delegation was revoked");
  const auth: AdminAuthorization = {
    kind: "actor",
    tenant,
    user: { id: user.id, email: user.email },
    role: "admin",
    isPlatformAdmin: isConfiguredAdmin(user.email),
    workspaceMcpProof: {
      grantId: grant.id,
      clientId: config.clientId,
      sessionId: String(claims.session_id),
      resource: config.resource,
    },
    database,
  };
  return { auth, grant };
}

export async function listWorkspaceMcpDelegations(auth: AdminAuthorization) {
  workspaceMcpOAuthConfig(auth.tenant.slug);
  const database = createApprovedTenantWriter(auth.tenant.id, "workspace-mcp-grants");
  const { data, error } = await database
    .from("workspace_mcp_delegations")
    .select("*")
    .eq("tenant_id", auth.tenant.id)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Workspace MCP delegations unavailable");
  return (data ?? []).map((row) => grantSchema.parse(row));
}

export async function manageWorkspaceMcpDelegation(
  auth: AdminAuthorization,
  input: { operation: "grant" } | { operation: "revoke"; grantId: string },
) {
  const config = workspaceMcpOAuthConfig(auth.tenant.slug);
  const database = createApprovedTenantWriter(auth.tenant.id, "workspace-mcp-grants");
  const { data, error } = await database.rpc("manage_workspace_mcp_delegation", {
    p_operation: input.operation,
    p_user_id: auth.user.id,
    p_client_id: config.clientId,
    p_resource: config.resource,
    p_actor_email: auth.user.email ?? auth.user.id,
    p_grant_id: input.operation === "revoke" ? z.uuid().parse(input.grantId) : null,
  });
  if (error) throw new Error("Workspace MCP delegation could not be changed");
  return grantSchema.parse(data);
}
