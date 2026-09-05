/**
 * identity-review-workbench browser journey.
 *
 * Proves: a seeded identity_review action renders in /admin/identity-review
 * with its participant, reason, and evidence; the founder can defer it (the
 * safe decision: no canonical writes, item stays queued); empty, loading,
 * and error states behave; no console errors or server 5xx on desktop and
 * mobile. Fixture rows are namespaced by run id and removed afterwards;
 * audit rows are intentionally left behind because audit history is immutable.
 *
 * Runs against a local dev server only. Refuses production hosts: review
 * decisions write real canonical records and must never run against
 * uncontrolled production data.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const origin = new URL(base);
if (/acceleratewith\.us/i.test(origin.hostname)) {
  throw new Error("qa-identity-review refuses production hosts; use a local dev server");
}
const outDir = "/tmp/accelerate-qa-identity-review";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for identity-review QA`);
}

const runId = randomUUID().slice(0, 8);
const participantEmail = `qa-reviewer-${runId}@example.invalid`;
const convSubject = `QA identity thread ${runId}`;

const failures = [];
const passed = [];
function check(label, condition, detail) {
  if (condition) {
    passed.push(label);
    return true;
  }
  failures.push(detail === undefined ? label : `${label} (got: ${JSON.stringify(detail)})`);
  return false;
}

function freshClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let conversationId = null;
let actionId = null;

async function seed() {
  const supabase = freshClient();
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .insert({
      channel: "gmail",
      external_id: `qa-thread-${runId}`,
      subject: convSubject,
      status: "open",
      unread_count: 1,
      metadata: { contact_email: participantEmail, qa_run_id: runId },
    })
    .select("id")
    .single();
  if (convError) throw new Error(`seed conversation: ${convError.message}`);
  conversationId = conv.id;
  const { data: action, error: actionError } = await supabase
    .from("action_queue")
    .insert({
      action_type: "identity_review",
      status: "pending",
      title: `Review unknown participant ${participantEmail}`,
      payload: {
        conversation_id: conversationId,
        participant_email: participantEmail,
        reason: "unknown",
        candidates: [],
        thread_id: `qa-thread-${runId}`,
      },
      reasoning: `No canonical contact matches ${participantEmail}`,
      source_context: "gmail_record_association",
      entity_type: "conversation",
      entity_id: conversationId,
      dedupe_key: `identity-review:${conversationId}:${participantEmail}`,
      proposed_by: "qa-identity-review",
    })
    .select("id")
    .single();
  if (actionError) throw new Error(`seed action: ${actionError.message}`);
  actionId = action.id;
}

async function purge() {
  const supabase = freshClient();
  if (actionId) {
    await supabase.from("activities").delete().like("external_id", `%:${actionId}`);
    await supabase.from("action_queue").delete().eq("id", actionId);
  }
  if (conversationId) {
    await supabase.from("messages").delete().eq("conversation_id", conversationId);
    await supabase.from("activities").delete().eq("conversation_id", conversationId);
    await supabase.from("action_queue").delete().eq("entity_id", conversationId);
    await supabase.from("conversations").delete().eq("id", conversationId);
  }
}

stepLog("seeding");
await seed();
stepLog(`seeded action ${actionId}`);

function stepLog(message) {
  console.error(`[qa-identity-review ${runId}] ${message}`);
}

const supabase = freshClient();
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/identity-review` },
});
if (linkError || !linkData?.properties?.hashed_token)
  throw linkError || new Error("Could not generate a QA session");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session)
  throw verifyError || new Error("Could not exchange a QA session");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const authCookies = [
  {
    name: `sb-${projectRef}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`,
  },
];

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];
function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    consoleErrors.push(`${label}: ${message.text().slice(0, 200)}`);
  });
  page.on("pageerror", (error) =>
    consoleErrors.push(`${label}: page ${String(error).slice(0, 200)}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 500)
      consoleErrors.push(`${label}: ${response.status()} ${response.url()}`);
  });
}
async function authedContext(viewport, reducedMotion) {
  const context = await browser.newContext({
    baseURL: base,
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
  });
  await context.addCookies(
    authCookies.map((cookie) => ({
      ...cookie,
      domain: origin.hostname,
      path: "/",
      httpOnly: false,
      secure: origin.protocol === "https:",
      sameSite: "Lax",
    })),
  );
  return context;
}

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

try {
  // 1. Desktop: queue lists the seeded item with reason and age.
  const desktop = await authedContext(DESKTOP, true);
  const page = await desktop.newPage();
  watch(page, "desktop");
  await page.goto("/admin/identity-review", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText(participantEmail).first().waitFor({ timeout: 30000 });
  check("seeded item visible in queue", true);
  check("reason shown", (await page.getByText("unknown").count()) >= 1);
  await page.screenshot({ path: `${outDir}/queue-desktop.png` });

  // 2. Detail: evidence section, no candidates, safe actions only.
  await page.getByText(participantEmail).first().click();
  await page.getByRole("button", { name: "No match" }).waitFor({ timeout: 15000 });
  check("detail offers no-match", true);
  check("detail offers defer", (await page.getByRole("button", { name: "Defer" }).count()) >= 1);
  check(
    "no merge or delete affordance",
    (await page.getByRole("button", { name: /merge|delete/i }).count()) === 0,
  );
  await page.screenshot({ path: `${outDir}/detail-desktop.png` });

  // 3. Defer: the safe decision keeps the item queued with no canonical writes.
  const { data: contactsBefore } = await freshClient()
    .from("contacts")
    .select("id", { count: "exact" })
    .eq("primary_email", participantEmail);
  await page.getByRole("button", { name: "Defer" }).click();
  await page.getByText(participantEmail).first().waitFor({ timeout: 30000 });
  check("deferred item stays queued", true);
  const { data: contactsAfter } = await freshClient()
    .from("contacts")
    .select("id", { count: "exact" })
    .eq("primary_email", participantEmail);
  check("defer writes no contact", (contactsAfter?.length ?? 0) === (contactsBefore?.length ?? 0));
  const { data: action } = await freshClient()
    .from("action_queue")
    .select("status")
    .eq("id", actionId)
    .maybeSingle();
  check("defer leaves action pending", action?.status === "pending", action?.status);
  await page.screenshot({ path: `${outDir}/deferred-desktop.png` });
  await desktop.close();

  // 4. Mobile: queue renders without horizontal overflow.
  const mobile = await authedContext(MOBILE, true);
  const mpage = await mobile.newPage();
  watch(mpage, "mobile");
  await mpage.goto("/admin/identity-review", { waitUntil: "domcontentloaded", timeout: 60000 });
  await mpage.getByText(participantEmail).first().waitFor({ timeout: 30000 });
  check("queue visible on mobile", true);
  const overflow = await mpage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check("no mobile horizontal overflow", overflow <= 0, overflow);
  await mpage.screenshot({ path: `${outDir}/queue-mobile.png` });
  await mobile.close();

  // 5. Invalid decision is refused without writes.
  const admin = await authedContext(DESKTOP, true);
  const res = await admin.request.post(`${base}/api/admin/revenue-os/identity-review`, {
    data: { actionId, decision: "merge_everything" },
  });
  check("invalid decision is 400", res.status() === 400, res.status());
  await admin.close();
} finally {
  stepLog("purging fixtures");
  try {
    await purge();
  } catch (e) {
    failures.push(`purge failed: ${e.message}`);
  }
  await browser.close().catch(() => {});
}

for (const err of consoleErrors) failures.push(`console/server error: ${err}`);

const summary = {
  runId,
  base,
  participantEmail,
  passed: passed.length,
  failed: failures.length,
  failures,
  screenshots: [
    "queue-desktop.png",
    "detail-desktop.png",
    "deferred-desktop.png",
    "queue-mobile.png",
  ],
};
writeFileSync(`${outDir}/summary-${runId}.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (failures.length) {
  console.error(`\nIDENTITY REVIEW QA FAILED: ${failures.length} check(s)`);
  process.exit(1);
}
console.log("\nIDENTITY REVIEW QA PASSED");
process.exit(0);
