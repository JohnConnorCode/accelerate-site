# Invoicing

Create invoices that belong to this workspace, share a branded payment page,
and collect payment by bank transfer (ACH) or card. Stripe is used only as the
payment rail: each issued invoice gets one Stripe PaymentIntent. No Stripe
Invoice, invoice item, coupon, subscription or post-payment invoice is created,
so Stripe's per-invoice Invoicing fee never applies. Bank transfers cost Stripe's
ACH rate (0.8%, capped at $5); cards cost the account's card rate.

## Set up

1. Open **Apps**, select **Pluggable Modules**, and enable **Invoicing**.
2. In **Integrations**, connect Stripe with a secret or restricted key, the
   matching publishable key, and a webhook signing secret. Point a Stripe webhook
   at `/api/public/<workspace-slug>/webhooks/stripe` with these events:
   `payment_intent.succeeded`, `payment_intent.processing`,
   `payment_intent.payment_failed`, `payment_intent.canceled` and
   `charge.refunded`.
3. To accept bank transfers, turn on **ACH Direct Debit** under Stripe's
   payment methods settings.

## Send an invoice

1. Open **Invoices** and choose **New invoice**.
2. Pick a contact (or type a name and billing email), add lines in dollars,
   choose a due date, and choose which payment methods the customer may use.
   **Save draft** keeps it editable and private.
3. **Issue invoice** assigns the next number (INV-0001, INV-0002…), opens the
   Stripe payment and creates the customer link. Nothing is emailed.
4. **Copy link** and send it from your own email. The customer sees the invoice
   on your branded page and pays there.
5. The invoice moves to **Payment processing** while a bank transfer clears
   (about four business days) and to **Paid** when Stripe confirms it.

**Void** cancels an unpaid invoice and its Stripe payment. **Record outside
payment** marks an invoice paid by check or wire without touching Stripe.
Issued invoices cannot be edited; void and reissue instead.
