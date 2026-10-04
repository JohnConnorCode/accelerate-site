import { qaPage, qaAction, qaStripeConnection } from "./lib/qa-business-fixtures.mjs";
import { createServer } from "node:http";
const user = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "qa@example.example",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const tenant = {
  id: "acce1e8e-0000-4000-8000-000000000001",
  slug: "accelerate",
  name: "Example Studio",
  status: "active",
  config: {
    modules: { "stripe-invoicing": true, "client-onboarding": true, "meeting-commitments": true },
  },
};
createServer((request, response) => {
  const url = new URL(request.url, "http://localhost"),
    path = url.pathname;
  response.setHeader("Content-Type", "application/json");
  if (request.method === "POST" && path === "/rest/v1/rpc/consume_rate_limit") {
    let body = "";
    request.on("data", (chunk) => {
      if (body.length <= 1024) body += chunk.toString();
    });
    request.on("end", () => {
      try {
        if (body.length > 1024) throw new Error("Fixture request too large");
        const input = JSON.parse(body);
        if (
          Object.keys(input).sort().join(",") !== "p_key,p_limit,p_window_ms" ||
          typeof input.p_key !== "string" ||
          !/^[a-f0-9]{64}$/.test(input.p_key) ||
          !Number.isSafeInteger(input.p_limit) ||
          input.p_limit < 1 ||
          input.p_limit > 10000 ||
          !Number.isSafeInteger(input.p_window_ms) ||
          input.p_window_ms < 1 ||
          input.p_window_ms > 86400000
        )
          throw new Error("Invalid fixture rate-limit policy");
        // Fictional abuse metadata only; business-record writes remain refused.
        response.end(
          JSON.stringify({ allowed: true, remaining: input.p_limit - 1, retry_after: 0 }),
        );
      } catch {
        response.writeHead(400);
        response.end(JSON.stringify({ message: "Invalid controlled rate-limit request" }));
      }
    });
    return;
  }
  if (request.method !== "GET") {
    response.writeHead(405);
    response.end(JSON.stringify({ message: "Read-only controlled QA fixture" }));
    return;
  }
  if (path === "/auth/v1/user") {
    response.end(JSON.stringify(user));
    return;
  }
  const rows =
    path === "/rest/v1/invoice_pages"
      ? url.searchParams.get("token_hash") === `eq.${qaPage.token_hash}` ||
        url.searchParams.get("id") === `eq.${qaPage.id}`
        ? [qaPage]
        : []
      : path === "/rest/v1/integration_connections"
        ? [qaStripeConnection]
        : path === "/rest/v1/action_queue"
          ? [
              {
                id: qaAction,
                status: "executed",
                payload: { accountId: "acct_fixture", testMode: true, total: 50000 },
                result: { invoiceId: "in_fixture", complete: true },
              },
            ]
          : path === "/rest/v1/tenants"
            ? [tenant]
            : path === "/rest/v1/tenant_memberships"
              ? [
                  {
                    tenant_id: tenant.id,
                    user_id: user.id,
                    status: "active",
                    role: "admin",
                    invited_email: user.email,
                  },
                ]
              : [];
  response.end(JSON.stringify(rows));
}).listen(3044, "127.0.0.1", () =>
  console.log("Controlled read-only Supabase fixture listening on 3044"),
);
