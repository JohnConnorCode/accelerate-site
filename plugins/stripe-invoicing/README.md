# Stripe invoicing

Prepare an invoice for an existing contact, approve its creation in Stripe, and
manage a reviewed send and branded invoice page through the shared platform.
This plugin starts disabled. Creating a draft is distinct from sending it or
receiving payment.

## Complete an invoice

1. Enable **Stripe invoicing** in **Plugins**. Configure the workspace's Stripe
   connection through **Integrations**, using the platform's server-only secret
   storage. Verify test/live mode before any provider action.
2. Open `/admin/invoicing`. Select an existing contact and enter currency, line
   descriptions, quantities and unit amounts. Amounts use currency minor units;
   USD 125.00 is 12500. Confirm the due-date and recipient details in the preview.
3. Submit the exact invoice draft for approval. After approval, inspect the
   provider result and local execution receipt. A pending approval has not
   created a Stripe invoice.
4. Use the separate reviewed send control when ready. Inspect its receipt before
   retrying. A sent invoice is not proof of payment.
5. Use the invoice presentation controls and workspace branding for a customer
   page. Review AI-assisted design before the separate publication approval;
   revoke the public page when required. Never put secrets or private notes in
   public invoice presentation content.

For a fictional example, select a demo contact and prepare one consulting line,
quantity 1, unit amount 12500 in USD. Expect a USD 125.00 draft after simulated
approval. All five full command-center demos use the actual admin components
with fictional records and a simulated provider. Demo customer previews remain
inside that browser scenario; they are not live public links.

## AI, costs and permissions

AI preparation/proposal uses `prepare_stripe_invoice` and
`propose_stripe_invoice`. Sending uses the registered Stripe invoice adapter;
page design/publication uses the registered invoice-page operations. These call
shared services and the approval queue; a model never receives a Stripe secret
or authority to approve its own action. The host rechecks tenant identity,
activation, provider state, inputs and approval freshness.

Deterministic draft preparation has no model charge. Actual Stripe services can
incur provider charges; AI presentation and chat use the configured workspace
model and its usage limits. There is no plugin-specific unlimited free tier.
Credentials belong in the existing encrypted connection path, not module settings.

## Disable and recover

Disable in **Plugins** to prevent later plugin execution. Existing provider
invoices, payments, local receipts and published pages are not automatically
undone. Revoke public pages using their explicit controls; do not assume a toggle
removes something already published.

If the connection or contact is unavailable, correct it and preview again.
Changed input, source or code requires a fresh preview and approval. After a
provider timeout or uncertain result, reconcile the existing action and provider
invoice with its stable idempotency identity before retrying. Never create a new
request simply to bypass an uncertain receipt. Failure or HTTP success alone is
not proof of provider completion.

## Verify and extend

Run `npm run test:stripe-workflow` and `npm run test:business-workflows` for
controlled provider transports, approval/retry, AI dispatch and page operations.
Run `npm run qa:demo-business-workflows` for shared demo UI. These commands do not
prove a particular live Stripe connection or a completed payment. The separate
provider verification procedure and historical test-mode evidence are in the
[extension guide](../../docs/contributing/EXTENDING.md).

Use the [manifest](../../extensions/stripe-invoicing.module.json),
[`workflow.js`](workflow.js),
[Stripe contract](../../src/lib/revenue-os/stripe-contract.ts) and
[tool registration](../../src/lib/revenue-os/plugin-tool-contract.ts).
Keep provider effects in reviewed native adapters. Regenerate with
`npm run build:extensions`; run `npm run verify:extensions` and
`npm run test:plugin-workflow-contract`. An upgrade to guest or host contracts
invalidates pending previews, which must be prepared again. Follow the
[documentation contract](../../docs/contracts/PLUGIN-DOCUMENTATION.md).
