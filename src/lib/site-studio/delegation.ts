import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isConfiguredAdmin } from "@/lib/admin/access";
import type { AdminAuthorization } from "@/lib/admin/auth";
import { bindTenantDatabase } from "@/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "@/lib/tenancy/constants";
import type { TenantSummary } from "@/lib/tenancy/context";
import { readBoundedJson } from "@/lib/ai/bounded-json";
import { assertWebsiteOwner } from "./website-store";
import { parseWebsiteCommand, websiteReceiptSchema } from "./website-commands";
import { siteEditorExecuteSchema } from "./editor-contract";
import { websiteCommandDigest } from "./editor-service";

function siteEditorHost() {
  return bindTenantDatabase(createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: { headers: { "x-tenant-id": ACCELERATE_TENANT_ID } },
    auth: { persistSession: false, autoRefreshToken: false },
  }), ACCELERATE_TENANT_ID, true);
}

export function siteEditorOAuthConfig() {
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "");
  if (site.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(site.hostname))
    throw new Error("Site Studio OAuth requires an HTTPS installation URL");
  const issuer = new URL("/auth/v1", process.env.NEXT_PUBLIC_SUPABASE_URL).href;
  const clientIds = (process.env.SITE_STUDIO_OAUTH_CLIENT_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean);
  if (!clientIds.length || clientIds.some(id => !z.uuid().safeParse(id).success))
    throw new Error("Configure pre-registered Site Studio OAuth client IDs");
  return {
    resource: new URL("/api/mcp/site-studio", site).href,
    metadata: new URL("/.well-known/oauth-protected-resource/api/mcp/site-studio", site).href,
    issuer, clientIds,
  };
}
export const siteDelegationSchema = z.object({
  id: z.uuid(), tenant_id: z.uuid(), user_id: z.uuid(), client_id: z.string(),
  resource: z.string().url(), created_at: z.string(), expires_at: z.string(),
  revoked_at: z.string().nullable(),
});
const verifiedDelegations = new WeakSet<object>();
export interface SiteEditorDelegation {
  auth: AdminAuthorization;
  grant: z.infer<typeof siteDelegationSchema>;
  sessionId: string;
}
export function isVerifiedSiteDelegation(value: unknown): value is SiteEditorDelegation {
  return !!value && typeof value === "object" && verifiedDelegations.has(value);
}

/** Signed claims plus live identity, native grant, membership, tenant and local
 * delegation. The returned host client never reaches arbitrary MCP tools. */
