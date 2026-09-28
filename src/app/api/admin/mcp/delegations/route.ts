import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  listWorkspaceMcpDelegations,
  manageWorkspaceMcpDelegation,
  workspaceMcpOAuthConfig,
} from "@/lib/revenue-os/workspace-mcp-oauth";

const headers = { "Cache-Control": "private, no-store" };
const authorizationId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
const command = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("consent"),
      authorizationId,
      decision: z.enum(["approve", "deny"]),
    })
    .strict(),
  z.object({ operation: z.literal("revoke"), grantId: z.uuid() }).strict(),
  z.object({ operation: z.literal("renew") }).strict(),
]);

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const config = workspaceMcpOAuthConfig(auth.tenant.slug);
    const id = new URL(request.url).searchParams.get("authorization_id");
    if (id) {
      const details = await auth.database.auth.oauth.getAuthorizationDetails(
        authorizationId.parse(id),
      );
      if (details.error || !details.data) throw new Error("OAuth authorization unavailable");
      if (
        "client" in details.data &&
        (details.data.client.id !== config.clientId || details.data.user.id !== auth.user.id)
      )
        throw new Error("This OAuth client is not allowed for this workspace");
      return NextResponse.json(
        { authorization: details.data, resource: config.resource },
        { headers },
      );
    }
    return NextResponse.json(
      { delegations: await listWorkspaceMcpDelegations(auth), resource: config.resource },
      { headers },
    );
  } catch {
    console.warn("[workspace-mcp] Connection read refused");
    return NextResponse.json(
      {
        error:
          "Workspace MCP OAuth is unavailable. Check the client, native OAuth server, and migration.",
      },
      { status: 403, headers },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Confirm connections on this installation" },
      { status: 403, headers },
    );
  try {
    const config = workspaceMcpOAuthConfig(auth.tenant.slug);
    const input = command.parse(await readBoundedJson(request, 4096));
    if (input.operation === "revoke") {
      const grant = await manageWorkspaceMcpDelegation(auth, input);
      const native = await auth.database.auth.oauth
        .revokeGrant({ clientId: grant.client_id })
        .catch(() => ({ error: true }));
      if (native.error)
        console.warn("[workspace-mcp] Local revocation saved; native revocation needs retry");
      return NextResponse.json({ revoked: true }, { headers });
    }
    if (input.operation === "renew") {
      const native = await auth.database.auth.oauth.listGrants();
      if (native.error || !native.data?.some((grant) => grant.client.id === config.clientId))
        throw new Error("Reconnect this OAuth client before renewing");
      return NextResponse.json(
        { grant: await manageWorkspaceMcpDelegation(auth, { operation: "grant" }) },
        { headers },
      );
    }
    const details = await auth.database.auth.oauth.getAuthorizationDetails(input.authorizationId);
    if (details.error || !details.data) throw new Error("OAuth authorization unavailable");
    if (!("client" in details.data))
      return NextResponse.json({ redirectUrl: details.data.redirect_url }, { headers });
    if (details.data.client.id !== config.clientId || details.data.user.id !== auth.user.id)
      throw new Error("OAuth client or identity does not match this workspace admin");
    const grant =
      input.decision === "approve"
        ? await manageWorkspaceMcpDelegation(auth, { operation: "grant" })
        : null;
    const result =
      input.decision === "approve"
        ? await auth.database.auth.oauth.approveAuthorization(input.authorizationId, {
            skipBrowserRedirect: true,
          })
        : await auth.database.auth.oauth.denyAuthorization(input.authorizationId, {
            skipBrowserRedirect: true,
          });
    if (result.error || !result.data) {
      if (grant)
        await manageWorkspaceMcpDelegation(auth, { operation: "revoke", grantId: grant.id });
      throw new Error("OAuth consent could not be completed");
    }
    return NextResponse.json({ redirectUrl: result.data.redirect_url }, { headers });
  } catch {
    console.warn("[workspace-mcp] Connection change refused");
    return NextResponse.json(
      { error: "Connection change failed. Reload before retrying." },
      { status: 400, headers },
    );
  }
}
