import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3012";
const outDir = "/tmp/accel-shots";
mkdirSync(outDir, { recursive: true });
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) if (!process.env[key]) throw new Error(`${key} is required for contact importer QA`);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: link, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: process.env.ADMIN_EMAIL, options: { redirectTo: `${base}/auth/callback?next=/admin/contact-imports` } });
if (linkError || !link?.properties?.hashed_token) throw linkError || new Error("Could not generate QA session");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (verifyError || !verified.session) throw verifyError || new Error("Could not exchange QA session");
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieKey = `sb-${projectRef}-auth-token`;
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieChunks = cookieValue.length <= 3180 ? [{ name: cookieKey, value: cookieValue }] : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({ name: `${cookieKey}.${index}`, value: cookieValue.slice(index * 3180, (index + 1) * 3180) }));

const baseRows = [
  { id: "11111111-1111-4111-8111-111111111111", batch_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", row_index: 0, status: "proposed", action: "create", included: true, confidence: "high", reviewed_data: { fullName: "Jane Martinez", email: "jane@martinezroofing.com", phone: "512-555-0142", companyName: "Martinez Roofing", role: "Owner", website: "https://martinezroofing.com", industry: "Roofing", source: "Austin builders meetup", notes: "Interested in faster estimate follow-up" }, warnings: [], errors: [], match_reason: "No deterministic identity match", matched_contact_id: null, imported_contact_id: null, error: null },
  { id: "22222222-2222-4222-8222-222222222222", batch_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", row_index: 1, status: "proposed", action: "update", included: true, confidence: "medium", reviewed_data: { fullName: "Sam Lee", email: "sam@northstarhvac.com", phone: null, companyName: "Northstar HVAC", role: "Operations Director", website: "https://northstarhvac.com", industry: "HVAC", source: "Referral list", notes: null }, warnings: [], errors: [], match_reason: "Exact email match: sam@northstarhvac.com", matched_contact_id: "33333333-3333-4333-8333-333333333333", imported_contact_id: null, error: null },
  { id: "44444444-4444-4444-8444-444444444444", batch_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", row_index: 2, status: "needs_review", action: "create", included: false, confidence: "low", reviewed_data: { fullName: "Priya Shah", email: "priya@example.com", phone: null, companyName: null, role: null, website: null, industry: null, source: null, notes: "Company was not present in source" }, warnings: ["Company identity is uncertain"], errors: [], match_reason: "No deterministic identity match", matched_contact_id: null, imported_contact_id: null, error: null },
];

function readyBatch(rows = baseRows) { return { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "ready", source_type: "text", original_filename: null, source_row_count: 3, proposed_row_count: 3, selected_row_count: rows.filter((r) => r.included).length, review_digest: "digest-reviewed-v1", approval_digest: null, ai_model: "openai/gpt-4.1-mini", summary: { create: 2, update: 1, skip: 0 }, error: null, approved_by: null, approved_at: null, completed_at: null, created_at: "2026-08-16T12:00:00.000Z", updated_at: "2026-08-16T12:00:00.000Z", rows }; }

const browser = await chromium.launch({ headless: true });
const failures = [];
async function contextFor(viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, colorScheme: "light", reducedMotion });
  const origin = new URL(base);
  await context.addCookies(cookieChunks.map((cookie) => ({ ...cookie, domain: origin.hostname, path: "/", httpOnly: false, secure: origin.protocol === "https:", sameSite: "Lax" })));
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") failures.push(message.text()); });
  page.on("pageerror", (error) => failures.push(error.message));
  let rows = structuredClone(baseRows);
  let batch = readyBatch(rows);
  await page.route("**/api/admin/revenue-os/contact-imports**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(new URL(request.url()).searchParams.has("id") ? { schemaReady: true, batch } : { schemaReady: true, batches: [] }) });
    const body = request.postDataJSON();
    if (body.action === "analyze") batch = readyBatch(rows);
    if (body.action === "save_review") {
      rows = body.rows.map((review, index) => ({ ...rows[index], included: review.included, action: review.action, reviewed_data: review.data }));
      batch = { ...readyBatch(rows), review_digest: "digest-reviewed-v2" };
    }
    if (body.action === "approve") batch = { ...batch, status: "approved", approval_digest: batch.review_digest, approved_by: process.env.ADMIN_EMAIL, approved_at: new Date().toISOString() };
    if (body.action === "execute") {
      rows = rows.map((row) => row.included ? { ...row, status: "imported", imported_contact_id: row.matched_contact_id || `imported-${row.row_index}` } : { ...row, status: "skipped" });
      batch = { ...batch, status: "completed", summary: { imported: rows.filter((row) => row.status === "imported").length, failed: 0 }, completed_at: new Date().toISOString(), rows };
    }
    return route.fulfill({ status: body.action === "analyze" ? 201 : 200, contentType: "application/json", body: JSON.stringify({ schemaReady: true, batch }) });
  });
  await page.route("**/api/admin/notifications**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [], unreadCount: 0 }) }));
  return { context, page };
}

async function assertFits(page, viewport) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 1) throw new Error(`Contact Import overflows ${viewport.width}px viewport by ${overflow}px`);
  const dialog = page.getByRole("dialog");
  if (await dialog.count()) {
    const box = await dialog.boundingBox();
    if (!box || box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height) throw new Error("Approval dialog is outside viewport");
  }
}

