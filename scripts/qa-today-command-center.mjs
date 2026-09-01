import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accel-shots";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for authenticated Today QA`);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/today` },
});
if (linkError || !linkData?.properties?.hashed_token)
  throw linkError || new Error("Could not generate a QA sign-in token");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session)
  throw verifyError || new Error("Could not exchange the QA sign-in token");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookies = [{ name: `sb-${projectRef}-auth-token`, value: cookieValue }];
const overview = {
  schemaReady: true,
  generatedAt: "2026-08-16T12:00:00.000Z",
  metrics: {
    openOpportunities: 12,
    pipelineValue: 185000,
    weightedValue: 82400,
    wonRevenue: 42000,
    unreadConversations: 4,
    activeCampaigns: 2,
    pendingProposals: 3,
  },
  queue: [
    {
      id: "conversation:1",
      kind: "reply",
      title: "Apex Roofing needs a proposal revision",
      summary: "2 unread messages · buying",
      urgency: "high",
      dueAt: "2026-08-16T08:00:00.000Z",
      sourceTimestamp: "2026-08-16T08:00:00.000Z",
      priorityReason: "Buying signal needs a reply",
      recommendedNextAction: "Read the latest message and stage a grounded reply.",
      href: "/admin/conversations?thread=1",
    },
    {
      id: "task:1",
      kind: "task",
      title: "Confirm discovery call objectives",
      summary: "Capture decision makers and desired outcomes before Monday.",
      urgency: "critical",
      dueAt: "2026-08-15",
      sourceTimestamp: "2026-08-15T14:00:00.000Z",
      priorityReason: "Overdue commitment",
      recommendedNextAction: "Open the opportunity and complete or reschedule the commitment.",
      href: "/admin/pipeline?opportunity=1",
    },
    {
      id: "task:2",
      kind: "task",
      title: "Prepare the weekly pipeline review",
      summary: "Collect blockers and next actions before the operator review.",
      urgency: "normal",
      dueAt: "2026-08-18",
      sourceTimestamp: "2026-08-16T07:00:00.000Z",
      priorityReason: "Due 2026-08-18",
      recommendedNextAction: "Complete the commitment, or snooze it to a specific date.",
      href: "/admin/today",
    },
    {
      id: "action:1",
      kind: "approval",
      title: "Approve follow-up to Summit Mechanical",
      summary: "A concise, founder-reviewed response is ready to send.",
      urgency: "high",
      dueAt: "2026-08-16T09:00:00.000Z",
      sourceTimestamp: "2026-08-16T09:00:00.000Z",
      priorityReason: "Approval required before execution",
      recommendedNextAction: "Review the exact action and approve or reject it.",
      href: "/admin/today?focus=approvals",
    },
    {
      id: "action:2",
      kind: "approval",
      title: "Review campaign activation",
      summary: "The campaign is staged but must not start without approval.",
      urgency: "normal",
      dueAt: "2026-08-16T09:30:00.000Z",
      sourceTimestamp: "2026-08-16T09:30:00.000Z",
      priorityReason: "Approval required before execution",
      recommendedNextAction: "Review the exact action and approve or reject it.",
      href: "/admin/today?focus=approval&action=2",
    },
    {
      id: "proposal:1",
      kind: "proposal",
      title: "Westlake automation proposal",
      summary: "Viewed and awaiting a response.",
      urgency: "normal",
      dueAt: "2026-08-21T12:00:00.000Z",
      sourceTimestamp: "2026-08-16T10:00:00.000Z",
      priorityReason: "Proposal expires within seven days",
      recommendedNextAction: "Review proposal activity and send a deliberate follow-up.",
      href: "/admin/proposals",
    },
  ],
  integrations: [],
  health: {
    status: "attention",
    attentionCount: 1,
    integrations: [
      {
        provider: "gmail",
        status: "connected",
        lastSuccessAt: "2026-08-16T10:00:00.000Z",
        lastError: null,
      },
    ],
    sourceRuns: [
      {
        key: "gmail-sync",
        status: "success",
        startedAt: "2026-08-16T10:00:00.000Z",
        finishedAt: "2026-08-16T10:01:00.000Z",
        error: null,
      },
    ],
    jobRuns: [
      {
        key: "campaign-sends",
        status: "partial",
        startedAt: "2026-08-16T09:00:00.000Z",
        finishedAt: "2026-08-16T09:01:00.000Z",
        error: "One recipient needs review",
      },
    ],
  },
};
let mutableActions = [
  {
    id: "1",
    action_type: "send_email",
    title: "Approve follow-up to Summit Mechanical",
    description: "A concise, founder-reviewed response is ready to send.",
    urgency: "high",
    reasoning: null,
    status: "pending",
    created_at: "2026-08-16T09:00:00.000Z",
    expires_at: null,
    payload: {
      to: "owner@summit.example",
      subject: "Next steps",
      body: "Thanks for the conversation. Here are the agreed next steps.",
    },
  },
  {
    id: "2",
    action_type: "activate_campaign",
    title: "Review campaign activation",
    description: "The campaign is staged but must not start without approval.",
    urgency: "normal",
    reasoning: "The operator asked to review the audience before launch.",
    status: "pending",
    created_at: "2026-08-16T09:30:00.000Z",
    expires_at: null,
    payload: { campaignId: "campaign-1" },
  },
];
const aiRuns = {
  schemaReady: true,
  feedback: { helpful: 3, notHelpful: 1 },
  runs: [
    {
      id: "qa-agent-run",
      surface: "admin_command_stream",
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      tool_pack: "core",
      conversation_id: "qa-conversation",
      duration_ms: 4000,
      status: "completed",
      tool_names: ["get_today_snapshot", "propose_task"],
      input_tokens: 720,
      output_tokens: 190,
      result_preview:
        "Focus first on the overdue discovery-call commitment, then reply to Apex Roofing.",
      error: null,
      started_at: "2026-08-16T10:00:00.000Z",
      finished_at: "2026-08-16T10:00:04.000Z",
      feedback: "helpful",
    },
  ],
};
const analytics = {
  schemaReady: true,
  windowDays: 30,
  cohort: "Opportunities created in the selected window and their current furthest stage.",
  funnel: {
    opportunities: 24,
    qualified: 15,
    meetings: 9,
    proposals: 5,
    won: 3,
    wonRevenue: 42000,
    pipelineValue: 185000,
  },
  rates: { qualified: 62.5, meeting: 60, proposal: 55.6, win: 60, inquiryToWin: 12.5 },
  attribution: { missing: 2 },
  sources: [
    { source: "Google", opportunities: 10, won: 2, revenue: 30000 },
    { source: "Direct", opportunities: 8, won: 1, revenue: 12000 },
  ],
  web: {
    status: "ready",
    pageViews: 320,
    visitors: 186,
    conversions: 24,
    conversionRate: 7.5,
    topPages: [
      { label: "/", count: 110 },
      { label: "/services", count: 65 },
    ],
    sources: [
      { label: "google", count: 120 },
      { label: "Direct / unknown", count: 86 },
    ],
    conversionEvents: [
      { label: "contact_form_submitted", count: 12 },
      { label: "strategy_call_cta_clicked", count: 8 },
    ],
    eventCount: 344,
    lastCapturedAt: "2026-08-16T12:00:00.000Z",
  },
};
let mutableQueue = [...overview.queue];
let failOverview = false;
let expectedFailureResponses = 0;

