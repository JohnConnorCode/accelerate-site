import { createCipheriv, createHash } from "node:crypto";
export const qaTenant = "acce1e8e-0000-4000-8000-000000000001",
  qaAction = "aaaaaaaa-aaaa-4aaa-8aaa-111111111111";
export const qaBrand = {
  version: 1,
  name: "Northwind Studio",
  logoMark: "NS",
  logoUrl: "",
  accentColor: "#8c3ec6",
  inkColor: "#172033",
  backgroundColor: "#f4f5f7",
  tagline: "Thoughtful systems. Better business.",
  legalName: "Northwind Studio LLC",
  businessAddress: "100 Example Street\nChicago, IL",
  supportEmail: "billing@example.com",
  siteUrl: "https://example.com",
  font: "sans",
};
export const qaDesign = {
  layout: "editorial",
  heading: "Built for your next chapter",
  introduction: "Thank you for partnering with our team.",
  closing: "We appreciate your business.",
};
export const qaInvoice = {
  id: "in_fixture",
  number: "INV-0042",
  customer: "cus_fixture",
  customer_name: "Sample Customer",
  customer_email: "billing@example.com",
  currency: "usd",
  status: "open",
  auto_advance: false,
  collection_method: "send_invoice",
  livemode: false,
  total: 50000,
  amount_due: 50000,
  amount_paid: 0,
  amount_remaining: 50000,
  due_date: 1789689600,
  hosted_invoice_url: "https://invoice.stripe.com/i/fixture",
  metadata: { accelerate_tenant_id: qaTenant, accelerate_action_id: qaAction },
  lines: {
    data: [{ id: "il_fixture", description: "Business implementation · 2 units", amount: 50000 }],
    has_more: false,
  },
};
const digest = createHash("sha256")
  .update(
    JSON.stringify({
      invoiceId: "in_fixture",
      customerEmail: "billing@example.com",
      currency: "usd",
      lines: [{ description: "Business implementation · 2 units", amount: 50000 }],
      total: 50000,
    }),
  )
  .digest("hex");
export const qaPage = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-111111111111",
  tenant_id: qaTenant,
  creation_action_id: qaAction,
  brand: qaBrand,
  design: qaDesign,
  billing_digest: digest,
  expires_at: "2099-01-01T00:00:00Z",
  revoked_at: null,
  token_hash: createHash("sha256").update("a".repeat(43)).digest("hex"),
};
const iv = Buffer.alloc(12, 1),
  key = createHash("sha256").update("controlled-browser-encryption").digest();
const cipher = createCipheriv("aes-256-gcm", key, iv);
cipher.setAAD(Buffer.from(`tenant:${qaTenant}:provider:stripe:field:api_key`));
const encrypted = Buffer.concat([
  cipher.update("rk_test_controlledfixture12345", "utf8"),
  cipher.final(),
]);
export const qaStripeConnection = {
  tenant_id: qaTenant,
  provider: "stripe",
  status: "connected",
  credential_version: 1,
  account_email: "acct_fixture",
  encrypted_credentials: {
    api_key: [
      "v2",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join("."),
  },
};
