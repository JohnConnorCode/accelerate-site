import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { assertWebsiteOwner } from "@/lib/site-studio/website-store";
import {
  listSiteDelegations,
  manageSiteDelegation,
  siteEditorOAuthConfig,
} from "@/lib/site-studio/delegation";
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
  z.object({ operation: z.literal("renew"), clientId: z.uuid() }).strict(),
]);
export async function GET(request: Request) {
  const auth = await requireAdminForModule("site-studio");
  if (auth instanceof NextResponse) return auth;
  try {
    assertWebsiteOwner(auth);
    const config = siteEditorOAuthConfig();
    const id = new URL(request.url).searchParams.get("authorization_id");
    if (id) {
      const { data, error } = await auth.database.auth.oauth.getAuthorizationDetails(
        authorizationId.parse(id),
      );
      if (error || !data) throw new Error("OAuth authorization unavailable");
      if (
        "client" in data &&
        (!config.clientIds.includes(data.client.id) || data.user.id !== auth.user.id)
      )
        throw new Error("This OAuth client is not allowed for Site Studio");
      return NextResponse.json({ authorization: data }, { headers });
    }
    return NextResponse.json(
      { delegations: await listSiteDelegations(auth), resource: config.resource },
      { headers },
    );
  } catch {
    console.warn("[site-studio] OAuth connection read refused or unavailable");
    return NextResponse.json(
      {
        error:
          "Site Studio OAuth is unavailable. Check the configured client, native OAuth server, and migrations.",
      },
      { status: 403, headers },
    );
  }
}
export async function POST(request: Request) {
  const auth = await requireAdminForModule("site-studio");
  if (auth instanceof NextResponse) return auth;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Confirm connections on this installation" },
      { status: 403, headers },
    );
  try {
    assertWebsiteOwner(auth);
    const input = command.parse(await readBoundedJson(request, 4096));
    if (input.operation === "revoke") {
      const grant = await manageSiteDelegation(auth, {
        operation: "revoke",
        grantId: input.grantId,
      });
      // The local revocation is already durable. A provider outage cannot undo it.
      const native = await auth.database.auth.oauth
        .revokeGrant({ clientId: grant.client_id })
        .catch(() => ({ error: true }));
      if (native.error)
        console.warn("[site-studio] Local revocation saved; native grant revocation needs retry");
      return NextResponse.json({ revoked: true }, { headers });
    }
    if (input.operation === "renew") {
      const native = await auth.database.auth.oauth.listGrants();
      if (native.error || !native.data?.some((grant) => grant.client.id === input.clientId))
        throw new Error("Reconnect this OAuth client before renewing");
      return NextResponse.json(
        {
          grant: await manageSiteDelegation(auth, { operation: "grant", clientId: input.clientId }),
        },
        { headers },
      );
    }
    const details = await auth.database.auth.oauth.getAuthorizationDetails(input.authorizationId);
    if (details.error || !details.data) throw new Error("OAuth authorization unavailable");
    if (!("client" in details.data))
      return NextResponse.json({ redirectUrl: details.data.redirect_url }, { headers });
    if (
      !siteEditorOAuthConfig().clientIds.includes(details.data.client.id) ||
      details.data.user.id !== auth.user.id
    )
      throw new Error("OAuth client or identity does not match this owner");
    let grant;
    if (input.decision === "approve") {
      grant = await manageSiteDelegation(auth, {
        operation: "grant",
        clientId: details.data.client.id,
      });
    }
    const result =
      input.decision === "approve"
        ? await auth.database.auth.oauth.approveAuthorization(input.authorizationId, {
            skipBrowserRedirect: true,
          })
        : await auth.database.auth.oauth.denyAuthorization(input.authorizationId, {
            skipBrowserRedirect: true,
          });
    if (result.error || !result.data) {
      if (grant) await manageSiteDelegation(auth, { operation: "revoke", grantId: grant.id });
      throw new Error("OAuth consent could not be completed");
    }
    return NextResponse.json({ redirectUrl: result.data.redirect_url }, { headers });
  } catch {
    console.warn("[site-studio] OAuth connection change failed; reload connection state");
    return NextResponse.json(
      {
        error:
          "Connection change failed. Reload to inspect the current authorization before retrying.",
      },
      { status: 400, headers },
    );
  }
}
