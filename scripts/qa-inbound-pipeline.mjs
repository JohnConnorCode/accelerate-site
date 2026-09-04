/**
 * playwright-inbound-pipeline journey (Loop One circuit proof in a browser).
 *
 * Proves: public /contact submit -> one canonical contact/company/opportunity
 * via ingestInboundLead with UTM attribution -> visible in /admin/today and
 * /admin/pipeline -> validated stage move + next action through the shared
 * pipeline service -> duplicate submit creates no duplicate canonical records
 * or stage events. Fails on console errors and server 5xx. Desktop + mobile
 * screenshots are retained under /tmp/accelerate-qa-inbound-pipeline.
 *
 * Fixture discipline (mirrors scripts/verify-inbound-canonical.ts): every row
 * this journey creates is namespaced by a single run id
 * (qa-inbound-<runId>@example.invalid / "QA Journey Co <runId>"). Cleanup
 * deletes only rows carrying that namespace, in foreign-key-safe order, and
 * runs even when assertions fail. Audit rows are intentionally left behind
 * because audit history is immutable.
 *
 * Known external effects: none on inbound mail. QA submits carry reserved
 * markers (qa-inbound-*@example.invalid, utm_source=qa-journey) and the
 * contact route suppresses all outbound Resend sends for them while keeping
 * the canonical + operator writes the journey asserts on. The visitor
 * confirmation to the non-routable address never leaves either.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3022";
const outDir = "/tmp/accelerate-qa-inbound-pipeline";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for inbound pipeline QA`);
}

const runId = randomUUID().slice(0, 8);
const email = `qa-inbound-${runId}@example.invalid`;
const companyName = `QA Journey Co ${runId}`;
const companyWebsite = `qa-${runId}.example.invalid`;
const EMAIL_PREFIX = "qa-inbound-";
const COMPANY_PREFIX = "QA Journey Co ";

const failures = [];
const passed = [];
/**
 * Teardown health, tracked separately from product health. Context teardown
 * hangs deterministically in some sandboxed headless-shell environments —
 * including a request-only context that never opened a page, where no
 * application leak is possible — while the final browser close always
 * succeeds. Conflating that with product failure trains everyone to ignore
 * the journey; these stay visible in the summary but do not fail it.
 * Console errors and server 5xx still fail via `failures` below.
 */
