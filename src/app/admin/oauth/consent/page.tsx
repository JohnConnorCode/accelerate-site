import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { configuredWorkspaceMcpOAuthClients } from "@/lib/revenue-os/workspace-mcp-oauth";

/** Supabase has one authorization path, shared by both scoped MCP connections. */
export default async function McpOAuthConsent({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const authorizationId = z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .safeParse((await searchParams).authorization_id);
  if (!authorizationId.success) return <p>Invalid OAuth authorization request.</p>;
  const auth = await createServerSupabaseClient();
  const { data: identity } = await auth.auth.getUser();
  if (!identity.user)
    redirect(
      `/admin/login?redirect=${encodeURIComponent(`/admin/oauth/consent?authorization_id=${authorizationId.data}`)}`,
    );
  const details = await auth.auth.oauth.getAuthorizationDetails(authorizationId.data);
  if (details.error || !details.data) return <p>OAuth authorization is unavailable.</p>;
  if (!("client" in details.data)) redirect(details.data.redirect_url);
  if (details.data.user.id !== identity.user.id)
    return <p>Sign in as the account named in this authorization request.</p>;
  const clientId = details.data.client.id;
  const siteClients = (process.env.SITE_STUDIO_OAUTH_CLIENT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (siteClients.includes(clientId))
    redirect(`/admin/site/connect?authorization_id=${authorizationId.data}`);
  let clients: Record<string, string> = {};
  try {
    clients = configuredWorkspaceMcpOAuthClients();
  } catch {
    return <p>Workspace MCP OAuth configuration is invalid.</p>;
  }
  const tenantSlug = Object.keys(clients).find((slug) => clients[slug] === clientId);
  if (tenantSlug)
    redirect(
      `/admin/mcp/connect?authorization_id=${authorizationId.data}&tenantSlug=${tenantSlug}`,
    );
  return <p>This OAuth client is not registered for a Command Center connection.</p>;
}