const browser = await chromium.launch({ headless: true });
const errors = [];
async function pageFor(viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({
    viewport,
    colorScheme: "light",
    deviceScaleFactor: 1,
    reducedMotion,
  });
  const origin = new URL(base);
  await context.addCookies(
    cookies.map((cookie) => ({
      ...cookie,
      domain: origin.hostname,
      path: "/",
      httpOnly: false,
      secure: origin.protocol === "https:",
      sameSite: "Lax",
    })),
  );
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().includes("status of 503 (Service Unavailable)")) return;
    errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() < 500) return;
    if (failOverview && response.url().includes("/api/admin/revenue-os/overview"))
      expectedFailureResponses += 1;
    else errors.push(`${response.status()} ${response.url()}`);
  });
  // The production analytics proxy intentionally has no local provider during QA.
  // Stub it so the test continues to fail on product-console errors, not telemetry setup.
  await page.route("**/js/script.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  await page.route("**/api/admin/revenue-os/overview", (route) =>
    failOverview
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Priority sources are temporarily unavailable." }),
        })
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...overview,
            generatedAt: new Date().toISOString(),
            queue: mutableQueue,
          }),
        }),
  );
  await page.route("**/api/admin/revenue-os/priority", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: overview.generatedAt,
        summary: {
          total: mutableQueue.length,
          urgent: mutableQueue.filter((item) => ["critical", "high"].includes(item.urgency)).length,
          critical: mutableQueue.filter((item) => item.urgency === "critical").length,
        },
        items: mutableQueue,
      }),
    }),
  );
  await page.route("**/api/admin/notifications", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        notifications: [],
        unreadCount: 0,
        urgentCount: 0,
        priority: {
          status: "ready",
          summary: {
            total: mutableQueue.length,
            urgent: mutableQueue.filter((item) => ["critical", "high"].includes(item.urgency))
              .length,
            critical: mutableQueue.filter((item) => item.urgency === "critical").length,
          },
          items: mutableQueue.slice(0, 5),
        },
      }),
    }),
  );
  await page.route("**/api/admin/revenue-os/actions", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      mutableActions = mutableActions.filter((action) => action.id !== body.id);
      mutableQueue = mutableQueue.filter((item) => item.id !== `action:${body.id}`);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: { id: body.id, status: body.decision === "approve" ? "approved" : "rejected" },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ actions: mutableActions }),
    });
  });
  await page.route("**/api/admin/revenue-os/ai/conversations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaReady: true, conversations: [] }),
    }),
  );
  await page.route("**/api/admin/revenue-os/ai/stream", (route) => {
    const answer =
      "Focus first on the overdue discovery-call commitment, then reply to Apex Roofing.";
    const events = [
      { type: "conversation", conversationId: "qa-conversation", userMessageId: "qa-user-message" },
      { type: "run_started", runId: "qa-agent-run", model: "openai/gpt-5-mini", pack: "core" },
      { type: "assistant_delta", delta: answer },
      {
        type: "final",
        conversationId: "qa-conversation",
        messageId: "qa-assistant-message",
        runId: "qa-agent-run",
        text: answer,
        proposedActions: [],
      },
    ];
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body: events
        .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
        .join(""),
    });
  });
  await page.route("**/api/admin/revenue-os/ai/feedback", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    }),
  );
  await page.route("**/api/admin/revenue-os/ai/runs", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(aiRuns) }),
  );
  await page.route("**/api/admin/revenue-os/analytics?days=*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(analytics),
    }),
  );
  await page.route("**/api/admin/revenue-os/tasks", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "complete")
      mutableQueue = mutableQueue.filter((item) => item.id !== `task:${body.id}`);
    if (body.action === "snooze")
      mutableQueue = mutableQueue.filter((item) => item.id !== `task:${body.id}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        task: { id: body.id, status: body.action === "complete" ? "completed" : "snoozed" },
      }),
    });
  });
  return { context, page };
}

const desktop = await pageFor({ width: 1440, height: 1000 });
await desktop.page.goto(`${base}/admin/today`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await desktop.page.getByRole("heading", { name: "Today", exact: true }).waitFor();
await desktop.page.getByText("Apex Roofing needs a proposal revision", { exact: true }).waitFor();
await desktop.page
  .getByText("Next: Read the latest message and stage a grounded reply.", { exact: true })
  .waitFor();
await desktop.page.getByRole("button", { name: /Open command center alerts/ }).click();
const desktopPriority = desktop.page.getByRole("region", { name: "Priority work" });
await desktopPriority.getByText("Priority work", { exact: true }).waitFor();
await desktopPriority
  .getByText("Next: Open the opportunity and complete or reschedule the commitment.", {
    exact: true,
  })
  .waitFor();
await desktop.page.waitForTimeout(250);
await desktop.page.screenshot({ path: `${outDir}/priority-attention-desktop.png`, fullPage: true });
await desktop.page
  .getByRole("dialog", { name: "Command Center attention" })
  .getByRole("button", { name: "Close command center alerts" })
  .click();
await desktopPriority.waitFor({ state: "detached" });
await desktop.page.getByRole("button", { name: "Replies" }).click();
await desktop.page.getByText("Apex Roofing needs a proposal revision", { exact: true }).waitFor();
if (await desktop.page.getByText("Westlake automation proposal", { exact: true }).count())
  throw new Error("Reply focus did not filter the operator queue");
await desktop.page.getByRole("button", { name: "All work", exact: true }).click();
await desktop.page.screenshot({
  path: `${outDir}/today-command-center-desktop.png`,
  fullPage: true,
});

failOverview = true;
await desktop.page.getByRole("button", { name: "Refresh", exact: true }).click();
await desktop.page.getByText("Showing the last successful snapshot", { exact: true }).waitFor();
await desktop.page.getByText("Apex Roofing needs a proposal revision", { exact: true }).waitFor();
failOverview = false;
await desktop.page.getByRole("button", { name: "Retry live read" }).click();
await desktop.page
  .getByText("Showing the last successful snapshot", { exact: true })
  .waitFor({ state: "detached" });

failOverview = true;
await desktop.page.reload({ waitUntil: "domcontentloaded" });
await desktop.page.getByText("Today is temporarily unavailable", { exact: true }).waitFor();
failOverview = false;
await desktop.page.getByRole("button", { name: "Retry", exact: true }).click();
await desktop.page.getByText("Apex Roofing needs a proposal revision", { exact: true }).waitFor();

await desktop.page.goto(`${base}/admin/today?focus=approval&action=1`, {
  waitUntil: "domcontentloaded",
});
const approvalDialog = desktop.page.getByRole("dialog", {
  name: "Approve follow-up to Summit Mechanical",
});
await approvalDialog.waitFor();
await approvalDialog.getByText(/Sends this email immediately\. It cannot be recalled\./).waitFor();
await approvalDialog.getByRole("button", { name: "Approve and send" }).click();
await approvalDialog.waitFor({ state: "detached" });
if (await desktop.page.getByText("Approve follow-up to Summit Mechanical", { exact: true }).count())
  throw new Error("Approved action remained in the shared operator queue");
await desktop.page.getByRole("button", { name: "Reject", exact: true }).click();
await desktop.page.getByText("No decisions waiting", { exact: true }).waitFor();
if (await desktop.page.getByText("Review campaign activation", { exact: true }).count())
  throw new Error("Rejected action remained in the shared operator queue");

await desktop.page.getByRole("button", { name: "All work", exact: true }).click();
await desktop.page
  .getByRole("button", { name: "Complete Confirm discovery call objectives" })
  .click();
await desktop.page
  .getByText("Confirm discovery call objectives", { exact: true })
  .waitFor({ state: "detached" });
await desktop.page
  .getByRole("button", { name: "Snooze Prepare the weekly pipeline review until tomorrow" })
  .click();
await desktop.page
  .getByText("Prepare the weekly pipeline review", { exact: true })
  .waitFor({ state: "detached" });
const queueBeforeEmpty = [...mutableQueue];
mutableQueue = [];
await desktop.page.getByRole("button", { name: "Refresh", exact: true }).click();
await desktop.page.getByText("Queue clear", { exact: true }).waitFor();
await desktop.page.getByRole("link", { name: "Open pipeline" }).waitFor();
await desktop.page.getByRole("link", { name: "Verify systems" }).waitFor();
mutableQueue = queueBeforeEmpty;
await desktop.page.getByRole("button", { name: "Refresh", exact: true }).click();
await desktop.page.getByText("Apex Roofing needs a proposal revision", { exact: true }).waitFor();
await desktop.page
  .getByPlaceholder("Ask about pipeline, replies, campaigns, or next actions…")
  .fill("What should I do next?");
await desktop.page.getByRole("button", { name: "Send command" }).click();
await desktop.page
  .getByText("Focus first on the overdue discovery-call commitment, then reply to Apex Roofing.", {
    exact: true,
  })
  .waitFor();
await desktop.page.getByRole("button", { name: "Mark answer helpful" }).click();
await desktop.page.screenshot({
  path: `${outDir}/today-command-center-feedback.png`,
  fullPage: true,
});
await desktop.page.goto(`${base}/admin/ai-operations`, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await desktop.page.getByRole("heading", { name: "AI Operations", exact: true }).waitFor();
await desktop.page.getByText("Recent agent decisions", { exact: true }).waitFor();
await desktop.page.screenshot({ path: `${outDir}/ai-operations-desktop.png`, fullPage: true });
await desktop.page.goto(`${base}/admin/analytics`, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await desktop.page.getByRole("heading", { name: "Analytics", exact: true }).waitFor();
await desktop.page.getByText("Traffic and conversion signals", { exact: true }).waitFor();
await desktop.page.getByText("Source to revenue", { exact: true }).waitFor();
await desktop.page.screenshot({
  path: `${outDir}/analytics-command-center-desktop.png`,
  fullPage: true,
});

const mobile = await pageFor({ width: 390, height: 844 }, "reduce");
await mobile.page.goto(`${base}/admin/today`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await mobile.page.getByRole("heading", { name: "Today", exact: true }).waitFor();
await mobile.page.getByRole("button", { name: "Proposals" }).click();
await mobile.page.getByText("Westlake automation proposal", { exact: true }).waitFor();
await mobile.page.screenshot({ path: `${outDir}/today-command-center-mobile.png`, fullPage: true });
await mobile.page.getByRole("button", { name: /Open command center alerts/ }).click();
await mobile.page
  .getByRole("region", { name: "Priority work" })
  .getByText("Priority work", { exact: true })
  .waitFor();
const mobileAlerts = mobile.page.getByRole("dialog", { name: "Command Center attention" });
await mobileAlerts.waitFor();
const mobileAlertBounds = await mobileAlerts.evaluate((element) => {
  const bounds = element.getBoundingClientRect();
  return { top: bounds.top, bottom: bounds.bottom, width: bounds.width };
});
if (mobileAlertBounds.top < 0 || mobileAlertBounds.bottom > 846 || mobileAlertBounds.width > 392)
  throw new Error(`Mobile alerts are not contained: ${JSON.stringify(mobileAlertBounds)}`);
await mobile.page.waitForTimeout(250);
await mobile.page.screenshot({
  path: `${outDir}/priority-attention-mobile-reduced.png`,
  fullPage: true,
});
await mobileAlerts.getByRole("button", { name: "Close command center alerts" }).click();
await mobileAlerts.waitFor({ state: "detached" });
await mobile.page.goto(`${base}/admin/analytics`, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await mobile.page.getByRole("heading", { name: "Analytics", exact: true }).waitFor();
await mobile.page.getByText("Top landing pages", { exact: true }).waitFor();
await mobile.page.screenshot({
  path: `${outDir}/analytics-command-center-mobile.png`,
  fullPage: true,
});

await desktop.context.close();
await mobile.context.close();
await browser.close();
if (errors.length) throw new Error(`Console errors during Today QA:\n${errors.join("\n")}`);
if (expectedFailureResponses < 2)
  throw new Error("Today failure-state QA did not exercise both degraded and fatal reads");
console.log(`${outDir}/today-command-center-desktop.png`);
console.log(`${outDir}/today-command-center-mobile.png`);
console.log(`${outDir}/today-command-center-feedback.png`);
console.log(`${outDir}/ai-operations-desktop.png`);
console.log(`${outDir}/analytics-command-center-desktop.png`);
console.log(`${outDir}/analytics-command-center-mobile.png`);
console.log(
  "Today command-center desktop/mobile, deep-action, mutation-counter, degraded, fatal, retry, and focus-filter QA passed.",
);
