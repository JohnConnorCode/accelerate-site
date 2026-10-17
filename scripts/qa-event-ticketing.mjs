import { WORKSHOP_EVENT, WORKSHOP_EVENT_ID } from "../src/content/workshops.ts";
import { eventDefinitionSchema } from "../src/lib/revenue-os/event-ticketing-contract.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

// Actual compiled pages and shared demo, with an isolated read-only database
// transport. Browser requests model provider failures; SQL/service tests prove
// real persistence, payment verification and idempotency separately.
const output = process.env.EVENT_TICKETING_QA_OUTPUT || "/tmp/accelerate-event-ticketing";
const controlledTracking = process.env.EVENT_TICKETING_QA_TRACKING === "controlled";
await mkdir(output, { recursive: true });
const tenant = {
  id: "acce1e8e-0000-4000-8000-000000000001",
  slug: "accelerate",
  name: "Accelerate",
  status: "active",
  config: { modules: { "event-ticketing": true } },
};
const event = {
  ...WORKSHOP_EVENT,
  id: WORKSHOP_EVENT_ID,
  tenant_id: tenant.id,
  status: "published",
  revision: 1,
  paid_tickets: 0,
  reserved_tickets: 0,
  available_tickets: 40,
  gross_cents: 0,
  refunded_cents: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
if (Date.parse(event.starts_at) <= Date.now()) {
  const start = Date.now() + 7 * 86400000;
  Object.assign(event, {
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + 90 * 60000).toISOString(),
    refund_cutoff: new Date(start - 48 * 3600000).toISOString(),
  });
}
let fixtureStatus = "published";
const escaped = [],
  results = [];
const fixture = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "GET") {
    escaped.push(`database ${request.method}`);
    response.writeHead(405);
    response.end("{}");
    return;
  }
  const url = new URL(request.url, "http://localhost");
  let rows = [];
  if (
    url.pathname === "/rest/v1/tenants" &&
    (!url.searchParams.has("slug") || url.searchParams.get("slug") === "eq.accelerate")
  )
    rows = [tenant];
  if (
    url.pathname === "/rest/v1/ticket_event_availability" &&
    (url.searchParams.get("slug") === `eq.${event.slug}` ||
      url.searchParams.get("id") === `eq.${event.id}`) &&
    (!url.searchParams.has("status") || fixtureStatus !== "draft")
  )
    rows = [{ ...event, status: fixtureStatus }];
  response.end(JSON.stringify(rows));
});
const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
const fixturePort = await listen(fixture);
const portProbe = createServer();
const port = await listen(portProbe);
await new Promise((resolve) => portProbe.close(resolve));
const base = `http://127.0.0.1:${port}`;
let serverLog = "",
  browser,
  server;
