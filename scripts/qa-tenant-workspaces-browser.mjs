import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) if (!process.env[key]) throw new Error(`${key} is required`);
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const key = `sb-${projectRef}-auth-token`;
async function createAuthCookies() {
  const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: "magiclink", email: process.env.ADMIN_EMAIL });
  if (linkError || !link.properties?.hashed_token) throw linkError || new Error("Could not create QA session");
  const { data: verified, error: verifyError } = await service.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (verifyError || !verified.session) throw verifyError || new Error("Could not verify QA session");
  const value = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
  return value.length <= 3180 ? [{ name: key, value }] : Array.from({ length: Math.ceil(value.length / 3180) }, (_, index) => ({ name: `${key}.${index}`, value: value.slice(index * 3180, (index + 1) * 3180) }));
}
const origin = new URL(base);
const output = "/private/tmp/accelerate-tenant-workspaces";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
console.log("tenant-workspace-qa: browser ready");
const results = [];

const fixtures = [{ name: "desktop", viewport: { width: 1440, height: 1000 } }, { name: "mobile", viewport: { width: 390, height: 844 } }]
  .filter((fixture) => !process.env.QA_VIEWPORT || fixture.name === process.env.QA_VIEWPORT);
for (const fixture of fixtures) {
  console.log(`tenant-workspace-qa: creating ${fixture.name} founder session`);
  const authCookies = await createAuthCookies();
  console.log(`tenant-workspace-qa: ${fixture.name}`);
  const context = await browser.newContext({ viewport: fixture.viewport, reducedMotion: "reduce" });
  await context.addCookies(authCookies.map((cookie) => ({ ...cookie, domain: origin.hostname, path: "/", secure: origin.protocol === "https:", sameSite: "Lax" })));
  let page = await context.newPage();
  const errors = [];
  const watch = () => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error" && !/favicon/i.test(message.text())) errors.push(message.text()); });
    page.on("response", (response) => { if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
  };
  watch();
  let inviteRequest = null;
  await page.route("**/api/admin/tenants", (route) => {
    if (route.request().method() === "POST") {
      inviteRequest = route.request().postDataJSON();
      if (inviteRequest?.action !== "invite") return route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ error: "Visual QA only simulates invitation recovery" }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        membership: { id: "member-client-2", tenant_id: "tenant-harbor", user_id: "invited-admin", invited_email: "owner@harbor.example", status: "invited" },
        deliveryStatus: "sent",
        providerReceiptId: "qa-provider-receipt",
        operatorMessage: "Invitation sent to owner@harbor.example",
        warning: null,
      }) });
    }
    if (route.request().method() !== "GET") return route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ error: "Visual QA never mutates tenant state" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      isPlatformAdmin: true,
      platformOwnerUserId: "platform-owner",
      tenants: [
        { id: "tenant-accelerate", slug: "accelerate", name: "Accelerate", status: "active", created_at: "2026-01-12T12:00:00.000Z" },
        { id: "tenant-northline", slug: "northline-roofing", name: "Northline Roofing", status: "active", created_at: "2026-08-20T12:00:00.000Z" },
        { id: "tenant-harbor", slug: "harbor-dental", name: "Harbor Dental", status: "provisioning", created_at: "2026-08-29T12:00:00.000Z" },
        { id: "tenant-lake", slug: "lake-street-law", name: "Lake Street Law", status: "suspended", created_at: "2026-08-25T12:00:00.000Z" },
      ],
      memberships: [
        { id: "member-founder-1", tenant_id: "tenant-accelerate", user_id: "platform-owner", invited_email: "founder@example.com", status: "active" },
        { id: "member-founder-2", tenant_id: "tenant-northline", user_id: "platform-owner", invited_email: "founder@example.com", status: "active" },
        { id: "member-client-1", tenant_id: "tenant-northline", user_id: "client-admin", invited_email: "operator@northline.example", status: "active" },
        { id: "member-client-2", tenant_id: "tenant-harbor", user_id: "invited-admin", invited_email: "owner@harbor.example", status: "invited" },
      ],
    }) });
  });
  const response = await page.goto(`${base}/t/accelerate/admin/tenants`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (!response || response.status() >= 400) throw new Error(`${fixture.name} tenant directory returned ${response?.status()}`);
  console.log(`tenant-workspace-qa: ${fixture.name} loaded ${page.url()} (${response.status()})`);
  await page.getByRole("heading", { name: "Tenant operations" }).waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("heading", { name: "Accelerate" }).waitFor({ state: "visible" });
  if (fixture.name === "desktop") {
    await page.locator("#admin-desktop-workspace").waitFor({ state: "visible" });
  } else {
    await page.getByRole("button", { name: "Open More" }).click();
    await page.locator("#admin-mobile-workspace").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Close navigation" }).click();
  }
  await page.getByLabel("Search tenants").fill("Northline");
  await page.getByRole("heading", { name: "Northline Roofing" }).waitFor({ state: "visible" });
  if (await page.getByRole("heading", { name: "Accelerate" }).isVisible()) throw new Error(`${fixture.name} tenant search did not filter the directory`);
  await page.getByLabel("Search tenants").fill("");
  await page.getByLabel("Workspace name").fill("North Star Dental");
  if (await page.getByLabel("URL slug").inputValue() !== "north-star-dental") throw new Error(`${fixture.name} generated tenant slug is not stable`);
  await page.getByLabel("Workspace name").fill("");
  const resend = page.getByRole("button", { name: "Resend invitation to owner@harbor.example" });
  await resend.waitFor({ state: "visible" });
  const resendMetrics = await resend.evaluate((element) => {
    const styles = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, transitionProperty: styles.transitionProperty };
  });
  if (resendMetrics.width < 40 || resendMetrics.height < 40) throw new Error(`${fixture.name} resend target is smaller than 40px`);
  if (!resendMetrics.transitionProperty.includes("transform") || resendMetrics.transitionProperty.includes("all")) throw new Error(`${fixture.name} resend transition is not intentional`);
  await resend.locator("xpath=../..").screenshot({ path: `${output}/invitation-${fixture.name}.png` });
  await resend.focus();
  await page.keyboard.press("Enter");
  await page.getByText("Invitation sent to owner@harbor.example", { exact: true }).waitFor({ state: "visible" });
  if (inviteRequest?.tenantId !== "tenant-harbor" || inviteRequest?.adminEmail !== "owner@harbor.example" || !/^[0-9a-f-]{36}$/i.test(inviteRequest?.requestId || "")) {
    throw new Error(`${fixture.name} resend did not preserve tenant, recipient, and request identity`);
  }
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await page.locator("h2", { hasText: "Suspend Northline Roofing?" }).waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.locator("h2", { hasText: "Suspend Northline Roofing?" }).waitFor({ state: "hidden" });
  await page.locator(".admin-main").evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  if (dimensions.width > dimensions.viewport + 2) throw new Error(`${fixture.name} workspace overflow ${dimensions.width} > ${dimensions.viewport}`);
  await page.screenshot({ path: `${output}/${fixture.name}.png`, fullPage: true });
  await page.close();
  page = await context.newPage();
  watch();
  await page.route("**/api/admin/tenant/providers", (route) => {
    if (route.request().method() !== "GET") return route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ error: "Visual QA never mutates provider state" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ providers: [
      { id: "provider-resend", provider: "resend", status: "connected", credential_version: 3, connected_at: "2026-08-29T12:00:00.000Z" },
    ] }) });
  });
  await page.goto(`${base}/t/accelerate/admin/integrations`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Integrations", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("heading", { name: "Provider credentials" }).waitFor({ state: "visible", timeout: 30_000 });
  const apiKeyField = page.getByRole("textbox", { name: /API key/ });
  await apiKeyField.waitFor({ state: "visible" });
  await page.getByText("Credential v3").waitFor({ state: "visible" });
  await page.getByLabel("Show api key").click();
  if (await apiKeyField.getAttribute("type") !== "text") throw new Error(`${fixture.name} credential reveal control did not update the field`);
  await page.getByLabel("Hide api key").click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page.locator("h2", { hasText: "Disconnect Resend?" }).waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.locator("h2", { hasText: "Disconnect Resend?" }).waitFor({ state: "hidden" });
  await page.locator(".admin-main").evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
  const integrationDimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  if (integrationDimensions.width > integrationDimensions.viewport + 2) throw new Error(`${fixture.name} integrations overflow ${integrationDimensions.width} > ${integrationDimensions.viewport}`);
  await page.screenshot({ path: `${output}/integrations-${fixture.name}.png`, fullPage: true });
  if (errors.length) {
    console.log(`tenant-workspace-qa: ${fixture.name} captured errors`, errors);
    const diagnostics = await page.evaluate(async () => Promise.all(["/api/admin/notifications", "/api/admin/revenue-os/priority", "/api/admin/revenue-os/ai/conversations?limit=30"].map(async (url) => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        return { url, status: response.status, body: await response.text() };
      } catch (error) {
        return { url, status: 0, body: error instanceof Error ? error.message : "Request failed" };
      }
    })));
    errors.push(`diagnostics=${JSON.stringify(diagnostics)}`);
  }
  if (errors.length) throw new Error(`${fixture.name} browser errors: ${errors.join(" | ")}`);
  results.push({ viewport: fixture.name, status: "passed", width: dimensions.width });
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ result: "passed", results, screenshots: output }, null, 2));
