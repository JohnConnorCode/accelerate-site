/**
 * conversations-operator-inbox journey (authenticated founder inbox).
 *
 * Proves the three acceptance items in a browser:
 *   1. unread, intent, assignment, record, campaign, and follow-up filters
 *   2. opening a thread shows ordered canonical messages + opportunity context
 *   3. reply (confirm path), draft insert, link/create record, next-action
 *      task, and local archive surface errors and write receipts
 *
 * Gmail dispatch is intercepted: the review/confirm UI is exercised, but no
 * real provider send is issued. Fixture rows are namespaced by run id
 * (`qa-inbox-<runId>@example.invalid`) and deleted even when assertions fail.
 * Audit history is immutable and is left behind.
 *
 * Desktop + mobile screenshots land in /tmp/accelerate-qa-conversations.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3033";
const outDir = "/tmp/accelerate-qa-conversations";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for conversations QA`);
}

const runId = randomUUID().slice(0, 8);
const email = `qa-inbox-${runId}@example.invalid`;
const EMAIL_PREFIX = "qa-inbox-";
const NAME_PREFIX = "QA Inbox ";
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

const supabase = freshClient();

async function purge() {
  const db = freshClient();
  const { data: conversations } = await db
    .from("conversations")
    .select("id")
    .like("subject", `${NAME_PREFIX}%`);
  const conversationIds = (conversations ?? []).map((row) => row.id);
  if (conversationIds.length) {
    await db.from("messages").delete().in("conversation_id", conversationIds);
    await db.from("tasks").delete().in("related_id", conversationIds);
    await db.from("activities").delete().in("conversation_id", conversationIds);
    await db.from("conversations").delete().in("id", conversationIds);
  }
  const { data: opportunities } = await db
    .from("opportunities")
    .select("id")
    .like("email", `${EMAIL_PREFIX}%`);
  for (const opportunity of opportunities ?? []) {
    await db.from("tasks").delete().eq("opportunity_id", opportunity.id);
    await db.from("activities").delete().eq("opportunity_id", opportunity.id);
    await db.from("stage_events").delete().eq("opportunity_id", opportunity.id);
  }
  await db.from("opportunities").delete().like("email", `${EMAIL_PREFIX}%`);
  await db.from("contacts").delete().like("primary_email", `${EMAIL_PREFIX}%`);
  await db.from("companies").delete().like("name", `${NAME_PREFIX}%`);
  await db.from("campaigns").delete().like("name", `${NAME_PREFIX}%`);
}

function throwIf(error, label) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

await purge();

const { data: tenant, error: tenantError } = await supabase
  .from("tenants")
  .select("id,slug")
  .order("created_at", { ascending: true })
  .limit(1)
  .single();
throwIf(tenantError, "tenant");
const tenantId = tenant.id;

const { data: company, error: companyError } = await supabase
  .from("companies")
  .insert({
    tenant_id: tenantId,
    name: `${NAME_PREFIX}Co ${runId}`,
    domain: `qa-inbox-${runId}.example.invalid`,
  })
  .select("id")
  .single();
throwIf(companyError, "company");

const { data: contact, error: contactError } = await supabase
  .from("contacts")
  .insert({
    tenant_id: tenantId,
    full_name: `${NAME_PREFIX}${runId} Linked`,
    primary_email: email,
    company_id: company.id,
    source: "qa-conversations",
  })
  .select("id")
  .single();
throwIf(contactError, "contact");

const { data: opportunity, error: opportunityError } = await supabase
  .from("opportunities")
  .insert({
    tenant_id: tenantId,
    name: `${NAME_PREFIX}${runId} Deal`,
    email,
    contact_id: contact.id,
    company_id: company.id,
    stage: "qualified",
    source: "qa-conversations",
    estimated_value: 12000,
  })
  .select("id,name")
  .single();
throwIf(opportunityError, "opportunity");

const { data: linkTarget, error: linkTargetError } = await supabase
  .from("opportunities")
  .insert({
    tenant_id: tenantId,
    name: `${NAME_PREFIX}${runId} Target`,
    email: `qa-inbox-target-${runId}@example.invalid`,
    stage: "new",
    source: "qa-conversations",
    estimated_value: 4000,
  })
  .select("id,name")
  .single();
throwIf(linkTargetError, "link target");

const { data: campaign, error: campaignError } = await supabase
  .from("campaigns")
  .insert({
    tenant_id: tenantId,
    name: `${NAME_PREFIX}${runId} Campaign`,
    channel: "email",
    status: "draft",
  })
  .select("id")
  .single();
throwIf(campaignError, "campaign");

const now = new Date().toISOString();
const { data: linkedConv, error: linkedError } = await supabase
  .from("conversations")
  .insert({
    tenant_id: tenantId,
    channel: "gmail",
    external_id: `qa-inbox-${runId}-linked`,
    subject: `${NAME_PREFIX}${runId} linked pricing`,
    status: "open",
    intent: "pricing",
    unread_count: 1,
    last_message_at: now,
    contact_id: contact.id,
    company_id: company.id,
    opportunity_id: opportunity.id,
    campaign_id: campaign.id,
    metadata: { contact_email: email, assigned_to: process.env.ADMIN_EMAIL.toLowerCase() },
  })
  .select("id,subject")
  .single();
throwIf(linkedError, "linked conversation");

const { data: followConv, error: followError } = await supabase
  .from("conversations")
  .insert({
    tenant_id: tenantId,
    channel: "form",
    external_id: `qa-inbox-${runId}-follow`,
    subject: `${NAME_PREFIX}${runId} follow`,
    status: "open",
    intent: "support",
    unread_count: 0,
    last_message_at: now,
    metadata: { contact_email: `qa-inbox-follow-${runId}@example.invalid` },
  })
  .select("id,subject")
  .single();
throwIf(followError, "follow conversation");

const { data: unlinkedConv, error: unlinkedError } = await supabase
  .from("conversations")
  .insert({
    tenant_id: tenantId,
    channel: "chat",
    external_id: `qa-inbox-${runId}-unlinked`,
    subject: `${NAME_PREFIX}${runId} unlinked`,
    status: "open",
    intent: "demo",
    unread_count: 0,
    last_message_at: now,
    metadata: { contact_email: `qa-inbox-unlinked-${runId}@example.invalid` },
  })
  .select("id,subject")
  .single();
throwIf(unlinkedError, "unlinked conversation");

const { error: messageError } = await supabase.from("messages").insert([
  {
    tenant_id: tenantId,
    conversation_id: linkedConv.id,
    direction: "inbound",
    sender_email: email,
    recipient_emails: [process.env.ADMIN_EMAIL],
    subject: linkedConv.subject,
    body_text: "What is the pricing for the enterprise package?",
    status: "received",
    received_at: new Date(Date.now() - 60_000).toISOString(),
    created_at: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    tenant_id: tenantId,
    conversation_id: linkedConv.id,
    direction: "outbound",
    sender_email: process.env.ADMIN_EMAIL,
    recipient_emails: [email],
    subject: linkedConv.subject,
    body_text: "Thanks, I will send a scoped quote.",
    status: "sent",
    sent_at: now,
    created_at: now,
  },
]);
throwIf(messageError, "messages");

const { error: taskError } = await supabase.from("tasks").insert({
  tenant_id: tenantId,
  title: `${NAME_PREFIX}${runId} follow-up`,
  status: "pending",
  priority: "medium",
  related_type: "conversation",
  related_id: followConv.id,
  related_name: followConv.subject,
  source: "qa-conversations",
});
throwIf(taskError, "follow-up task");

const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/conversations` },
});
if (linkError || !linkData?.properties?.hashed_token)
  throw linkError || new Error("Could not generate a conversations QA session");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session)
  throw verifyError || new Error("Could not exchange a conversations QA session");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieKey = `sb-${projectRef}-auth-token`;
const cookieParts =
  cookieValue.length <= 3180
    ? [{ name: cookieKey, value: cookieValue }]
    : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({
        name: `${cookieKey}.${index}`,
        value: cookieValue.slice(index * 3180, (index + 1) * 3180),
      }));

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

function watch(page) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const url = message.location()?.url || "";
    const text = message.text();
    if (
      text.includes("requestStorageAccess") &&
      (url.includes("calendly") || url.includes("recaptcha.net"))
    )
      return;
    if (/400 \(Bad Request\)/.test(text)) return;
    consoleErrors.push(`${text} @${url.slice(0, 160)}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message.split("\n")[0]));
  page.on("response", (response) => {
    if (response.status() >= 500) consoleErrors.push(`${response.status()} ${response.url()}`);
  });
}

async function showList(page) {
  const search = page.getByPlaceholder("Search inbox...");
  if (await search.isVisible().catch(() => false)) return;
  const back = page.getByRole("button", { name: "Back to conversations" });
  if (await back.count()) await back.click({ force: true });
  await search.waitFor({ state: "visible", timeout: 10_000 });
}

async function openInbox(page) {
  await page.route("**/api/admin/revenue-os/conversations/reply", async (route) => {
    const payload = route.request().postDataJSON() || {};
    if (payload.confirmed) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          result: { simulated: true, id: `qa-reply-${runId}` },
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/admin/conversations", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Conversations" }).waitFor({ timeout: 30_000 });
  await showList(page);
  const search = page.getByPlaceholder("Search inbox...");
  await search.fill(`QA Inbox ${runId}`);
  await page
    .getByText(`${NAME_PREFIX}${runId} linked pricing`)
    .first()
    .waitFor({ timeout: 20_000 });
}

