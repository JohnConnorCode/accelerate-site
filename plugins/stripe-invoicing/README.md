# Stripe invoicing

Prepare an invoice for an existing contact, approve its creation in Stripe, and
manage a reviewed send and branded invoice page through the shared platform.
This plugin starts disabled. Creating a draft is distinct from sending it or
receiving payment.

## Complete an invoice

1. Open **Apps**, select **Pluggable Modules**, and enable **Stripe invoicing**.
   The invoice creation page provides the workspace's Stripe connection controls,
   using the platform's server-only secret storage. Verify test/live mode before
   any provider action.
2. Open **Invoices** directly from the sidebar (or the mobile **Menu**), then
   select **Create invoice**. You can also search for **Create invoice** with
   Command/Ctrl+K. The direct creation link is `/admin/invoicing?view=create`.
   A won opportunity also provides **Create invoice**, preserving its exact contact
   through `/admin/invoicing?view=create&contactId=<contact-uuid>`. The selected
   contact remains in the bounded choices even outside the current name search.
   If the module is off, search for **invoice** and choose **Set up invoicing**
   to reach its enablement instructions. If Stripe is disconnected, the creation
   page shows the connection step first.
   Select an existing contact and its matching Stripe
   billing customer. When none exists, use **Create billing customer** and approve the contact identity; the resulting profile appears in the refreshed choices without a charge. Enter currency, line descriptions, quantities and unit prices
   in normal currency units: enter `125.00` for USD 125.00. Set payment terms
   (1–90 days) and confirm recipient details in the preview. The API/AI input
   represents that same unit price as `unitAmount: 12500` in minor units.
3. Submit the exact invoice draft for approval. After approval, inspect the
   provider result and local execution receipt. A pending approval has not
   created a Stripe invoice.
4. Use the separate reviewed send control when ready. Inspect its receipt before
   retrying. A sent invoice is not proof of payment.
5. Choose **Design customer page** in **Invoice operations** for a workspace-created
   invoice. The live preview opens the latest active published design or the workspace
   defaults. Enter **Describe your changes**, then **Apply AI changes** to refine the
   current draft. For example: “Keep my wording. Use editorial layout, serif typography,
   compact spacing, and #164e63.” **Undo changes** and **Redo changes** navigate up to 40 editing steps, including AI
   revisions and manual edits. Consecutive typing in one field is one step.
   Layout, typography, spacing, accent color and wording are also directly editable.
   Logo and business identity remain workspace branding. **Workspace**, **Editorial**,
   and **Minimal** style starters preserve your wording and accent color. Choose
   **Phone** to check a narrow customer view, then **Full width** to return. Draft
   edits last until you close the editor; publish a reviewed version to save it.
6. Choose **Preview page**, then **Request publication approval**. Edits invalidate
   that review. After execution, refresh published links, then open the customer page or copy its link.
   Each publication creates a new link; existing links keep their approved design.
   **Edit this design** reuses a saved version. Revoke an old link explicitly.
   Publishing does not email the customer. Never put secrets or private notes in
   public invoice presentation content.

The custom page links to Stripe for secure payment. Its layout does not replace
Stripe's hosted payment form or invoice PDF; those retain Stripe's own settings.
Invoice identity, amounts, due dates and payment state remain provider facts.

For a fictional example, select a demo contact and prepare one consulting line,
quantity 1, unit price `125.00` in USD. Expect a USD 125.00 draft after simulated
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

Disable in **Apps → Pluggable Modules** to prevent later plugin execution. Existing provider
invoices and payments are not reversed, and local receipts and published pages
remain stored. Customer-page links stop resolving while the module is disabled;
re-enabling restores unexpired, unrevoked links. Revoke pages explicitly to end
sharing instead of relying on a temporary disable.

If the connection or contact is unavailable, correct it and preview again.
If no Stripe customer matches the contact’s billing email, correct or add the
customer in Stripe and refresh the choices; do not select an unrelated customer.
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

The admin workspace groups this workflow under **Billing & payments**. The [connected walkthroughs](/docs/start/daily-path) explain its starting situation, review controls, saved result and recovery.
The design contract adds optional per-invoice appearance fields; existing published
designs without these fields retain workspace typography, color and comfortable
spacing. No database migration is needed. Pending plugin previews must still be
prepared again after the host-contract upgrade.

## Payments, cancellations and recovery

Invoices now searches the loaded account records and projects open, overdue and draft balances separately by currency. It states its loaded scope and missing balances. Account-wide invoice and charge reads do not grant write ownership over other workspaces’ records.

**Payments & refunds** reads bounded pages of account charges. It separates captured and refunded amounts, excludes failed/pending charges from captured figures, and exports only selected loaded records with explicit currency/minor-unit columns. Processing fees, disputes, payouts and bank accounting are outside this projection.

`billing-workspace.ts` owns `create_customer`, `void_invoice` and `refund_payment`. The UI and registered AI tools call its preview/proposal service. Approval binds canonical contact identity or live invoice/payment facts, tenant, provider account, key revision and mode to an exact digest. PostgreSQL JSON key ordering cannot invalidate that digest. Cancellation accepts only workspace-owned finalized unpaid invoices. Refunds accept workspace metadata or complete current invoice-payment ownership evidence; shared or unproven ownership refuses.

Billing actions require fresh active administrator membership and an approved, unexpired execution claim. Provider calls reuse a tenant/request idempotency key. A timed-out refund is reconciled from its request-tagged Stripe refund history before another request can be posted. Provider pending/failed refunds retain that actual status. **Recent billing actions** offers exact same-operation re-review for eligible failures, never a fresh blind refund. Disabling invoicing blocks later execution. Existing provider receipts are retained.

The key needs customer/invoice writes, charge/payment-intent/invoice-payment/refund reads and refund writes for these controls. Keep encrypted credentials in the existing tenant connection, with the encryption configuration provided by the host environment. No new secret store or payment provider is introduced. Test mode uses the same services and provider-receipt rules; the browser demo remains fictional.

Verify with `npm run test:billing-workspace`, `npm run test:stripe-workflow`, `npm run test:ai-tool-discovery`, `npm run qa:billing-workspace` and `npm run qa:invoice-navigation`, followed by the repository build and checks. The deterministic provider transport covers approval, freshness, ownership, failures, replay and accepted-refund recovery. Browser checks cover shared admin controls, keyboard, narrow screens and reduced motion. These checks do not establish a particular installation’s live restricted-key permissions or move real funds. Credit notes and accounting-ledger integration are not implemented by this billing slice.

`get_billing_action` and **Check provider result** perform a fresh read for an existing billing action, including an expired action. Refund checks match the immutable tenant/request identity in provider metadata and verify charge, amount and currency. Incomplete history refuses absence claims. The original action receipt is preserved; this observation cannot approve or retry an effect. The same-account/mode guard applies after credential rotation. A pending refund can therefore be checked from Command Center without opening the provider dashboard.