const teardownNotes = [];
function check(label, condition, detail) {
  if (condition) {
    passed.push(label);
    return true;
  }
  failures.push(detail === undefined ? label : `${label} (got: ${JSON.stringify(detail)})`);
  return false;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * Fresh service client per call. The shared dev database sits behind a
 * transaction-pooling proxy; a long-lived client can ride a keep-alive socket
 * pinned to a backend with a stale transaction snapshot and then read
 * repeatably-empty results for some tables while other tables look live.
 * Fresh clients force fresh checkouts and fail instead on real absence.
 */
function freshClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Delete every row this journey can create, in foreign-key-safe order. */
async function purge() {
  const supabase = freshClient();
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id")
    .like("email", `${EMAIL_PREFIX}%`);
  for (const opportunity of opportunities ?? []) {
    for (const table of ["tasks", "activities", "stage_events"]) {
      const { error } = await supabase.from(table).delete().eq("opportunity_id", opportunity.id);
      if (error) throw new Error(`cleanup ${table}: ${error.message}`);
    }
  }
  for (const [table, column, pattern] of [
    ["opportunities", "email", `${EMAIL_PREFIX}%`],
    ["contacts", "primary_email", `${EMAIL_PREFIX}%`],
    ["contact_submissions", "email", `${EMAIL_PREFIX}%`],
    ["companies", "name", `${COMPANY_PREFIX}%`],
  ]) {
    const { error } = await supabase.from(table).delete().like(column, pattern);
    if (error) throw new Error(`cleanup ${table}: ${error.message}`);
  }
  await supabase.from("admin_notifications").delete().like("title", "New contact from QA Founder %");
  // Entity-specific coworker work created for the fixture lead (generic
  // tenant-level deduped items are intentionally left alone).
  await supabase.from("work_items").delete().like("reason", `%${COMPANY_PREFIX}%`);
}

function visibleCompanyLink(page) {
  // Pipeline renders responsive duplicates (desktop table + mobile cards) and
  // hides one via CSS; only the visible copy proves operator visibility.
  return page.locator(`a:visible:has-text("${companyName}")`);
}

/**
 * Poll canonical counts until `wanted` holds or the timeout expires. Canonical
 * writes commit before the HTTP response, but a shared dev database under
 * concurrent agent sessions has shown multi-second read-after-write lag; poll
 * so a slow commit reads as slow, never as silently passed or failed.
 */
async function awaitCounts(label, wanted, timeoutMs = 90000) {
  const started = Date.now();
  let snapshot = await dbCall(`poll ${label}`, canonicalCounts());
  while (Date.now() - started < timeoutMs) {
    const ok =
      (wanted.contacts === undefined || snapshot.contacts.length === wanted.contacts) &&
      (wanted.companies === undefined || snapshot.companies.length === wanted.companies) &&
      (wanted.opportunities === undefined || snapshot.opportunities.length === wanted.opportunities) &&
      (wanted.submissions === undefined || snapshot.submissions.length === wanted.submissions) &&
      (wanted.stageEvents === undefined || snapshot.stageEvents.length === wanted.stageEvents);
    if (ok) return snapshot;
    await new Promise((r) => setTimeout(r, 3000));
    snapshot = await dbCall(`poll ${label}`, canonicalCounts());
  }
  failures.push(
    `${label} timed out: contacts=${snapshot.contacts.length} companies=${snapshot.companies.length} opportunities=${snapshot.opportunities.length} submissions=${snapshot.submissions.length} stageEvents=${snapshot.stageEvents.length}`,
  );
  return snapshot;
}

async function canonicalCounts() {
  const supabase = freshClient();
  const [contactsRes, companiesRes, opportunitiesRes, submissionsRes] = await Promise.all([
    supabase.from("contacts").select("id,primary_email").eq("primary_email", email),
    supabase.from("companies").select("id,name").eq("name", companyName),
    supabase.from("opportunities").select("id,stage,source,source_detail,email,contact_id,company_id,created_at").eq("email", email),
    supabase.from("contact_submissions").select("id,email").eq("email", email),
  ]);
  for (const [label, res] of [["contacts", contactsRes], ["companies", companiesRes], ["opportunities", opportunitiesRes], ["submissions", submissionsRes]]) {
    if (res.error) failures.push(`diagnostic: ${label} query error: ${res.error.message}`);
  }
  const opportunities = opportunitiesRes.data ?? [];
  let stageEvents = [];
  if (opportunities.length === 1) {
    const { data, error } = await supabase
      .from("stage_events")
      .select("id,from_stage,to_stage")
      .eq("opportunity_id", opportunities[0].id);
    if (error) failures.push(`diagnostic: stage_events query error: ${error.message}`);
    stageEvents = data ?? [];
  }
  return {
    contacts: contactsRes.data ?? [],
    companies: companiesRes.data ?? [],
    opportunities,
    submissions: submissionsRes.data ?? [],
    stageEvents,
  };
}

// Self-healing start: remove stale fixtures from earlier interrupted runs. Every
// row matching the reserved prefixes belongs to this journey by construction.
stepLog("startup purge");
await dbCall("startup purge", purge());
stepLog("startup purge done");

stepLog("founder sign-in link");
const { data: linkData, error: linkError } = await dbCall("generateLink", supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/pipeline` },
}));
stepLog("sign-in link ok");
if (linkError || !linkData?.properties?.hashed_token)
  throw linkError || new Error("Could not generate an inbound-pipeline QA sign-in token");
const { data: verified, error: verifyError } = await dbCall("verifyOtp", supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
}));
stepLog("founder session ok");
if (verifyError || !verified.session)
  throw verifyError || new Error("Could not exchange the inbound-pipeline QA sign-in token");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const authCookies = [
  { name: `sb-${projectRef}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}` },
];

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];
function watch(page) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const url = message.location()?.url || "";
    const text = message.text();
    // Third-party scheduling embed (Calendly + its reCAPTCHA) uses the Storage
    // Access API, which headless Chromium denies without a user gesture. The
    // product never depends on it. Not a product error.
    if (
      text.includes("requestStorageAccess") &&
      (url.includes("calendly") || url.includes("recaptcha.net"))
    )
      return;
    consoleErrors.push(`${text} @${url.slice(0, 160)}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) consoleErrors.push(`${response.status()} ${response.url()}`);
  });
}
async function newContext(viewport, authed) {
  const context = await browser.newContext({ baseURL: base, viewport, deviceScaleFactor: 1 });
  const origin = new URL(base);
  if (authed) {
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
  }
  // External analytics only; never part of the journey under test.
  await context.route("**/js/script.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  return context;
}

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const formData = {
  name: `QA Founder ${runId}`,
  companyName,
  companyWebsite,
  primaryProblem: "automation",
  email,
  businessType: "professional_services",
  message: `QA journey run ${runId}: inbound to pipeline proof.`,
};

async function openContactForm(page) {
  // When the scheduler embed is live the manual form sits inside a closed
  // <details> disclosure; a real visitor must open it first. Scope to the
  // visible copy: the page renders responsive duplicates and clicking the
  // hidden one times out instead of opening anything.
  const disclosure = page.locator("summary:visible", { hasText: "Prefer to send context first?" });
  if ((await disclosure.count()) > 0) await disclosure.first().click();
}

function stepLog(message) {
  console.error(`[qa-inbound-pipeline ${runId}] ${message}`);
}

/**
 * Bounds any database call. The shared dev pooler has stalled individual
 * calls before; a stall must fail loud with its phase named, never hang the
 * journey past the runner timeout with zero evidence.
 */
async function dbCall(label, promise, ms = 60000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Bounded close: browser/context close can hang on lingering third-party
 * iframe sockets (scheduling embed). Never let teardown hang the journey;
 * record it and continue so evidence and cleanup still land.
 */
async function settledClose(closeable, label) {
  await Promise.race([
    closeable.close().catch((e) => teardownNotes.push(`${label} close error: ${e.message}`)),
    new Promise((r) =>
      setTimeout(() => {
        teardownNotes.push(`${label} close timed out after 15s; continuing`);
        r(null);
      }, 15000),
    ),
  ]);
}

async function submitContactForm(page, form) {
  // Dev-mode hydration can lag behind networkidle: a click before React
  // attaches onSubmit falls through to a native GET navigation (form fields
  // appear as query params, no POST happens). Retry on that exact signal.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await Promise.all([
      page
        .waitForFunction(
          () =>
            document.body.textContent?.includes("On its way to John") ||
            window.location.search.includes("name="),
          { timeout: 30000 },
        )
        .catch(() => null),
      form.locator('button[type="submit"]').click(),
    ]);
    if ((await page.getByText("On its way to John").count()) > 0) return form;
    if ((await page.getByText("Failed to send message").count()) > 0)
      throw new Error(
        "contact submit rate-limited (HTTP 429): the shared local send-contact-email budget is exhausted; retry later",
      );
    await page.goto(
      `/contact?utm_source=qa-journey&utm_medium=playwright&utm_campaign=inbound-pipeline`,
      { waitUntil: "networkidle", timeout: 60000 },
    );
    await openContactForm(page);
    form = await fillContactForm(page, { ...formData, email });
  }
  throw new Error("contact submit never reached the React handler after 3 attempts");
}