try {
  const artifactConfig = JSON.parse(
    await readFile(`${process.env.NEXT_DIST_DIR || ".next"}/required-server-files.json`, "utf8"),
  ).config;
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      env: {
        ...process.env,
        NEXT_DEPLOYMENT_ID: artifactConfig.deploymentId,
        NEXT_PUBLIC_DISTRIBUTION_PROFILE: "branded",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_controlled_workshop_fixture",
        SUPABASE_SERVICE_ROLE_KEY: "controlled-workshop-service-key",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const log = (chunk) => {
    serverLog = (serverLog + chunk.toString()).slice(-12000);
  };
  server.stdout.on("data", log);
  server.stderr.on("data", log);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try {
      if ((await fetch(`${base}/events/${event.slug}`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Server is starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, `Controlled workshop server did not become ready: ${serverLog}`);
  const api = `${base}/api/public/accelerate/events/${event.slug}`;
  assert.equal(
    (
      await fetch(`${api}/checkout`, {
        method: "POST",
        headers: { origin: "https://foreign.example" },
        body: "{}",
      })
    ).status,
    403,
  );
  const publicRead = await fetch(api);
  assert.equal(publicRead.status, 200);
  assert.equal((await publicRead.json()).event.price_cents, 5000);
  assert.equal(publicRead.headers.get("cache-control"), "no-store");
  // Revalidate any build-time homepage snapshot against this isolated event.
  // The production save path invalidates the homepage immediately.
  let homePromotionReady = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    const home = await (await fetch(base)).text();
    if (home.includes('aria-label="Upcoming workshop"')) {
      homePromotionReady = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(homePromotionReady, "The published event must reach the homepage");
  browser = await chromium.launch({ headless: true });
  for (const [width, theme, reducedMotion] of [
    [1440, "light", "no-preference"],
    [390, "light", "reduce"],
    [1440, "dark", "reduce"],
    [390, "dark", "no-preference"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      reducedMotion,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [],
      purchases = [],
      contexts = [];
    let checkoutAttempts = 0,
      contextAttempts = 0,
      receiptState = "checkout",
      receiptTestMode = false;
    const orderId = randomUUID(),
      key = randomUUID();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !(message.location().url.startsWith(api) && /\b(?:409|422|503)\b/.test(message.text()))
      )
        errors.push(message.text());
    });
    await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "checkout.stripe.com")
        return route.fulfill({
          contentType: "text/html",
          body: "<h1>Controlled Stripe handoff</h1>",
        });
      if (url.origin !== base) {
        if (
          controlledTracking &&
          ((url.hostname === "www.googletagmanager.com" &&
            url.pathname === "/gtag/js" &&
            url.searchParams.get("id") === "G-CONTROLLEDWORKSHOP") ||
            (url.hostname === "connect.facebook.net" && url.pathname === "/en_US/fbevents.js"))
        )
          return route.fulfill({
            contentType: "application/javascript",
            body: "/* Controlled tracking SDK stub. No network collection. */",
          });
        escaped.push(url.origin + url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    await page.route(`${api}**`, (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        purchases.push(request.postDataJSON());
        checkoutAttempts++;
        return route.fulfill(
          checkoutAttempts === 1
            ? {
                status: 503,
                json: { error: "Checkout could not be started. Retry with the same details." },
              }
            : checkoutAttempts === 2
              ? {
                  status: 409,
                  json: {
                    error:
                      "This reservation expired. Review availability and start a new purchase.",
                    restartCheckout: true,
                  },
                }
              : checkoutAttempts === 3
                ? { json: { url: "https://checkout.stripe.com/c/pay/cs_controlled", orderId } }
                : {
                    json: {
                      confirmed: true,
                      url: `${base}/events/${event.slug}/confirmation?order=${orderId}&key=${key}`,
                    },
                  },
        );
      }
      if (request.method() === "PATCH") {
        contexts.push(request.postDataJSON());
        contextAttempts++;
        return route.fulfill(
          contextAttempts === 1
            ? { status: 422, json: { error: "Your answers could not be saved. Please retry." } }
            : { json: { saved: true } },
        );
      }
      if (new URL(request.url()).searchParams.has("order"))
        return route.fulfill({
          json: {
            reference: orderId,
            quantity: 2,
            totalCents: 10000,
            state: receiptState,
            event,
            emailStatus: "attention",
            testMode: receiptTestMode,
          },
        });
      return route.continue();
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    const announcement = page.getByRole("complementary", { name: "Upcoming workshop" });
    await announcement.waitFor({ state: "visible" });
    assert.equal(await announcement.getByRole("heading").innerText(), event.headline);
    const ticketCta = announcement.getByRole("link", { name: "Get tickets · $50" });
    assert.equal(await ticketCta.getAttribute("href"), `/events/${event.slug}#tickets`);
    const timer = announcement.getByRole("timer");
    const originalClock = await timer.innerText();
    await page.waitForFunction(
      (previous) => document.querySelector('[role="timer"]')?.innerText !== previous,
      originalClock,
    );
    const bounds = await announcement.boundingBox();
    assert.ok(bounds.x >= 8 && bounds.x + bounds.width <= width - 8);
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= (width === 390 ? 844 : 1000));
    const announcementAccessibility = await new AxeBuilder({ page })
      .include("[data-workshop-announcement]")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      announcementAccessibility.violations.map((item) => item.id),
      [],
    );
    await page.screenshot({ path: `${output}/homepage-workshop-${width}-${theme}.png` });
    if (theme === "light") {
      await ticketCta.click();
      await page.waitForURL(`**/events/${event.slug}#tickets`);
      await page.waitForFunction(() => {
        const box = document.getElementById("tickets")?.getBoundingClientRect();
        return box && box.top >= 0 && box.top < innerHeight / 2;
      });
      await page.goBack({ waitUntil: "domcontentloaded" });
      await announcement.waitFor({ state: "visible" });
    }
    await page.evaluate(() => window.scrollTo(0, innerHeight * 1.4));
    await page.waitForFunction(() => document.body.dataset.mcta !== "on");
    assert.equal(await page.locator("[data-dock]").isVisible(), false);
    assert.equal(await page.locator(".chat-widget-root").isVisible(), false);
    const dismissAnnouncement = announcement.getByRole("button", {
      name: "Dismiss workshop announcement",
    });
    if (width === 1440 && theme === "dark") {
      await dismissAnnouncement.focus();
      await page.keyboard.press("Escape");
    } else await dismissAnnouncement.click();
    await announcement.waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(() => document.activeElement?.closest("header") !== null),
      true,
    );
    assert.equal(await page.evaluate(() => document.body.dataset.workshopPromotion), undefined);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2800);
    assert.equal(await announcement.count(), 0, "Dismissal lasts for this tab's session");
    if (width === 390) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    }
    const navigation = page.getByRole("navigation", {
      name: width === 390 ? "Mobile" : "Primary",
      exact: true,
    });
    const workshopLink = navigation.getByRole("link", { name: "Workshop", exact: true });
    assert.equal(await workshopLink.getAttribute("href"), `/events/${event.slug}`);
    await workshopLink.click();
    await page.waitForURL(`**/events/${event.slug}`);
    results.push({
      width,
      theme,
      homepageAnnouncement: true,
      liveCountdown: true,
      sessionDismissal: true,
      workshopMenu: true,
      noCompetingDocks: true,
    });
    await page.goto(`${base}/events/${event.slug}?utm_source=venue&utm_campaign=workshop`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("heading", { level: 1, name: event.headline }).waitFor();
    if (controlledTracking) {
      await page.locator("#gtag-init").waitFor({ state: "attached" });
      await page.locator("#meta-pixel").waitFor({ state: "attached" });
    }
    assert.equal(await page.locator("main").count(), 1, "Use the route's single main landmark");
    assert.match(await page.title(), /AI for Your Business/);
    const structured = await page.locator('script[type="application/ld+json"]').allTextContents();
    const listing = structured
      .map((text) => JSON.parse(text))
      .find((value) => value["@type"] === "Event");
    assert.equal(listing.offers.price, "50.00");
    assert.equal(listing.location.name, "Ferris & Co.");
    assert.equal(await page.getByRole("heading", { name: "John Connor", exact: true }).count(), 1);
    assert.equal(
      await page.getByRole("heading", { name: "Matthew Rolnick", exact: true }).count(),
      1,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    if (width === 390) {
      const checkout = await page
        .getByRole("complementary", { name: "Workshop tickets" })
        .boundingBox();
      const takeaways = await page
        .getByRole("heading", { name: "Leave knowing what to do first." })
        .boundingBox();
      assert.ok(checkout.y < takeaways.y, "Mobile ticket form must precede the long content");
    }
    const accessibility = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    assert.deepEqual(
      accessibility.violations.map((item) => ({ id: item.id, impact: item.impact })),
      [],
    );
    await page.locator("main").screenshot({ path: `${output}/public-${theme}-${width}.png` });
    // Hold the real entrance at an unreadable early frame. Interaction must
    // expose the form immediately instead of waiting for its entrance clock.
    if (reducedMotion === "no-preference")
      await page.getByLabel("Your name", { exact: true }).evaluate((input) => {
        const owner = input.closest(".ui-entrance");
        for (const animation of owner.getAnimations()) {
          const timing = animation.effect.getTiming();
          animation.pause();
          animation.currentTime = timing.delay + Number(timing.duration) * 0.05;
        }
      });
    await page.getByLabel("Your name", { exact: true }).fill("Workshop Buyer");
    assert.equal(
      await page
        .getByLabel("Your name", { exact: true })
        .evaluate((input) => getComputedStyle(input.closest(".ui-entrance")).opacity),
      "1",
      "Focused checkout must finish its entrance immediately",
    );
    await page
      .getByRole("complementary", { name: "Workshop tickets" })
      .getByLabel("Email address", { exact: true })
      .fill("buyer@workshop.example");
    await page.getByLabel("Number of tickets").selectOption("2");
    const buy = page.getByRole("button", { name: "Get 2 tickets ($100)" });
    await buy.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("alert").filter({ hasText: "Retry with the same details" }).waitFor();
    const errorAccessibility = await new AxeBuilder({ page })
      .include('[role="alert"]')
      .withRules(["color-contrast"])
      .analyze();
    assert.deepEqual(
      errorAccessibility.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
      [],
    );
    assert.equal(
      await page.getByLabel("Your name", { exact: true }).inputValue(),
      "Workshop Buyer",
    );
    await page.reload();
    await page.getByLabel("Your name", { exact: true }).fill("Workshop Buyer");
    await page
      .getByRole("complementary", { name: "Workshop tickets" })
      .getByLabel("Email address", { exact: true })
      .fill("buyer@workshop.example");
    await page.getByLabel("Number of tickets").selectOption("2");
    assert.equal(
      await page.evaluate(() => JSON.stringify(sessionStorage).includes("buyer@workshop.example")),
      false,
    );
    await buy.click();
    await page.getByRole("alert").filter({ hasText: "This reservation expired" }).waitFor();
    await buy.click();
    await page.waitForURL("https://checkout.stripe.com/**");
    assert.equal(purchases.length, 3);
    assert.deepEqual(purchases[0], purchases[1]);
    assert.notEqual(purchases[1].requestId, purchases[2].requestId);
    assert.deepEqual({ ...purchases[1], requestId: null }, { ...purchases[2], requestId: null });
    assert.equal(purchases[0].quantity, 2);
    assert.equal(purchases[0].attribution.utm_source, "venue");
    assert.equal("price_cents" in purchases[0], false);
    const initialReceipt = page.waitForResponse(
      (response) =>
        response.url().startsWith(`${api}?`) &&
        new URL(response.url()).searchParams.get("order") === orderId,
    );
    await page.goto(`${base}/events/${event.slug}/confirmation?order=${orderId}&key=${key}`);
    assert.equal((await (await initialReceipt).json()).state, "checkout");
    assert.equal(await page.locator("#gtag-init, #meta-pixel").count(), 0);
    assert.equal(await page.evaluate(() => typeof window.gtag), "undefined");
    assert.equal(await page.evaluate(() => typeof window.fbq), "undefined");
    await page.getByRole("button", { name: "Check payment status", exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "You’re registered." }).count(), 0);
    receiptState = "paid";
    await page.getByRole("button", { name: "Check payment status", exact: true }).click();
    await page.getByRole("heading", { name: "You’re registered." }).waitFor();
    await page
      .getByText("The confirmation email still needs attention.", { exact: false })
      .waitFor();
    const calendarDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Add the workshop to your calendar" }).click();
    const calendar = await readFile(await (await calendarDownload).path(), "utf8");
    assert.match(calendar, /BEGIN:VCALENDAR/);
    assert.match(calendar, /Ferris & Co/);
    await page.getByLabel("Company", { exact: true }).fill("Local Business");
    await page.getByLabel("What would you like to improve?").fill("Customer follow-up");
    await page.getByRole("button", { name: "Save my answers" }).click();
    await page.getByRole("alert").filter({ hasText: "Please retry" }).waitFor();
    assert.equal(await page.getByLabel("Company", { exact: true }).inputValue(), "Local Business");
    await page.getByRole("button", { name: "Save my answers" }).click();
    await page.getByRole("status").filter({ hasText: "Your answers are saved" }).waitFor();
    assert.deepEqual(contexts[0], contexts[1]);
    assert.equal(await page.locator("[data-dock]").count(), 0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.locator("main").screenshot({ path: `${output}/confirmation-${theme}-${width}.png` });
    receiptState = "refunded";
    await page.reload();
    await page.getByRole("heading", { name: "Your order has been refunded." }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Add the workshop to your calendar" }).count(),
      0,
    );
    receiptState = "paid";
    receiptTestMode = true;
    await page.reload();
    await page.getByRole("heading", { name: "Test registration complete." }).waitFor();
    await page.getByRole("status").filter({ hasText: "no live admission is confirmed" }).waitFor();
    await page.getByText("Test amount", { exact: true }).waitFor();
    assert.equal(await page.locator("main").count(), 1);
    receiptTestMode = false;
    await page.goto(`${base}/events/${event.slug}?utm_source=venue&utm_campaign=workshop`, {
      waitUntil: "networkidle",
    });
    await page.getByLabel("Your name", { exact: true }).fill("Workshop Buyer");
    await page
      .getByRole("complementary", { name: "Workshop tickets" })
      .getByLabel("Email address", { exact: true })
      .fill("buyer@workshop.example");
    await page.getByLabel("Number of tickets").selectOption("2");
    await page.evaluate(() => {
      window.__ticketOriginalDocument = true;
    });
    await page.getByRole("button", { name: "Get 2 tickets ($100)" }).click();
    await page.waitForURL(`**/confirmation?order=${orderId}&key=${key}`);
    await page.getByRole("heading", { name: "You’re registered." }).waitFor();
    assert.equal(await page.evaluate(() => window.__ticketOriginalDocument), undefined);
    assert.equal(await page.locator("#gtag-init, #meta-pixel").count(), 0);
    assert.equal(await page.evaluate(() => typeof window.gtag), "undefined");
    assert.equal(await page.evaluate(() => typeof window.fbq), "undefined");
    assert.deepEqual(errors, []);
    results.push({
      width,
      theme,
      reducedMotion,
      publicPage: true,
      privateDocument: true,
      trackingExcluded: true,
      keyboardCheckout: true,
      identicalRetry: true,
      pendingToConfirmed: true,
      paidDespiteEmailFailure: true,
      calendar: true,
      optionalContextRetry: true,
      refundedAdmission: true,
      accessibility: true,
    });
    await context.close();
  }
  const deadlineContext = await browser.newContext({
    viewport: { width: 320, height: 720 },
    reducedMotion: "reduce",
  });
  const deadlinePage = await deadlineContext.newPage();
  await deadlinePage.clock.install({ time: new Date(Date.parse(event.starts_at) - 60000) });
  await deadlinePage.goto(base, { waitUntil: "domcontentloaded" });
  const deadlineBanner = deadlinePage.getByRole("complementary", { name: "Upcoming workshop" });
  await deadlineBanner.waitFor({ state: "visible" });
  assert.equal(
    await deadlinePage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
  );
  await deadlinePage.screenshot({ path: `${output}/homepage-workshop-320.png` });
  await deadlinePage.clock.fastForward(61000);
  await deadlineBanner.waitFor({ state: "hidden" });
  assert.equal(
    await deadlinePage.evaluate(() => document.body.dataset.workshopPromotion),
    undefined,
  );
  await deadlineContext.close();
  results.push({ width: 320, countdownDeadline: true, noOverflow: true });
  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  await staticPage.goto(base, { waitUntil: "domcontentloaded" });
  const staticPromotion = staticPage.getByRole("region", { name: "Upcoming workshop" });
  await staticPromotion.getByRole("link", { name: /Workshop tickets/ }).waitFor();
  await staticContext.close();
  results.push({ homepageWithoutJavaScript: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/admin/**", (route) => {
      escaped.push(`admin ${route.request().method()}`);
      return route.abort();
    });
    const root = `${base}/demo/command-center/northline-roofing`;
    await page.goto(`${root}/today`);
    await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "northline-roofing");
    assert.equal(
      await page.evaluate(
        async () =>
          (
            await fetch("/api/admin/tenant/modules", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ moduleId: "event-ticketing", enabled: true }),
            })
          ).status,
      ),
      200,
    );
    await page.goto(`${root}/events`);
    await page.getByRole("heading", { level: 1, name: "Events", exact: true }).waitFor();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const editorHeading = page.getByRole("heading", { name: "Edit event", exact: true });
    await editorHeading.waitFor();
    assert.equal(
      await editorHeading.evaluate((element) => element === document.activeElement),
      true,
    );
    const editorBox = await editorHeading.boundingBox();
    assert.ok(editorBox.y >= 0 && editorBox.y < 300, "Edit reveals the form in the admin viewport");
    const originalEnd = await page.getByLabel("End", { exact: true }).inputValue();
    await page
      .getByLabel("End", { exact: true })
      .fill(await page.getByLabel("Start", { exact: true }).inputValue());
    await page.getByRole("button", { name: "Save event", exact: true }).click();
    const validationAlert = page
      .getByRole("alert")
      .filter({ hasText: "End time must follow start time" });
    await validationAlert.waitFor();
    assert.ok((await validationAlert.textContent()).startsWith("End time must follow start time"));
    await page.getByLabel("End", { exact: true }).fill(originalEnd);
    await page.getByLabel("Ticket price (USD)").fill("75.00");
    assert.equal(
      await page
        .getByLabel("Ticket price (USD)")
        .evaluate((element) => element === document.activeElement),
      true,
      "Typing keeps focus in the price field",
    );
    await page.getByRole("button", { name: "Save event", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Event saved" }).waitFor();
    const data = await page.evaluate(async () => (await fetch("/api/admin/events")).json());
    assert.equal(data.events[0].price_cents, 7500);
    assert.equal(data.orders[0].total_cents, 10000);
    assert.equal(data.events[0].paid_tickets, 0);
    assert.equal(data.events[0].gross_cents, 0);
    await page.getByRole("button", { name: "Retry confirmation", exact: true }).click();
    await page.getByText("Confirmation: sent", { exact: true }).waitFor();
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV", exact: true }).click();
    const csv = await readFile(await (await csvDownload).path(), "utf8");
    assert.match(csv, /Casey Example/);
    assert.ok(!csv.includes("request_id"));
    await page.getByLabel("Ticket price (USD)").fill("76.00");
    await page.evaluate(() => {
      const previous = window.fetch;
      window.fetch = async (input, init) => {
        if (String(input) === "/api/admin/events" && init?.method === "POST") {
          window.fetch = previous;
          return Response.json(
            { error: "Controlled save unavailable. Please retry." },
            { status: 503 },
          );
        }
        return previous(input, init);
      };
    });
    const save = page.getByRole("button", { name: "Save event", exact: true });
    await save.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("alert").filter({ hasText: "Controlled save unavailable" }).waitFor();
    assert.equal(await page.getByLabel("Ticket price (USD)").inputValue(), "76.00");
    await save.click();
    await page.getByRole("status").filter({ hasText: "Event saved" }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    await page.screenshot({ path: `${output}/admin-${width}.png`, fullPage: true });
    await page
      .getByLabel("Ticket price (USD)")
      .evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.screenshot({ path: `${output}/admin-price-${width}.png`, fullPage: true });
    const current = await page.evaluate(async () => (await fetch("/api/admin/events")).json());
    const command = {
      operation: "save_event",
      eventId: WORKSHOP_EVENT_ID,
      revision: current.events[0].revision,
      requestId: randomUUID(),
      event: { ...eventDefinitionSchema.strip().parse(current.events[0]), price_cents: 9000 },
    };
    const proposed = await page.evaluate(
      async (command) =>
        (
          await fetch("/api/admin/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "propose", command }),
          })
        ).json(),
      command,
    );
    assert.ok(proposed.action?.id, JSON.stringify(proposed));
    const unchanged = await page.evaluate(async () => (await fetch("/api/admin/events")).json());
    assert.equal(unchanged.events[0].price_cents, 7600);
    await page.goto(`${root}/work?tab=approvals&action=${proposed.action.id}`);
    const review = page.getByRole("dialog", { name: proposed.action.title, exact: true });
    const exact = review.getByRole("region", { name: "Exact event operation" });
    await exact.getByText("$90", { exact: true }).waitFor();
    await exact.getByText("$90", { exact: true }).scrollIntoViewIfNeeded();
    await exact.getByText("40 tickets", { exact: true }).waitFor();
    await page.keyboard.press("Tab");
    assert.equal(
      await review.evaluate((element) => element.contains(document.activeElement)),
      true,
    );
    await page.screenshot({ path: `${output}/approval-${width}.png`, fullPage: true });
    await review.getByRole("button", { name: "Approve", exact: true }).click();
    await review.waitFor({ state: "hidden" });
    await page.waitForURL(
      (url) => url.pathname === new URL(`${root}/work`).pathname && !url.searchParams.has("action"),
    );
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "northline-roofing");
    const approved = await page.evaluate(async () => (await fetch("/api/admin/events")).json());
    assert.equal(approved.events[0].price_cents, 9000);
    assert.equal(
      await page.evaluate(
        async (id) =>
          (
            await fetch("/api/admin/revenue-os/actions", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, decision: "approve" }),
            })
          ).status,
        proposed.action.id,
      ),
      409,
    );
    assert.deepEqual(errors, []);
    results.push({
      adminWidth: width,
      priceEditable: true,
      originalOrderPrice: true,
      simulatedRetry: true,
      export: true,
      errorRecovery: true,
    });
    await context.close();
  }
  const originalSlug = event.slug;
  event.slug = "controlled-workshop-renamed";
  const renamedContext = await browser.newContext();
  const renamedPage = await renamedContext.newPage();
  await renamedPage.goto(`${base}/events/${event.slug}`);
  assert.equal(
    await renamedPage
      .getByRole("navigation", { name: "Primary", exact: true })
      .getByRole("link", { name: "Workshop", exact: true })
      .getAttribute("href"),
    `/events/${event.slug}`,
  );
  await renamedPage.getByRole("heading", { level: 1, name: event.headline }).waitFor();
  await renamedContext.close();
  event.slug = originalSlug;
  results.push({ workshopMenuFollowsRenamedEvent: true });
  fixtureStatus = "paused";
  assert.match(
    await (await fetch(`${base}/events/${event.slug}`)).text(),
    /Ticket sales are paused/,
  );
  fixtureStatus = "draft";
  assert.equal((await fetch(`${base}/events/${event.slug}`)).status, 404);
  assert.equal((await fetch(`${base}/events/${event.slug}?preview=1`)).status, 404);
  assert.deepEqual(escaped, []);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        result: "passed",
        evidence:
          "Compiled Next pages against isolated read-only REST; browser-controlled payment responses; actual shared fictional admin. No live provider or production data.",
        marketingTracking: controlledTracking
          ? "Public SDKs active against controlled stubs; direct and already-paid confirmation documents exclude both SDKs."
          : "Private document exclusions verified without configured marketing SDKs.",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ result: "passed", output, scenarios: results.length }));
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(() => {
        if (server.exitCode === null) server.kill("SIGKILL");
        resolve();
      }, 5000).unref();
    });
  }
  await new Promise((resolve) => fixture.close(resolve));
  await writeFile(`${output}/server.log`, serverLog);
}
