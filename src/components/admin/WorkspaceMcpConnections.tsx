"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/admin/fetchJson";
import { AdminSurface } from "@/components/admin/AdminSurface";

type Grant = {
  id: string;
  client_id: string;
  expires_at: string;
  revoked_at: string | null;
};
type Data = {
  resource?: string;
  delegations?: Grant[];
  authorization?:
    | {
        authorization_id: string;
        client: { id: string; name: string };
        scope: string;
        redirect_uri: string;
      }
    | { redirect_url: string };
};

export function WorkspaceMcpConnections({
  authorizationId,
  tenantSlug,
}: {
  authorizationId?: string;
  tenantSlug?: string;
}) {
  const endpoint = "/api/admin/mcp/delegations";
  const requestHeaders = tenantSlug ? { "x-tenant-slug": tenantSlug } : undefined;
  const query = useQuery<Data, Error>({
    queryKey: ["workspace-mcp-connections", tenantSlug ?? "", authorizationId ?? ""],
    queryFn: ({ signal }) =>
      fetchJson<Data>(
        endpoint +
          (authorizationId ? `?authorization_id=${encodeURIComponent(authorizationId)}` : ""),
        { signal, headers: requestHeaders },
      ),
  });
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  async function change(input: unknown) {
    setPending(true);
    setNotice(null);
    try {
      const result = await fetchJson<{ redirectUrl?: string }>(endpoint, {
        method: "POST",
        headers: { ...requestHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      await query.refetch();
      setNotice("Connection updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Connection change failed.");
    } finally {
      setPending(false);
    }
  }
  const authorization = query.data?.authorization;
  return (
    <AdminSurface className="space-y-5">
      <h1 className="admin-page-title">Connect a workspace MCP app</h1>
      <p className="admin-copy">
        This connection can read available workspace records and stage business changes in the
        approval queue. Some tools also record supporting internal evidence. It cannot approve its
        own proposals. Available tools depend on enabled modules and provider connections; it does
        not cover every admin action.
      </p>
      <p className="admin-copy">
        Access lasts 30 days and can be revoked here. Custom ChatGPT MCP apps currently work on web,
        not in the phone app. A workspace MCP key is not used for this OAuth connection.
      </p>
      {(notice || query.error) && (
        <p role="status" className="admin-copy">
          {notice || String(query.error)}
        </p>
      )}
      {!query.data && !query.error && <p role="status">Loading connection…</p>}
      {authorization && "client" in authorization && (
        <section className="space-y-4">
          <h2 className="admin-section-title">Authorize {authorization.client.name}</h2>
          <p className="admin-copy">
            Client: <code>{authorization.client.id}</code>. Identity scopes: {authorization.scope}.
          </p>
          <p className="admin-copy">
            After your decision, return to {new URL(authorization.redirect_uri).hostname}.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="admin-button admin-button--primary"
              disabled={pending}
              onClick={() => change({ operation: "consent", authorizationId, decision: "approve" })}
            >
              Allow workspace MCP access for 30 days
            </button>
            <button
              type="button"
              className="admin-button admin-button--secondary"
              disabled={pending}
              onClick={() => change({ operation: "consent", authorizationId, decision: "deny" })}
            >
              Deny access
            </button>
          </div>
        </section>
      )}
      {authorization && "redirect_url" in authorization && (
        <button
          type="button"
          className="admin-button admin-button--primary"
          onClick={() => window.location.assign(authorization.redirect_url)}
        >
          Return to the connected client
        </button>
      )}
      {query.data?.resource && (
        <p className="admin-copy">
          MCP endpoint: <code className="break-all">{query.data.resource}</code>
        </p>
      )}
      {query.data?.delegations?.length === 0 && (
        <p className="admin-copy">
          No OAuth connections yet. Complete the installation setup, then add this endpoint in a
          supported MCP client.
        </p>
      )}
      {query.data?.delegations?.map((grant) => (
        <section key={grant.id} className="space-y-3 border-t border-[var(--admin-border)] pt-4">
          <p className="admin-copy break-all">Client {grant.client_id}</p>
          <p className="admin-copy">
            {grant.revoked_at
              ? "Revoked"
              : `Expires ${new Date(grant.expires_at).toLocaleString()}`}
          </p>
          {!grant.revoked_at && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="admin-button admin-button--secondary"
                disabled={pending}
                onClick={() => change({ operation: "revoke", grantId: grant.id })}
              >
                Revoke access
              </button>
              <button
                type="button"
                className="admin-button admin-button--secondary"
                disabled={pending}
                onClick={() => change({ operation: "renew" })}
              >
                Renew for 30 days
              </button>
            </div>
          )}
        </section>
      ))}
    </AdminSurface>
  );
}