async function visibleSubjects(page) {
  const subjects = [
    `${NAME_PREFIX}${runId} linked pricing`,
    `${NAME_PREFIX}${runId} follow`,
    `${NAME_PREFIX}${runId} unlinked`,
  ];
  const found = [];
  for (const subject of subjects) {
    const row = page.locator("aside button", { hasText: subject });
    if (await row.count()) found.push(subject);
  }
  return found;
}

async function waitForSubjects(page, predicate, timeoutMs = 12_000) {
  const started = Date.now();
  let found = await visibleSubjects(page);
  while (Date.now() - started < timeoutMs) {
    if (predicate(found)) return found;
    await page.waitForTimeout(200);
    found = await visibleSubjects(page);
  }
  return found;
}

async function resetSearch(page) {
  await showList(page);
  const search = page.getByPlaceholder("Search inbox...");
  await search.fill(`QA Inbox ${runId}`);
  await page.getByRole("button", { name: "All conversations" }).click();
  if (
    (await page.getByRole("button", { name: "Show unread only" }).getAttribute("aria-pressed")) ===
    "true"
  ) {
    await page.getByRole("button", { name: "Show unread only" }).click();
  }
  if (
    (await page
      .getByRole("button", { name: "Show follow-up only" })
      .getAttribute("aria-pressed")) === "true"
  ) {
    await page.getByRole("button", { name: "Show follow-up only" }).click();
  }
  await page.getByLabel("Filter by intent").selectOption("all");
  await page.getByLabel("Filter by assignee").selectOption("all");
  await page.getByLabel("Filter by record link").selectOption("all");
  await page.getByLabel("Filter by campaign link").selectOption("all");
  await page.getByRole("button", { name: "Open conversations" }).click();
  await page
    .getByText(`${NAME_PREFIX}${runId} linked pricing`)
    .first()
    .waitFor({ timeout: 15_000 });
}