const desktop = await contextFor({ width: 1440, height: 1000 });
await desktop.page.goto(`${base}/admin/contact-imports`, { waitUntil: "networkidle", timeout: 60_000 });
await desktop.page.getByRole("heading", { name: "Contact Import", exact: true }).waitFor();
await desktop.page.getByTestId("contact-import-source").fill("Jane Martinez, jane@martinezroofing.com\nSam Lee, sam@northstarhvac.com");
await desktop.page.getByTestId("contact-import-analyze").click();
await desktop.page.getByRole("heading", { name: "Review rows" }).waitFor();
await desktop.page.getByLabel("Email", { exact: true }).fill("jane.updated@martinezroofing.com");
await desktop.page.getByRole("button", { name: "Save", exact: true }).click();
await desktop.page.getByText("Review saved").waitFor();
await desktop.page.screenshot({ path: `${outDir}/contact-import-review-desktop.png`, fullPage: true });
await desktop.page.getByTestId("contact-import-approve").click();
await desktop.page.getByRole("heading", { name: "Approve this exact import snapshot?" }).waitFor();
await assertFits(desktop.page, { width: 1440, height: 1000 });
await desktop.page.screenshot({ path: `${outDir}/contact-import-approval-desktop.png`, fullPage: true });
await desktop.page.keyboard.press("Escape");
await desktop.page.getByRole("heading", { name: "Approve this exact import snapshot?" }).waitFor({ state: "detached" });
await desktop.page.getByTestId("contact-import-approve").click();
await desktop.page.getByTestId("contact-import-confirm").click();
await desktop.page.getByRole("heading", { name: "Contacts imported with receipts" }).waitFor();
await desktop.page.screenshot({ path: `${outDir}/contact-import-result-desktop.png`, fullPage: true });

const mobile = await contextFor({ width: 390, height: 844 });
await mobile.page.goto(`${base}/admin/contact-imports`, { waitUntil: "networkidle", timeout: 60_000 });
await mobile.page.getByTestId("contact-import-source").fill("Jane Martinez, jane@martinezroofing.com");
await mobile.page.getByTestId("contact-import-analyze").click();
await mobile.page.getByRole("heading", { name: "Review rows" }).waitFor();
await assertFits(mobile.page, { width: 390, height: 844 });
await mobile.page.screenshot({ path: `${outDir}/contact-import-review-mobile.png`, fullPage: true });
await mobile.page.getByTestId("contact-import-approve").click();
await mobile.page.getByRole("heading", { name: "Approve this exact import snapshot?" }).waitFor();
await assertFits(mobile.page, { width: 390, height: 844 });
await mobile.page.screenshot({ path: `${outDir}/contact-import-approval-mobile.png`, fullPage: true });

const reduced = await contextFor({ width: 1280, height: 800 }, "reduce");
await reduced.page.goto(`${base}/admin/contact-imports`, { waitUntil: "networkidle", timeout: 60_000 });
await reduced.page.getByRole("heading", { name: "Contact Import", exact: true }).waitFor();

await desktop.context.close(); await mobile.context.close(); await reduced.context.close(); await browser.close();
if (failures.length) throw new Error(`Contact Import console errors:\n${failures.join("\n")}`);
console.log(`${outDir}/contact-import-review-desktop.png`);
console.log(`${outDir}/contact-import-approval-desktop.png`);
console.log(`${outDir}/contact-import-result-desktop.png`);
console.log(`${outDir}/contact-import-review-mobile.png`);
console.log(`${outDir}/contact-import-approval-mobile.png`);
console.log("Contact Import paste, review edit, approval keyboard dismissal, execution receipt, mobile fit, and reduced-motion QA passed.");