async function fillContactForm(page, data) {
  const form = page.locator('form:has(input[name="email"]):visible');
  await form.locator('input[name="name"]').fill(data.name);
  await form.locator('input[name="companyName"]').fill(data.companyName);
  await form.locator('input[name="companyWebsite"]').fill(data.companyWebsite);
  await form.locator('select[name="primaryProblem"]').selectOption(data.primaryProblem);
  await form.locator('input[name="email"]').fill(data.email);
  await form.locator('select[name="businessType"]').selectOption(data.businessType);
  await form.locator('textarea[name="message"]').fill(data.message);
  return form;
}

try {
  // 1. Desktop: invalid email is refused client-side (native validity, no send).
  const desktop = await newContext(DESKTOP, false);
  const page = await desktop.newPage();
  watch(page);
  await page.goto(
    `/contact?utm_source=qa-journey&utm_medium=playwright&utm_campaign=inbound-pipeline`,
    { waitUntil: "networkidle", timeout: 60000 },
  );
  check("contact form renders", await page.locator('form:has(input[name="email"])').count().then((n) => n >= 1));
  await openContactForm(page);
  const desktopForm = await fillContactForm(page, { ...formData, email: "not-an-email" });
  await desktopForm.locator('button[type="submit"]').click();
  const emailValidity = await page.evaluate(() => {
    const forms = [...document.querySelectorAll("form")].filter(
      (f) => f.querySelector('input[name="email"]') && f.offsetParent !== null,
    );
    return forms[0]?.querySelector('input[name="email"]')?.validity.valid ?? "missing";
  });
  check("invalid email blocked before submit", emailValidity === false, emailValidity);
  check(
    "no canonical records from invalid submit",
    (await dbCall("invalid-submit counts", canonicalCounts())).opportunities.length === 0,
  );
  await page.screenshot({ path: `${outDir}/contact-desktop.png` });

  // 2. Desktop: valid submit through the real route. QA markers suppress all
  // outbound mail, so this proves the canonical write with no inbox effect.
  // A 429 here means the shared local rate-limit bucket is exhausted: fail
  // loud, do not silently continue.
  await desktopForm.locator('input[name="email"]').fill(email);
  await submitContactForm(page, desktopForm);
  // submitContactForm only returns once the React handler confirms, so the
  // confirmation must be visible here; assert it instead of passing blindly.
  await page
    .getByText("On its way to John")
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => null);
  check(
    "contact submit confirms",
    await page
      .getByText("On its way to John")
      .first()
      .isVisible()
      .catch(() => false),
  );
  await page.screenshot({ path: `${outDir}/contact-submitted-desktop.png` });

  // 3. Canonical records: exactly one of each, stage new, UTM attribution kept.
  const afterFirst = await awaitCounts("first submit canonical set", {
    contacts: 1,
    companies: 1,
    opportunities: 1,
    submissions: 1,
    stageEvents: 1,
  });
  check("one canonical contact", afterFirst.contacts.length === 1, afterFirst.contacts.length);
  check("one canonical company", afterFirst.companies.length === 1, afterFirst.companies.length);
  check(
    "one canonical opportunity",
    afterFirst.opportunities.length === 1,
    afterFirst.opportunities.length,
  );
  const opp = afterFirst.opportunities[0];
  check("opportunity starts in new", opp?.stage === "new", opp?.stage);
  check("utm_source preserved", opp?.source === "qa-journey", opp?.source);
  check("utm_campaign preserved", opp?.source_detail === "inbound-pipeline", opp?.source_detail);
  check(
    "single birth stage event",
    afterFirst.stageEvents.length === 1 && afterFirst.stageEvents[0].to_stage === "new",
    afterFirst.stageEvents,
  );
  const opportunityId = opp?.id;
  check("opportunity id captured", typeof opportunityId === "string");
  if (typeof opportunityId !== "string")
    throw new Error("no canonical opportunity to drive the rest of the journey; aborting");
  await settledClose(desktop, 'desktop context');

  // 4. Server-side invalid input is a clean 400 with no send and no records.
  // Runs after the essential submits so a shared-budget 429 here only skips
  // this check instead of masking the circuit proof.
  const apiCtx = await newContext(DESKTOP, false);
  const badRes = await apiCtx.request.post(`${base}/api/send-contact-email`, {
    data: { ...formData, email: "still-not-an-email" },
  });
  if (badRes.status() === 429) {
    passed.push("invalid API submit skipped: shared rate-limit budget exhausted");
  } else {
    check("invalid API submit is 400", badRes.status() === 400, badRes.status());
  }
  check(
    "invalid API submit creates nothing",
    (await dbCall("api400 counts", canonicalCounts())).submissions.length <= afterFirst.submissions.length + 0,
  );
  await settledClose(apiCtx, 'api context');

  // 5. Mobile: duplicate submit through the real UI (outbound mail suppressed
  // by the same QA markers). Proves the mobile path and idempotent replay in
  // one step.
  const mobile = await newContext(MOBILE, false);
  const mpage = await mobile.newPage();
  watch(mpage);
  await mpage.goto(`/contact`, { waitUntil: "networkidle", timeout: 60000 });
  await openContactForm(mpage);
  const mobileForm = await fillContactForm(mpage, formData);
  await submitContactForm(mpage, mobileForm);
  // Frame the confirmation for the record shot; never fail the run here.
  const mobileConfirm = mpage.getByText("On its way to John").first();
  await mobileConfirm.waitFor({ timeout: 15000 }).catch(() => null);
  await mobileConfirm.scrollIntoViewIfNeeded().catch(() => null);
  await mpage.screenshot({ path: `${outDir}/contact-submitted-mobile.png` });
  await settledClose(mobile, 'mobile context');

  const afterDup = await awaitCounts(
    "duplicate submit canonical set",
    { contacts: 1, companies: 1, opportunities: 1, submissions: 2, stageEvents: 1 },
    60000,
  );
  check("duplicate keeps one contact", afterDup.contacts.length === 1, afterDup.contacts.length);
  check("duplicate keeps one company", afterDup.companies.length === 1, afterDup.companies.length);
  check(
    "duplicate keeps one opportunity",
    afterDup.opportunities.length === 1,
    afterDup.opportunities.length,
  );
  check(
    "duplicate adds no stage events",
    afterDup.stageEvents.length === 1,
    afterDup.stageEvents,
  );
  check(
    "both submissions preserved for audit",
    afterDup.submissions.length === 2,
    afterDup.submissions.length,
  );

  // 6. Unauthenticated admin is redirected to login, not leaked.
  const anon = await newContext(DESKTOP, false);
  const anonPage = await anon.newPage();
  watch(anonPage);
  await anonPage.goto(`/admin/pipeline`, { waitUntil: "domcontentloaded", timeout: 60000 });
  check("anon pipeline redirects to login", anonPage.url().includes("/admin/login"), anonPage.url());
  await settledClose(anon, 'anon context');

  // 7. Authenticated founder sees the lead in Today and Pipeline.
  const admin = await newContext(DESKTOP, true);
  const today = await admin.newPage();
  watch(today);
  await today.goto(`/admin/today`, { waitUntil: "networkidle", timeout: 60000 });
  await today.locator(`a:visible:has-text("${companyName}"), :visible:has-text("${companyName}")`).first().waitFor({ timeout: 30000 });
  check("lead visible in Today", true);
  await today.screenshot({ path: `${outDir}/today-desktop.png` });

  const pipeline = await admin.newPage();
  watch(pipeline);
  await pipeline.goto(`/admin/pipeline`, { waitUntil: "networkidle", timeout: 60000 });
  await visibleCompanyLink(pipeline).first().waitFor({ timeout: 30000 });
  check("lead visible in Pipeline", true);
  await pipeline.screenshot({ path: `${outDir}/pipeline-desktop.png` });

  // 8. Invalid stage move is rejected; valid move + next action go through the
  // same validated service the UI uses.
  const invalidMove = await admin.request.patch(`${base}/api/admin/revenue-os/pipeline`, {
    data: { id: opportunityId, stage: "__invalid__" },
  });
  check("invalid stage rejected", invalidMove.status() >= 400, invalidMove.status());

  const move = await admin.request.patch(`${base}/api/admin/revenue-os/pipeline`, {
    data: { id: opportunityId, stage: "contacted", reason: `QA journey ${runId}: founder review` },
  });
  check("stage moves to contacted", move.status() === 200, move.status());

  const nextActionText = `QA ${runId}: call back Tuesday`;
  const detail = await admin.request.patch(`${base}/api/admin/revenue-os/pipeline`, {
    data: {
      id: opportunityId,
      nextAction: nextActionText,
      nextActionAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    },
  });
  check("next action saved", detail.status() === 200, detail.status());

  await pipeline.goto(`/admin/pipeline`, { waitUntil: "networkidle", timeout: 60000 });
  await visibleCompanyLink(pipeline).first().waitFor({ timeout: 30000 });
  check(
    "moved stage reflected in Pipeline UI",
    (await pipeline.locator(':visible:has-text("contacted")').count()) >= 1,
  );
  check("next action reflected in Pipeline UI", (await pipeline.locator(`:visible:has-text("${nextActionText}")`).count()) >= 1);
  await pipeline.screenshot({ path: `${outDir}/pipeline-moved-desktop.png` });
  await settledClose(admin, 'admin context');

  // 9. Mobile founder view of the moved pipeline row.
  const adminMobile = await newContext(MOBILE, true);
  const mpipeline = await adminMobile.newPage();
  watch(mpipeline);
  await mpipeline.goto(`/admin/pipeline`, { waitUntil: "networkidle", timeout: 60000 });
  await visibleCompanyLink(mpipeline).first().waitFor({ timeout: 30000 });
  check("lead visible in mobile Pipeline", true);
  await mpipeline.screenshot({ path: `${outDir}/pipeline-mobile.png` });
  await settledClose(adminMobile, 'admin mobile context');
} finally {
  stepLog("finally purge");
  try {
    await dbCall("finally purge", purge());
  } catch (e) {
    failures.push(`finally purge failed: ${e.message}`);
  }
  stepLog("finally purge done");
  await settledClose(browser, 'browser');
}

for (const err of consoleErrors) failures.push(`console/server error: ${err}`);

const summary = {
  runId,
  email,
  companyName,
  base,
  passed: passed.length,
  failed: failures.length,
  failures,
  teardownNotes,
  screenshots: [
    "contact-desktop.png",
    "contact-submitted-desktop.png",
    "contact-submitted-mobile.png",
    "today-desktop.png",
    "pipeline-desktop.png",
    "pipeline-moved-desktop.png",
    "pipeline-mobile.png",
  ],
};
writeFileSync(`${outDir}/summary-${runId}.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (failures.length) {
  console.error(`\nINBOUND PIPELINE QA FAILED: ${failures.length} check(s)`);
  process.exit(1);
}
console.log("\nINBOUND PIPELINE QA PASSED");
process.exit(0);