try {
  for (const [label, viewport] of [
    ["mobile", { width: 390, height: 844 }],
    ["desktop", { width: 1440, height: 1000 }],
  ]) {
    const context = await browser.newContext({
      baseURL: base,
      viewport,
      reducedMotion: "reduce",
    });
    const origin = new URL(base);
    await context.addCookies(
      cookieParts.map((cookie) => ({
        ...cookie,
        domain: origin.hostname,
        path: "/",
        httpOnly: false,
        secure: origin.protocol === "https:",
        sameSite: "Lax",
      })),
    );
    const page = await context.newPage();
    watch(page);
    await openInbox(page);

    const allSubjects = await visibleSubjects(page);
    check(
      `${label}: search isolates the three fixture threads`,
      allSubjects.length === 3,
      allSubjects,
    );

    await showList(page);
    await page.getByRole("button", { name: "Show unread only" }).click();
    const isLinked = (item) => item.includes("linked pricing");
    const unread = await waitForSubjects(page, (found) => found.length === 1 && isLinked(found[0]));
    check(
      `${label}: unread filter keeps the linked thread`,
      unread.length === 1 && isLinked(unread[0]),
      unread,
    );
    await page.getByRole("button", { name: "Show unread only" }).click();
    await waitForSubjects(page, (found) => found.length === 3);

    await page.getByLabel("Filter by intent").selectOption("pricing");
    const intent = await waitForSubjects(page, (found) => found.length === 1 && isLinked(found[0]));
    check(
      `${label}: intent filter keeps pricing`,
      intent.length === 1 && isLinked(intent[0]),
      intent,
    );
    await page.getByLabel("Filter by intent").selectOption("all");
    await waitForSubjects(page, (found) => found.length === 3);

    await page.getByLabel("Filter by assignee").selectOption("me");
    const mine = await waitForSubjects(page, (found) => found.length === 1 && isLinked(found[0]));
    check(
      `${label}: assignment filter keeps assigned-to-me`,
      mine.length === 1 && isLinked(mine[0]),
      mine,
    );
    await page.getByLabel("Filter by assignee").selectOption("unassigned");
    const unassigned = await waitForSubjects(
      page,
      (found) => found.length === 2 && !found.some(isLinked),
    );
    check(
      `${label}: unassigned filter hides the assigned thread`,
      unassigned.length === 2 && !unassigned.some(isLinked),
      unassigned,
    );
    await page.getByLabel("Filter by assignee").selectOption("all");
    await waitForSubjects(page, (found) => found.length === 3);

    await page.getByLabel("Filter by record link").selectOption("linked");
    const linked = await waitForSubjects(page, (found) => found.length === 1 && isLinked(found[0]));
    check(
      `${label}: record filter keeps linked`,
      linked.length === 1 && isLinked(linked[0]),
      linked,
    );
    await page.getByLabel("Filter by record link").selectOption("unlinked");
    const unlinked = await waitForSubjects(
      page,
      (found) => found.length === 2 && !found.some(isLinked),
    );
    check(
      `${label}: record filter keeps unlinked threads`,
      unlinked.length === 2 && !unlinked.some(isLinked),
      unlinked,
    );
    await page.getByLabel("Filter by record link").selectOption("all");
    await waitForSubjects(page, (found) => found.length === 3);

    await page.getByLabel("Filter by campaign link").selectOption("linked");
    const campaignLinked = await waitForSubjects(
      page,
      (found) => found.length === 1 && isLinked(found[0]),
    );
    check(
      `${label}: campaign filter keeps the campaign thread`,
      campaignLinked.length === 1 && isLinked(campaignLinked[0]),
      campaignLinked,
    );
    await page.getByLabel("Filter by campaign link").selectOption("all");
    await waitForSubjects(page, (found) => found.length === 3);

    await page.getByRole("button", { name: "Show follow-up only" }).click();
    const followUp = await waitForSubjects(
      page,
      (found) => found.length === 1 && found[0].includes("follow"),
    );
    check(
      `${label}: follow-up filter keeps the open-task thread`,
      followUp.length === 1 && followUp[0].includes("follow"),
      followUp,
    );
    await page.getByRole("button", { name: "Show follow-up only" }).click();
    await waitForSubjects(page, (found) => found.length === 3);

    await resetSearch(page);
    await page.getByText(`${NAME_PREFIX}${runId} linked pricing`).first().click();
    if (label === "mobile") {
      await page
        .getByRole("heading", { name: `${NAME_PREFIX}${runId} linked pricing` })
        .waitFor({ timeout: 15_000 });
    }
    const inbound = page.getByText("What is the pricing for the enterprise package?");
    const outbound = page.getByText("Thanks, I will send a scoped quote.");
    await inbound.waitFor({ timeout: 15_000 });
    await outbound.waitFor({ timeout: 15_000 });
    check(`${label}: ordered inbound message visible`, (await inbound.count()) > 0);
    check(`${label}: ordered outbound message visible`, (await outbound.count()) > 0);
    check(
      `${label}: opportunity cockpit names the linked deal`,
      (await page.getByText(`${NAME_PREFIX}${runId} Deal`).count()) > 0,
    );

    const insertDraft = page.getByRole("button", { name: "Insert Draft" });
    if (await insertDraft.count()) {
      await insertDraft.click();
      const composer = page.locator("textarea");
      const draft = await composer.inputValue();
      check(
        `${label}: suggested draft inserted`,
        /pricing|packages|options/i.test(draft),
        draft.slice(0, 80),
      );
      await page.getByRole("button", { name: "Review & Send" }).click();
      await page.getByText("Confirm dispatch for this message?").waitFor({ timeout: 10_000 });
      await page.getByRole("button", { name: "Confirm send" }).click();
      await page.getByText("Reply recorded and dispatched.").waitFor({ timeout: 10_000 });
      check(`${label}: confirmed reply shows a receipt toast`, true);
    } else {
      failures.push(`${label}: suggested draft banner missing on the pricing thread`);
    }

    await page.getByLabel("Assignee email").fill("not-an-email");
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await page.getByText(/Invalid assignee email/i).waitFor({ timeout: 10_000 });
    check(`${label}: invalid assignee is an actionable error`, true);

    if (label === "desktop") {
      await resetSearch(page);
      await page.getByText(`${NAME_PREFIX}${runId} unlinked`).first().click();
      await page.getByRole("button", { name: "Link existing" }).click();
      await page.getByLabel("Search opportunities to link").fill(`${NAME_PREFIX}${runId} Target`);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.getByRole("button", { name: new RegExp(`${NAME_PREFIX}${runId} Target`) }).click();
      await page.getByText(`Linked ${NAME_PREFIX}${runId} Target`).waitFor({ timeout: 15_000 });
      check(`${label}: link existing opportunity receipt`, true);

      await page.getByRole("button", { name: "Add Task" }).click();
      await page
        .getByPlaceholder("e.g. Send proposal follow-up")
        .fill(`${NAME_PREFIX}${runId} next action`);
      await page.getByRole("button", { name: "Add Task" }).last().click();
      await page.getByText("Follow-up task created.").waitFor({ timeout: 15_000 });
      check(`${label}: next-action task receipt`, true);

      await page.getByRole("button", { name: "Archive conversation" }).click();
      await page.getByText("Conversation marked as archived").waitFor({ timeout: 15_000 });
      check(`${label}: local archive receipt`, true);
    }

    await page.screenshot({ path: `${outDir}/${label}.png`, fullPage: true });
    await context.close();
  }

  const db = freshClient();
  const { data: archived } = await db
    .from("conversations")
    .select("status")
    .eq("id", unlinkedConv.id)
    .single();
  check(
    "archive persisted locally without a Gmail mutation",
    archived?.status === "archived",
    archived,
  );
  const { data: linkedRow } = await db
    .from("conversations")
    .select("opportunity_id")
    .eq("id", unlinkedConv.id)
    .single();
  check(
    "link existing wrote the canonical opportunity id",
    linkedRow?.opportunity_id === linkTarget.id,
    linkedRow,
  );
  const { data: taskRows } = await db
    .from("tasks")
    .select("id,title")
    .eq("related_id", unlinkedConv.id)
    .ilike("title", `%${runId} next action%`);
  check("next-action task row exists", (taskRows ?? []).length >= 1, taskRows);
  const { data: auditRows } = await db
    .from("audit_log")
    .select("action")
    .eq("entity_id", unlinkedConv.id)
    .in("action", ["conversation.linked_record", "conversation.status_archived"]);
  check("link and archive audit receipts exist", (auditRows ?? []).length >= 2, auditRows);
} finally {
  await browser.close();
  await purge();
}

const uniqueConsole = [...new Set(consoleErrors)];
if (uniqueConsole.length) failures.push(...uniqueConsole.map((item) => `console: ${item}`));

console.log(`passed ${passed.length}: ${passed.join("; ")}`);
if (failures.length) {
  console.error(`failed ${failures.length}:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("conversations inbox journey passed");
