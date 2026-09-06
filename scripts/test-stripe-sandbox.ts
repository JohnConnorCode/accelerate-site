/** Opt-in real Stripe test-mode proof. No application database connection.
 * Requires an explicit expected account; creates only fictional QA records. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { encryptTenantSecret } from "../src/lib/revenue-os/encryption";
import {
  prepareWorkflowPlugin,
  proposeWorkflowPlugin,
} from "../src/lib/revenue-os/workflow-plugins";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { retryPluginAction } from "../src/lib/revenue-os/actions";
import {
  proposeStripeInvoiceSend,
  readStripeInvoiceForAction,
} from "../src/lib/revenue-os/stripe-invoicing";
import {
  previewInvoicePage,
  proposeInvoicePage,
  listInvoicePages,
  readPublicInvoicePage,
  revokeInvoicePage,
} from "../src/lib/revenue-os/invoice-pages";
import { defaultInvoiceDesign } from "../src/lib/revenue-os/invoice-page-contract";
async function main() {
  const expectedAccount = process.env.STRIPE_SANDBOX_ACCOUNT;
  assert.ok(expectedAccount, "Set the explicitly selected test account ID");
  const key =
    process.env.STRIPE_TEST_API_KEY ??
    readFileSync(join(homedir(), ".config/stripe/config.toml"), "utf8").match(
      /\b[sr]k_test_[A-Za-z0-9]+/,
    )?.[0];
  assert.ok(
    key && /^(?:sk|rk)_test_[A-Za-z0-9]+$/.test(key),
    "A test credential is required; live keys are refused",
  );
  const originalFetch = globalThis.fetch;
  let loseLineResponse = false,
    creates = 0,
    lineCalls = 0;
  let createdInvoiceId: string | undefined;
  const priorEncryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  const requests: { method: string; path: string; status: number; requestId: string | null }[] = [];
  globalThis.fetch = async (url, init) => {
    const u = new URL(String(url));
    assert.equal(u.origin, "https://api.stripe.com");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer " + key);
    const response = await originalFetch(url, init);
    requests.push({
      method: init?.method ?? "GET",
      path: u.pathname,
      status: response.status,
      requestId: response.headers.get("request-id"),
    });
    if (u.pathname === "/v1/invoices" && init?.method === "POST") {
      creates++;
      if (response.ok) createdInvoiceId = (await response.clone().json()).id;
    }
    if (u.pathname.endsWith("/add_lines")) {
      lineCalls++;
      if (loseLineResponse && response.ok) {
        loseLineResponse = false;
        await response.arrayBuffer();
        return new Response("{}", { status: 503 });
      }
    }
    return response;
  };
  const api = async (path: string, body?: Record<string, string>) => {
    const res = await fetch("https://api.stripe.com/v1" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + key,
        "Stripe-Version": "2025-06-30.basil",
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: body ? new URLSearchParams(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const result = await res.json();
    if (!res.ok)
      throw new Error(
        "Stripe " + res.status + " " + (result.error?.code ?? result.error?.type ?? "unknown"),
      );
    return result;
  };
  try {
    const account = await api("/account");
    assert.equal(account.id, expectedAccount, "Refuse unexpected Stripe account");
    const tenantId = randomUUID(),
      contactId = randomUUID(),
      email = "accelerate-qa-" + tenantId + "@example.invalid";
    const customer = await api("/customers", {
      name: "Accelerate disposable invoicing QA",
      email,
      "metadata[accelerate_sandbox_test]": tenantId,
    });
    assert.equal(customer.livemode, false);
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomUUID();
    const mem = new AuthorizedMemorySupabase({
      tenants: [
        {
          id: tenantId,
          name: "Accelerate sandbox QA",
          status: "active",
          config: { modules: { "stripe-invoicing": true } },
        },
      ],
      contacts: [
        { id: contactId, tenant_id: tenantId, full_name: customer.name, primary_email: email },
      ],
      entity_types: [
        {
          id: "contacts",
          tenant_id: tenantId,
          type_key: "workflow_contacts",
          backing_table: "contacts",
          id_column: "id",
          is_disabled: false,
          metadata: { readable_columns: ["full_name", "primary_email"] },
        },
      ],
      integration_connections: [
        {
          id: randomUUID(),
          tenant_id: tenantId,
          provider: "stripe",
          status: "connected",
          credential_version: 1,
          account_email: account.id,
          encrypted_credentials: {
            api_key: encryptTenantSecret(key, tenantId, "stripe", "api_key"),
          },
        },
      ],
    });
    mem.idFactory = () => randomUUID();
    const db = bindTenantDatabase(mem.client, tenantId, true);
    const actor = "qa@example.invalid";
    const input = {
      contactId,
      customerId: customer.id,
      currency: "usd",
      daysUntilDue: 14,
      memo: "Disposable test invoice; no real service or payment",
      lines: [{ description: "Sandbox workflow check", quantity: 2, unitAmount: 250 }],
    };
    const preview = await prepareWorkflowPlugin(db, "stripe-invoicing", input);
    assert.equal(preview.payload.total, 500);
    const requestId = randomUUID();
    const proposed = await proposeWorkflowPlugin(
      db,
      "stripe-invoicing",
      input,
      preview.digest,
      requestId,
      actor,
    );
    assert.equal(
      (await proposeWorkflowPlugin(db, "stripe-invoicing", input, preview.digest, requestId, actor))
        .id,
      proposed.id,
    );
    assert.equal(creates, 0);
    loseLineResponse = true;
    await assert.rejects(
      () => approveAndExecuteAction(db, proposed.id, actor),
      /Stripe request failed/,
    );
    const failed = mem.rows("action_queue").find((r) => r.id === proposed.id)!;
    assert.equal(failed.status, "failed");
    assert.ok((failed.result as { invoiceId: string }).invoiceId);
    await retryPluginAction(db, proposed.id, actor);
    const draft = (await approveAndExecuteAction(
      db,
      proposed.id,
      actor,
    )) as import("../src/lib/revenue-os/stripe-contract").StripeInvoiceReceipt;
    assert.equal(draft.complete, true);
    assert.equal(draft.amountDue, 500);
    assert.equal(creates, 1);
    assert.equal(lineCalls, 2);
    const actual = await api("/invoices/" + draft.invoiceId);
    assert.equal(actual.lines.data.length, 1);
    assert.equal(actual.total, 500);
    assert.equal(actual.livemode, false);
    await assert.rejects(() => approveAndExecuteAction(db, proposed.id, actor), /already handled/);
    const send = await proposeStripeInvoiceSend(db, proposed.id, actor);
    (mem.rows("tenants")[0]!.config as { modules: Record<string, boolean> }).modules[
      "stripe-invoicing"
    ] = false;
    await assert.rejects(() => approveAndExecuteAction(db, send.id, actor), /disabled/);
    (mem.rows("tenants")[0]!.config as { modules: Record<string, boolean> }).modules[
      "stripe-invoicing"
    ] = true;
    await retryPluginAction(db, send.id, actor);
    const sent = (await approveAndExecuteAction(
      db,
      send.id,
      actor,
    )) as import("../src/lib/revenue-os/stripe-contract").StripeInvoiceReceipt;
    assert.equal(sent.status, "open");
    assert.equal(sent.delivery, "not_sent_test_mode");
    const design = await previewInvoicePage(db, proposed.id, defaultInvoiceDesign);
    assert.equal(design.document.total, 500);
    const publication = await proposeInvoicePage(
      db,
      {
        creationActionId: proposed.id,
        design: defaultInvoiceDesign,
        digest: design.digest,
        requestId: randomUUID(),
      },
      actor,
    );
    const published = (await approveAndExecuteAction(db, publication.id, actor)) as {
      pageId: string;
    };
    const links = await listInvoicePages(db, proposed.id);
    assert.equal((await readPublicInvoicePage(db, links[0]!.token!)).document.amountRemaining, 500);
    await revokeInvoicePage(db, published.pageId, actor);
    await assert.rejects(() => readPublicInvoicePage(db, links[0]!.token!), /unavailable/);
    const final = await readStripeInvoiceForAction(db, proposed.id);
    assert.equal(final.receipt.amountRemaining, 500);
    // Only the exact test invoice created above is voided; retain provider audit history.
    const voided = await api("/invoices/" + draft.invoiceId + "/void", {});
    assert.equal(voided.status, "void");
    assert.equal(voided.livemode, false);
    const evidence = {
      verifiedAt: new Date().toISOString(),
      accountId: account.id,
      customerId: customer.id,
      invoiceId: draft.invoiceId,
      amount: 500,
      currency: "usd",
      creates,
      lineCalls,
      finalStatus: "void",
      applicationDatabase: "isolated in-memory domain fixture; real Stripe transport",
      checks: [
        "real QuickJS and shared approval executor",
        "lost successful add-lines response, idempotent retry, exactly one invoice and one line",
        "duplicate approval refused",
        "disabled queued send refused",
        "finalize and test send accepted",
        "branded publication and revocation with live Stripe facts",
      ],
      requests,
    };
    writeFileSync(
      join(tmpdir(), "accelerate-stripe-sandbox-evidence.json"),
      JSON.stringify(evidence, null, 2),
      { mode: 0o600 },
    );
    console.log(JSON.stringify(evidence));
  } finally {
    try {
      if (createdInvoiceId) {
        const current = await api("/invoices/" + createdInvoiceId);
        assert.equal(current.livemode, false);
        if (current.status === "open") await api("/invoices/" + createdInvoiceId + "/void", {});
        else if (current.status === "draft")
          console.error("Test draft retained for inspection: " + createdInvoiceId);
      }
    } finally {
      globalThis.fetch = originalFetch;
      if (priorEncryptionKey === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
      else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = priorEncryptionKey;
    }
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Sandbox verification failed");
  process.exitCode = 1;
});