export async function authenticateSiteEditor(token: string): Promise<SiteEditorDelegation> {
  const config = siteEditorOAuthConfig();
  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await authClient.auth.getClaims(token);
  const claims = verified.data?.claims;
  if (verified.error || !claims || claims.iss !== config.issuer ||
    claims.aud !== config.resource || claims.role !== "mcp_site_editor" ||
    typeof claims.client_id !== "string" || !config.clientIds.includes(claims.client_id) ||
    !z.uuid().safeParse(claims.session_id).success || !z.uuid().safeParse(claims.sub).success ||
    typeof claims.exp !== "number" || claims.exp <= Date.now()/1000)
    throw new Error("Site Studio OAuth token is invalid or has the wrong audience");
  const userResult = await authClient.auth.getUser(token);
  const user = userResult.data.user;
  if (userResult.error || !user || user.id !== claims.sub || user.is_anonymous || !isConfiguredAdmin(user.email))
    throw new Error("Only the installation owner can delegate Site Studio");
  // Native OAuth revocation is checked on every request, not inferred from JWT
  // expiry. This is the same endpoint used by supabase.auth.oauth.listGrants.
  const native = await fetch(`${config.issuer}/user/oauth/grants`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    signal: AbortSignal.timeout(5000), redirect: "error", cache: "no-store",
  });
  if (!native.ok) throw new Error("OAuth grant verification unavailable");
  const grants = z.array(z.object({ client: z.object({ id: z.string() }) })).parse(await readBoundedJson(native, 128_000));
  if (!grants.some(grant => grant.client.id === claims.client_id))
    throw new Error("OAuth grant was revoked");
  const database = siteEditorHost();
  const [tenant, membership, delegation] = await Promise.all([
    database.from("tenants").select("id,slug,name,status,config").eq("id", ACCELERATE_TENANT_ID).maybeSingle(),
    database.from("tenant_memberships").select("role,status").eq("tenant_id", ACCELERATE_TENANT_ID).eq("user_id", user.id).maybeSingle(),
    database.from("site_editor_delegations").select("*").eq("tenant_id", ACCELERATE_TENANT_ID).eq("user_id", user.id)
      .eq("client_id", claims.client_id).eq("resource", config.resource).is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (tenant.error || !tenant.data || membership.error || membership.data?.role !== "admin" ||
    membership.data.status !== "active" || delegation.error || !delegation.data)
    throw new Error("Site Studio delegation is missing, expired, or revoked");
  const auth: AdminAuthorization = {
    kind: "actor", tenant: tenant.data as TenantSummary, user: { id: user.id, email: user.email },
    role: "admin", isPlatformAdmin: true, database,
  };
  assertWebsiteOwner(auth);
  const authorized = await database.rpc("authorize_site_editor_delegation", {
    p_grant_id: delegation.data.id, p_user_id: user.id, p_client_id: claims.client_id,
    p_session_id: claims.session_id,
  });
  if (authorized.error) throw new Error("Site Studio session or delegation revoked");
  const result = { auth, grant: siteDelegationSchema.parse(delegation.data), sessionId: claims.session_id as string };
  verifiedDelegations.add(result);
  return result;
}

export async function manageSiteDelegation(auth: AdminAuthorization, input: { operation: "grant"; clientId: string } | { operation: "revoke"; grantId: string }) {
  assertWebsiteOwner(auth);
  const config = siteEditorOAuthConfig();
  if (input.operation === "grant" && !config.clientIds.includes(input.clientId)) throw new Error("OAuth client is not allowed");
  // Only this command is elevated after requireAdmin's live owner verification.
  const scoped = siteEditorHost();
  const { data, error } = await scoped.rpc("manage_site_editor_delegation", {
    p_operation: input.operation, p_user_id: auth.user.id,
    p_client_id: input.operation === "grant" ? input.clientId : null,
    p_resource: config.resource, p_actor_email: auth.user.email ?? auth.user.id,
    p_grant_id: input.operation === "revoke" ? z.uuid().parse(input.grantId) : null,
  });
  if (error) throw new Error("Site Studio delegation could not be changed");
  return siteDelegationSchema.parse(data);
}
export async function listSiteDelegations(auth: AdminAuthorization) {
  assertWebsiteOwner(auth);
  const database = siteEditorHost();
  const { data, error } = await database.from("site_editor_delegations").select("*")
    .eq("tenant_id", auth.tenant.id).eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Site Studio delegations unavailable");
  return (data ?? []).map(row => siteDelegationSchema.parse(row));
}
export async function executeDelegatedSiteChange(delegation: unknown, raw: unknown) {
  if (!isVerifiedSiteDelegation(delegation)) throw new Error("Connect with owner-approved Site Studio OAuth to execute changes");
  const input = siteEditorExecuteSchema.parse(raw);
  const { auth, grant } = delegation;
  assertWebsiteOwner(auth);
  const { data: action, error: readError } = await auth.database.from("action_queue").select("payload")
    .eq("tenant_id", auth.tenant.id).eq("id", input.actionId).eq("action_type", "site_website_change").maybeSingle();
  if (readError || !action) throw new Error("Website proposal unavailable");
  const command = parseWebsiteCommand(action.payload.command);
  if (websiteCommandDigest(command) !== input.digest || action.payload.digest !== input.digest || action.payload.summary !== input.summary)
    throw new Error("Exact website preview and summary required");
  const host = siteEditorHost();
  const { data, error } = await host.rpc("execute_delegated_site_change", {
    p_grant_id: grant.id, p_user_id: auth.user.id, p_client_id: grant.client_id, p_session_id: delegation.sessionId,
    p_action_id: input.actionId, p_digest: input.digest, p_summary: input.summary,
    p_actor_email: auth.user.email ?? auth.user.id, p_command: command,
  });
  if (error) throw new Error("The delegated website change was refused. Read the current state and delegation before retrying.");
  return z.object({
    id: z.uuid(), action_type: z.literal("site_website_change"), receipt: websiteReceiptSchema,
    authorization: z.object({ mode: z.literal("delegated"), scope: z.literal("site-studio"), grantId: z.uuid(), clientId: z.string(), userId: z.uuid() }).strict(),
  }).strict().parse(data);
}
