import { WORKSHOP_EVENT, WORKSHOP_EVENT_ID, WORKSHOP_GUIDES } from "../src/content/workshops.ts";
import { eventDefinitionSchema } from "../src/lib/revenue-os/event-ticketing-contract.ts";
import { contrastRatio } from "../src/lib/revenue-os/branding-contract.ts";
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
const controlledClientSecret = "cs_test_controlled_secret_fixture%2Fopaque%3D";

// Model Stripe's documented Checkout SDK shape. The fixture never accepts
// card details or calls Stripe; server receipts remain independently controlled.
function controlledStripeSdk(expectedClientSecret) {
  const callbacks = new Map();
  const control = {
    mode: "decline",
    initializations: [],
    mounts: 0,
    autoReady: false,
    sessionStatus: "open",
    emit: (event, payload = {}) => callbacks.get(event)?.(payload),
  };
  window.__ticketStripe = control;
  const session = () => ({
    id: "cs_test_controlled",
    canConfirm: true,
    currency: "usd",
    email: "buyer@workshop.example",
    livemode: false,
    status:
      control.sessionStatus === "complete"
        ? { type: "complete", paymentStatus: "paid" }
        : { type: "open" },
    total: { total: { minorUnitsAmount: 10000, amount: "$100.00" } },
  });
  window.Stripe = (publishableKey) => ({
    initCheckout: (options) => {
      if (options.clientSecret !== expectedClientSecret)
        throw new Error("The opaque checkout secret must reach Stripe unchanged");
      control.initializations.push({ publishableKey, clientSecret: options.clientSecret });
      let mounted;
      const paymentElement = {
        on: (event, handler) => {
          callbacks.set(event, handler);
          return paymentElement;
        },
        mount: (target) => {
          const parent = typeof target === "string" ? document.querySelector(target) : target;
          if (!parent) throw new Error("Payment Element mount target is missing");
          mounted = document.createElement("div");
          mounted.setAttribute("role", "group");
          mounted.setAttribute("aria-label", "Controlled secure payment fields");
          mounted.style.cssText =
            "padding:24px;background:#fff;color:#222;border-radius:8px;min-height:120px";
          const input = document.createElement("input");
          input.setAttribute("aria-label", "Controlled payment method");
          input.value = "Controlled fixture, no card data";
          input.readOnly = true;
          input.style.cssText = "width:100%;color:#222;background:#fff";
          mounted.append(input);
          parent.append(mounted);
          control.mounts++;
          sessionStorage.setItem(
            "qa:ticket-mount-count",
            String(Number(sessionStorage.getItem("qa:ticket-mount-count") || "0") + 1),
          );
          if (control.autoReady) queueMicrotask(() => control.emit("ready"));
        },
        unmount: () => mounted?.remove(),
        destroy: () => mounted?.remove(),
      };
      return {
        on: (event, handler) => callbacks.set(`checkout:${event}`, handler),
        createPaymentElement: () => paymentElement,
        loadActions: async () => ({
          type: "success",
          actions: {
            getSession: session,
            confirm: async (input) => {
              control.lastConfirm = input;
              const count = Number(sessionStorage.getItem("qa:ticket-confirm-count") || "0") + 1;
              sessionStorage.setItem("qa:ticket-confirm-count", String(count));
              if (control.mode === "decline")
                return {
                  type: "error",
                  error: {
                    code: "paymentFailed",
                    message: "Your card was declined. Choose another payment method.",
                    paymentFailed: { declineCode: "generic_decline" },
                  },
                };
              if (control.mode === "unknown")
                throw new Error("Controlled connection lost after payment confirmation");
              if (control.mode === "unknown-result")
                return {
                  type: "error",
                  error: { code: null, message: "Payment result is unavailable" },
                };
              control.sessionStatus = "complete";
              return { type: "success", session: session() };
            },
          },
        }),
      };
    },
  });
}

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
  available_tickets: WORKSHOP_EVENT.capacity,
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
    const ticketCheckout = page.getByRole("complementary", {
      name: "Workshop tickets",
      exact: true,
    });
    const errors = [],
      purchases = [],
      contexts = [];
    let checkoutAttempts = 0,
      contextAttempts = 0,
      receiptState = "checkout",
      receiptTestMode = false,
      failStripeScript = true,
      plannedScriptFailures = 0;
    const paymentReads = [],
      privateTrackingRequests = [];
    const orderId = randomUUID(),
      key = randomUUID();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !(message.location().url.startsWith(api) && /\b(?:409|422|503)\b/.test(message.text())) &&
        !(
          plannedScriptFailures === 1 &&
          message.location().url === "https://js.stripe.com/clover/stripe.js" &&
          /\b503\b/.test(message.text())
        )
      )
        errors.push(message.text());
    });
    await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
    await page.addInitScript(
      ({ id, startsAt }) =>
        sessionStorage.setItem(`accelerate:workshop-announcement:${id}`, startsAt),
      { id: event.id, startsAt: event.starts_at },
    );
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname !== "/api/analytics/events" &&
        !/googletagmanager|google-analytics|connect\.facebook|facebook\.com/.test(url.hostname)
      )
        return;
      const path = new URL(request.frame().url() || base).pathname;
      if (/\/(checkout|confirmation)$/.test(path))
        privateTrackingRequests.push(url.origin + url.pathname);
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === "https://js.stripe.com" && url.pathname === "/clover/stripe.js") {
        if (failStripeScript) {
          failStripeScript = false;
          plannedScriptFailures++;
          return route.fulfill({
            status: 503,
            contentType: "application/javascript",
            body: "/* Controlled Stripe CDN failure. */",
          });
        }
        return route.fulfill({
          contentType: "application/javascript",
          body: `(${controlledStripeSdk.toString()})(${JSON.stringify(controlledClientSecret)});`,
        });
      }
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
                json: {
                  error:
                    "Checkout could not be started. Your admission is not confirmed. Retry with the same details; if payment already succeeded, use your confirmation link.",
                },
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
                ? {
                    json: {
                      url: `${base}/events/${event.slug}/checkout?order=${orderId}&key=${key}`,
                      orderId,
                    },
                  }
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
      const params = new URL(request.url()).searchParams;
      if (params.has("order")) {
        assert.equal(params.get("order"), orderId);
        assert.equal(params.get("key"), key);
        if (params.get("payment") === "1") paymentReads.push({ state: receiptState });
        return route.fulfill({
          json: {
            reference: orderId,
            quantity: 2,
            totalCents: 10000,
            state: receiptState,
            event,
            emailStatus: "attention",
            testMode: receiptTestMode,
            ...(params.get("payment") === "1"
              ? {
                  clientSecret: receiptState === "checkout" ? controlledClientSecret : null,
                  publishableKey: "pk_test_controlledworkshopfixture",
                  buyerName: "Workshop Buyer",
                  buyerEmail: "buyer@workshop.example",
                }
              : {}),
          },
        });
      }
      return route.continue();
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    const announcement = page.getByRole("complementary", { name: "Upcoming workshop" });
    await page.waitForLoadState("networkidle");
    assert.equal(
      await announcement.isVisible(),
      false,
      "The announcement must not cover the first screen and its primary call to action",
    );
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: "instant" }));
    await announcement.waitFor({ state: "visible" });
    assert.equal(await announcement.getByRole("heading").innerText(), event.headline);
    const ticketCta = announcement.getByRole("link", { name: "View workshop · $50" });
    assert.equal(await ticketCta.getAttribute("href"), `/events/${event.slug}`);
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
      await page.waitForURL(`**/events/${event.slug}`);
      await page.waitForFunction(() => {
        const box = document.getElementById("workshop-heading")?.getBoundingClientRect();
        return location.hash === "" && box && box.top >= 0 && box.top < innerHeight;
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
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: "instant" }));
    await announcement.waitFor({ state: "visible" });
    assert.equal(await announcement.count(), 1, "Every homepage reload shows the announcement");
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
      reloadReopensAnnouncement: true,
      legacyDismissalDoesNotSuppressAnnouncement: true,
      workshopMenu: true,
      noCompetingDocks: true,
    });
    await page.goto(`${base}/events/${event.slug}?utm_source=venue&utm_campaign=workshop`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("heading", { level: 1, name: event.headline }).waitFor();
    if (width === 1440 && theme === "light") {
      await page.locator("header a").first().click();
      await page.waitForURL(base + "/");
      await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: "instant" }));
      await announcement.waitFor({ state: "visible" });
      await announcement.getByRole("button", { name: "Dismiss workshop announcement" }).click();
      await announcement.waitFor({ state: "hidden" });
      await page
        .getByRole("navigation", { name: "Primary", exact: true })
        .getByRole("link", { name: "Workshop", exact: true })
        .click();
      await page.waitForURL(`**/events/${event.slug}`);
      await page.locator("header a").first().click();
      await page.waitForURL(base + "/");
      await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: "instant" }));
      await announcement.waitFor({ state: "visible" });
      results.push({ returningHomeReopensAnnouncement: true });
      await page.goto(`${base}/events/${event.slug}?utm_source=venue&utm_campaign=workshop`, {
        waitUntil: "networkidle",
      });
    }
    if (controlledTracking) {
      await page.locator("#gtag-init").waitFor({ state: "attached" });
      await page.locator("#meta-pixel").waitFor({ state: "attached" });
    }
    assert.equal(await page.locator("main").count(), 1, "Use the route's single main landmark");
    assert.match(await page.title(), /Feel More Confident Using AI/);
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
      const checkout = await ticketCheckout.boundingBox();
      const takeaways = await page
        .getByRole("heading", { name: "Practical skills you can use at work." })
        .boundingBox();
      assert.ok(
        checkout.y > takeaways.y,
        "Mobile visitors get learning context before the ticket form",
      );
    }
    await page.locator('[data-motion-role="public-hero"]').evaluate(async (hero) => {
      await Promise.allSettled(
        hero
          .getAnimations({ subtree: true })
          .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
          .map((animation) => animation.finished),
      );
    });
    await page.screenshot({ path: `${output}/public-hero-${theme}-${width}.png` });
    for (const id of ["comfortable", "takeaways", "practice", "small-group", "presenters"]) {
      await page
        .locator(`#${id}`)
        .evaluate((heading) => heading.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForFunction((id) => {
        const owner = document.getElementById(id)?.closest(".ui-entrance");
        return owner && getComputedStyle(owner).opacity === "1";
      }, id);
    }
    const resources = page.getByRole("region", { name: "Try something useful today." });
    for (const slug of WORKSHOP_GUIDES) {
      assert.equal(await resources.locator(`a[href="/learn/${slug}"]`).count(), 1);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const accessibility = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    assert.deepEqual(
      accessibility.violations.map((item) => ({ id: item.id, impact: item.impact })),
      [],
    );
    // Hold the real entrance at an unreadable early frame. Interaction must
    // expose the form immediately instead of waiting for its entrance clock.
    if (reducedMotion === "no-preference")
      await ticketCheckout.getByLabel("Your name", { exact: true }).evaluate((input) => {
        const owner = input.closest(".ui-entrance");
        for (const animation of owner.getAnimations()) {
          const timing = animation.effect.getTiming();
          animation.pause();
          animation.currentTime = timing.delay + Number(timing.duration) * 0.05;
        }
      });
    await ticketCheckout.getByLabel("Your name", { exact: true }).fill("Workshop Buyer");
    assert.equal(
      await ticketCheckout
        .getByLabel("Your name", { exact: true })
        .evaluate((input) => getComputedStyle(input.closest(".ui-entrance")).opacity),
      "1",
      "Focused checkout must finish its entrance immediately",
    );
    // Capture the form after its real interaction handoff, keeping the early-frame
    // recovery assertion above intact instead of photographing a deferred reveal.
    await page.locator("main").screenshot({ path: `${output}/public-${theme}-${width}.png` });
    await ticketCheckout
      .getByLabel("Email address", { exact: true })
      .fill("buyer@workshop.example");
    await ticketCheckout.getByLabel("Number of tickets").selectOption("2");
    // A failed checkout must remain usable on short laptops and small phones,
    // including when the sticky card grows to contain its recovery message.
    await page.setViewportSize(
      width === 1440 ? { width: 1440, height: 720 } : { width: 320, height: 568 },
    );
    const buy = ticketCheckout.getByRole("button", { name: "Get 2 tickets ($100)" });
    await buy.focus();
    await page.keyboard.press("Enter");
    const checkoutAlert = ticketCheckout.getByRole("alert");
    await checkoutAlert.filter({ hasText: "Retry with the same details" }).waitFor();
    await page.waitForFunction(() =>
      document.activeElement?.matches('aside[aria-label="Workshop tickets"] [role="alert"]'),
    );
    const errorLayout = await checkoutAlert.evaluate((alert) => {
      const card = alert.closest("aside");
      const cardBox = card.getBoundingClientRect();
      const alertBox = alert.getBoundingClientRect();
      return {
        pageFits: document.documentElement.scrollWidth <= innerWidth,
        cardFits: card.scrollWidth <= card.clientWidth,
        alertFits: alertBox.left >= cardBox.left && alertBox.right <= cardBox.right,
        alertVisible: alertBox.top >= 0 && alertBox.bottom <= innerHeight,
        stickyFits: innerWidth <= 800 || cardBox.height <= innerHeight - 112 + 1,
      };
    });
    assert.deepEqual(errorLayout, {
      pageFits: true,
      cardFits: true,
      alertFits: true,
      alertVisible: true,
      stickyFits: true,
    });
    await page.keyboard.press("Tab");
    assert.equal(await buy.evaluate((button) => document.activeElement === button), true);
    await ticketCheckout.screenshot({
      path: `${output}/checkout-error-${theme}-${width}.png`,
    });
    const errorAccessibility = await new AxeBuilder({ page })
      .include('aside[aria-label="Workshop tickets"] [role="alert"]')
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
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    assert.equal(
      await ticketCheckout.getByLabel("Your name", { exact: true }).inputValue(),
      "Workshop Buyer",
    );
    await page.reload();
    await ticketCheckout.getByLabel("Your name", { exact: true }).fill("Workshop Buyer");
    await ticketCheckout
      .getByLabel("Email address", { exact: true })
      .fill("buyer@workshop.example");
    await ticketCheckout.getByLabel("Number of tickets").selectOption("2");
    assert.equal(
      await page.evaluate(() => JSON.stringify(sessionStorage).includes("buyer@workshop.example")),
      false,
    );
    await buy.click();
    await checkoutAlert.filter({ hasText: "This reservation expired" }).waitFor();
    await page.evaluate(() => {
      window.__ticketPublicDocument = true;
    });
    await buy.click();
    await page.waitForURL(`${base}/events/${event.slug}/checkout?order=${orderId}&key=${key}`);
    assert.equal(new URL(page.url()).origin, base, "Payment stays on the workshop origin");
    assert.equal(
      await page.evaluate(() => window.__ticketPublicDocument),
      undefined,
      "Private payment starts a fresh document",
    );
    assert.equal(purchases.length, 3);
    assert.deepEqual(purchases[0], purchases[1]);
    assert.notEqual(purchases[1].requestId, purchases[2].requestId);
    assert.deepEqual({ ...purchases[1], requestId: null }, { ...purchases[2], requestId: null });
    assert.equal(purchases[0].quantity, 2);
    assert.equal(purchases[0].attribution.utm_source, "venue");
    assert.equal("price_cents" in purchases[0], false);
    const paymentUrl = `${base}/events/${event.slug}/checkout?order=${orderId}&key=${key}`;
    const confirmationUrl = `${base}/events/${event.slug}/confirmation?order=${orderId}&key=${key}`;
    await page
      .getByRole("heading", { level: 1, name: "Complete your registration.", exact: true })
      .waitFor();
    const paymentForm = page.getByRole("form", { name: "Workshop payment", exact: true });
    const pay = paymentForm.getByRole("button", { name: /^Pay / });
    const waitForPay = (disabled = false) =>
      page.waitForFunction((expected) => {
        const button = document.querySelector(
          'form[aria-label="Workshop payment"] button[type="submit"]',
        );
        return button && button.disabled === expected;
      }, disabled);
    const privateDocument = async () => {
      assert.equal(await page.locator("#gtag-init, #meta-pixel").count(), 0);
      assert.equal(await page.evaluate(() => typeof window.gtag), "undefined");
      assert.equal(await page.evaluate(() => typeof window.fbq), "undefined");
      const referrers = await page
        .locator('meta[name="referrer"]')
        .evaluateAll((tags) => tags.map((tag) => tag.getAttribute("content")));
      assert.ok(referrers.length > 0, "Private payment documents need a referrer policy");
      for (const referrer of referrers) assert.equal(referrer, "no-referrer");
      const robots = await page
        .locator('meta[name="robots"]')
        .evaluateAll((tags) => tags.map((tag) => tag.getAttribute("content")));
      assert.ok(robots.length > 0, "Private payment documents need crawler exclusions");
      for (const directives of robots) {
        assert.match(directives ?? "", /\bnoindex\b/i);
        assert.match(directives ?? "", /\bnofollow\b/i);
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
    };
    await paymentForm.getByRole("alert").filter({ hasText: "Stripe could not load" }).waitFor();
    assert.equal(await pay.isDisabled(), true);
    assert.equal(plannedScriptFailures, 1);
    await privateDocument();
    const recoveredSdk = page.waitForResponse(
      (response) =>
        response.url() === "https://js.stripe.com/clover/stripe.js" && response.status() === 200,
    );
    await page.evaluate(() => {
      window.__ticketCdnFailureDocument = true;
    });
    await paymentForm
      .getByRole("button", { name: "Reload secure payment fields", exact: true })
      .click();
    await recoveredSdk;
    await page.waitForFunction(() => window.__ticketStripe?.mounts > 0);
    assert.equal(page.url(), paymentUrl, "CDN recovery keeps the original order URL");
    assert.equal(
      await page.evaluate(() => window.__ticketCdnFailureDocument),
      undefined,
      "A failed SDK download requires a fresh document",
    );
    assert.equal(purchases.length, 3, "SDK recovery must not start another purchase");
    await privateDocument();
    assert.equal(await pay.isDisabled(), true, "Loading fields must not permit payment");
    await page.getByRole("status").filter({ hasText: "Loading secure payment fields" }).waitFor();
    assert.equal(
      await page.evaluate(() => window.__ticketStripe.initializations[0].publishableKey),
      "pk_test_controlledworkshopfixture",
    );
    assert.equal(
      await page.evaluate(() => window.__ticketStripe.initializations[0].clientSecret),
      controlledClientSecret,
    );
    assert.ok(paymentReads.length >= 2, "Failed SDK reload reads the same order again");
    const paymentReadsBeforeReload = paymentReads.length;
    // Reload reads the same private order; it never starts a new reservation.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__ticketStripe?.mounts > 0);
    await privateDocument();
    assert.equal(purchases.length, 3);
    assert.ok(paymentReads.length > paymentReadsBeforeReload);
    await page.evaluate(() =>
      window.__ticketStripe.emit("loaderror", { error: { message: "Controlled field failure" } }),
    );
    await paymentForm
      .getByRole("alert")
      .filter({ hasText: "Secure payment fields could not load" })
      .waitFor();
    assert.equal(await pay.isDisabled(), true);
    const oldMounts = await page.evaluate(() => window.__ticketStripe.mounts);
    const reloadedFields = page.waitForResponse(
      (response) =>
        response.url().startsWith(`${api}?`) &&
        new URL(response.url()).searchParams.get("payment") === "1",
    );
    await page.evaluate(() => {
      window.__ticketStripe.autoReady = true;
    });
    await paymentForm
      .getByRole("button", { name: "Reload secure payment fields", exact: true })
      .click();
    await reloadedFields;
    await page.waitForFunction((before) => window.__ticketStripe.mounts > before, oldMounts);
    await page.evaluate(() => window.__ticketStripe.emit("ready"));
    await page.waitForFunction(
      () =>
        !document.querySelector('form[aria-label="Workshop payment"] button[type="submit"]')
          ?.disabled,
    );
    await page.evaluate(() =>
      window.__ticketStripe.emit("checkout:change", {
        currency: "usd",
        canConfirm: false,
        total: { total: { minorUnitsAmount: 10000, amount: "$100.00" } },
      }),
    );
    await waitForPay(true);
    assert.equal(await pay.isDisabled(), true, "The SDK can withhold payment readiness");
    await page.evaluate(() =>
      window.__ticketStripe.emit("checkout:change", {
        currency: "usd",
        canConfirm: true,
        total: { total: { minorUnitsAmount: 10000, amount: "$100.00" } },
      }),
    );
    await waitForPay();
    const paymentAccessibility = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      paymentAccessibility.violations.map(({ id, impact }) => ({ id, impact })),
      [],
      "The internal payment page is accessible",
    );
    await page.locator("main").screenshot({ path: `${output}/payment-${theme}-${width}.png` });
    await pay.focus();
    await page.keyboard.press("Enter");
    await paymentForm.getByRole("alert").filter({ hasText: "Your card was declined" }).waitFor();
    assert.equal(await pay.isEnabled(), true, "A known decline permits a same-session retry");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("qa:ticket-confirm-count")), "1");
    assert.equal(new URL(page.url()).pathname, `/events/${event.slug}/checkout`);
    await page.evaluate(() => window.__ticketStripe.emit("change"));
    await paymentForm.getByRole("alert").waitFor({ state: "detached" });
    await page.evaluate(
      (mode) => {
        window.__ticketStripe.mode = mode;
      },
      theme === "light" ? "unknown" : "unknown-result",
    );
    await pay.click();
    await paymentForm
      .getByRole("alert")
      .filter({ hasText: "Check this order before paying again" })
      .waitFor();
    assert.equal(await pay.count(), 0, "An uncertain result removes repeat payment");
    const checkPayment = paymentForm.getByRole("link", { name: "Check this payment", exact: true });
    assert.equal(
      await checkPayment.getAttribute("href"),
      `/events/${event.slug}/confirmation?order=${orderId}&key=${key}`,
    );
    // Even an explicit native submit must not bypass the unknown-outcome guard.
    await paymentForm.evaluate((form) => form.requestSubmit());
    assert.equal(await page.evaluate(() => sessionStorage.getItem("qa:ticket-confirm-count")), "2");
    await checkPayment.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(confirmationUrl);
    await page.getByRole("button", { name: "Check payment status", exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "You’re registered." }).count(), 0);
    await privateDocument();
    const mountsBeforeUnknownRevisit = await page.evaluate(() =>
      sessionStorage.getItem("qa:ticket-mount-count"),
    );
    const readsBeforeUnknownRevisit = paymentReads.length;
    await page.goto(paymentUrl, { waitUntil: "domcontentloaded" });
    await page.waitForURL(confirmationUrl);
    await page.getByRole("button", { name: "Check payment status", exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("qa:ticket-confirm-count")),
      "2",
      "Revisiting an uncertain payment must not confirm again",
    );
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("qa:ticket-mount-count")),
      mountsBeforeUnknownRevisit,
      "Revisiting an uncertain payment must not mount new payment fields",
    );
    assert.equal(
      paymentReads.length,
      readsBeforeUnknownRevisit,
      "Uncertain recovery must use the confirmation status read",
    );
    await privateDocument();
    // Fixture boundary: model a separate clean client for the success scenario.
    // Clear only this fictional order's marker after proving reload protection;
    // production has no marker-clearing control. The fixture server is still open.
    await page.evaluate(
      (id) => sessionStorage.removeItem(`ticket-payment-uncertain:${id}`),
      orderId,
    );
    await page.goto(paymentUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__ticketStripe?.mounts > 0);
    await page.evaluate(() => {
      window.__ticketStripe.mode = "success";
      window.__ticketStripe.emit("ready");
    });
    await waitForPay();
    await pay.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(confirmationUrl);
    await page.getByRole("button", { name: "Check payment status", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem("qa:ticket-confirm-count")), "3");
    assert.equal(
      await page.getByRole("heading", { name: "You’re registered." }).count(),
      0,
      "SDK success alone cannot confirm admission",
    );
    await privateDocument();
    receiptState = "paid";
    await page.getByRole("button", { name: "Check payment status", exact: true }).click();
    await page.getByRole("heading", { name: "You’re registered." }).waitFor();
    await page
      .getByText("The confirmation email still needs attention.", { exact: false })
      .waitFor();
    const confirmationAccessibility = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      confirmationAccessibility.violations.map((item) => ({ id: item.id, impact: item.impact })),
      [],
      "Paid confirmation details must remain readable in each theme",
    );
    const receiptColors = await page.locator("main dl dt, main dl dd").evaluateAll((fields) =>
      fields.map((field) => {
        let surface = field;
        while (
          surface.parentElement &&
          getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)"
        )
          surface = surface.parentElement;
        const hex = (color) =>
          "#" +
          color
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map((channel) => Number(channel).toString(16).padStart(2, "0"))
            .join("");
        return {
          foreground: hex(getComputedStyle(field).color),
          background: hex(getComputedStyle(surface).backgroundColor),
        };
      }),
    );
    assert.ok(receiptColors.length > 0, "The confirmation must show its event and order details");
    for (const colors of receiptColors)
      assert.ok(
        contrastRatio(colors.foreground, colors.background) >= 4.5,
        `Paid confirmation text must meet 4.5:1 contrast: ${JSON.stringify(colors)}`,
      );
    const calendarDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Add the workshop to your calendar" }).click();
    const calendar = await readFile(await (await calendarDownload).path(), "utf8");
    assert.match(calendar, /BEGIN:VCALENDAR/);
    assert.match(calendar, /Ferris & Co/);
    await page.getByLabel("Company", { exact: true }).fill("Local Business");
    await page.getByLabel("What would you like to improve?").fill("Customer follow-up");
    await page.getByRole("button", { name: "Save my answers" }).click();
    await page.getByRole("main").getByRole("alert").filter({ hasText: "Please retry" }).waitFor();
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
    await ticketCheckout.getByLabel("Your name", { exact: true }).fill("Workshop Buyer");
    await ticketCheckout
      .getByLabel("Email address", { exact: true })
      .fill("buyer@workshop.example");
    await ticketCheckout.getByLabel("Number of tickets").selectOption("2");
    await page.evaluate(() => {
      window.__ticketOriginalDocument = true;
    });
    await buy.click();
    await page.waitForURL(`**/confirmation?order=${orderId}&key=${key}`);
    await page.getByRole("heading", { name: "You’re registered." }).waitFor();
    assert.equal(await page.evaluate(() => window.__ticketOriginalDocument), undefined);
    assert.equal(await page.locator("#gtag-init, #meta-pixel").count(), 0);
    assert.equal(await page.evaluate(() => typeof window.gtag), "undefined");
    assert.equal(await page.evaluate(() => typeof window.fbq), "undefined");
    if (theme === "light") {
      const scopedTenant = "controlled-business";
      const scopedApi = `${base}/api/public/${scopedTenant}/events/${event.slug}`;
      const scopedRoot = `${base}/t/${scopedTenant}/events/${event.slug}`;
      let scopedPaid = false;
      const scopedReads = [];
      await page.route(`${scopedApi}**`, (route) => {
        assert.equal(
          route.request().method(),
          "GET",
          "Private tenant payment only reads its existing order",
        );
        const params = new URL(route.request().url()).searchParams;
        assert.equal(params.get("order"), orderId);
        assert.equal(params.get("key"), key);
        scopedReads.push(route.request().url());
        return route.fulfill({
          json: {
            reference: orderId,
            quantity: 2,
            totalCents: 10000,
            state: scopedPaid ? "paid" : "checkout",
            event,
            emailStatus: "attention",
            testMode: false,
            ...(params.get("payment") === "1"
              ? {
                  clientSecret: controlledClientSecret,
                  publishableKey: "pk_test_controlledworkshopfixture",
                  buyerName: "Workshop Buyer",
                  buyerEmail: "buyer@workshop.example",
                }
              : {}),
          },
        });
      });
      await page.goto(`${scopedRoot}/checkout?order=${orderId}&key=${key}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForFunction(() => window.__ticketStripe?.mounts > 0);
      assert.equal(
        await page
          .getByRole("link", { name: "Back to workshop", exact: true })
          .getAttribute("href"),
        `/t/${scopedTenant}/events/${event.slug}`,
      );
      await privateDocument();
      await page.evaluate(() => {
        window.__ticketStripe.mode = "success";
        window.__ticketStripe.emit("ready");
      });
      await waitForPay();
      scopedPaid = true;
      await pay.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(`${scopedRoot}/confirmation?order=${orderId}&key=${key}`);
      await page.getByRole("heading", { name: "You’re registered.", exact: true }).waitFor();
      await privateDocument();
      assert.ok(scopedReads.some((href) => new URL(href).searchParams.get("payment") === "1"));
      results.push({
        width,
        tenantScopedPrivatePayment: true,
        tenantScopedConfirmation: true,
        controlledReceipt: true,
      });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(
      privateTrackingRequests,
      [],
      "No marketing collector request from private payment documents",
    );
    results.push({
      width,
      theme,
      reducedMotion,
      publicPage: true,
      privateDocument: true,
      sameOriginPayment: true,
      stripeLoadingAndReload: true,
      stripeCdnFailureReloadSameOrder: true,
      paymentAccessibility: true,
      stripeKnownDeclineRetry: true,
      unknownPaymentBlocksRepeat: theme === "light" ? "thrown" : "unclassified-result",
      sdkSuccessRequiresServerReceipt: true,
      trackingExcluded: true,
      keyboardCheckout: true,
      identicalRetry: true,
      containedCheckoutError: true,
      focusedRecovery: true,
      pendingToConfirmed: true,
      confirmationAccessibility: true,
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
  await deadlinePage.evaluate(() =>
    window.scrollTo({ top: window.innerHeight, behavior: "instant" }),
  );
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
  await staticPromotion.getByRole("link", { name: /View workshop/ }).waitFor();
  await staticContext.close();
  results.push({ homepageWithoutJavaScript: true });
  for (const [width, theme] of [
    [1440, "light"],
    [390, "light"],
    [1440, "dark"],
    [390, "dark"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const slug of WORKSHOP_GUIDES) {
      await page.goto(`${base}/events/${event.slug}`);
      await page
        .getByRole("region", { name: "Try something useful today." })
        .locator(`a[href="/learn/${slug}"]`)
        .click();
      await page.waitForURL(`${base}/learn/${slug}`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
        `${slug} fits the ${width}px viewport`,
      );
      const workshopLink = page.getByRole("link", {
        name: /^(See the workshop details|Explore the workshop|View the workshop)$/,
      });
      assert.equal(await workshopLink.getAttribute("href"), `/events/${event.slug}`);
      await workshopLink.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      const accessibility = await new AxeBuilder({ page })
        .include(".cta-band")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      assert.deepEqual(
        accessibility.violations.map(({ id, impact }) => ({ id, impact })),
        [],
      );
      await workshopLink.focus();
      await page
        .locator(".cta-band")
        .screenshot({ path: `${output}/guide-cta-${slug}-${theme}-${width}.png` });
      await page.screenshot({
        path: `${output}/guide-${slug}-${theme}-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Enter");
      await page.waitForURL(`${base}/events/${event.slug}`);
      assert.equal(new URL(page.url()).hash, "");
      const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
      assert.ok(heading && heading.y >= 0 && heading.y < 600);
      results.push({
        width,
        theme,
        guide: slug,
        linkedFromWorkshop: true,
        returnsToOverview: true,
        keyboard: true,
        accessibleCallToAction: true,
      });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
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
    await exact.getByText(`${command.event.capacity} tickets`, { exact: true }).waitFor();
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
          ? "Public marketing SDKs active against controlled stubs; internal payment, pending/paid confirmation and already-paid documents exclude both marketing SDKs."
          : "Internal payment and confirmation document exclusions verified without configured marketing SDKs.",
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
