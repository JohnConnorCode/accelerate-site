import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const outDir = "/tmp/accelerate-booking-mode";
mkdirSync(outDir, { recursive: true });
function setupPayload(bookingMode, calendlyStatus, calendlyDescription) {
  return {
    bookingMode,
    google: null,
    checks: [
      {
        id: "manual_booking",
        group: "booking",
        label:
          bookingMode === "embed"
            ? "Public scheduler embed"
            : bookingMode === "disabled"
              ? "Public booking paused"
              : "Manual scheduling mode",
        description: calendlyDescription,
        accomplishes: "Keeps calendar activation optional without blocking the revenue workflow.",
        status: bookingMode === "disabled" ? "disabled" : "ready",
        required: false,
        keys: ["tenant.capabilities.publicBooking", "CALENDLY_ENABLED"],
      },
      {
        id: "calendly",
        group: "booking",
        label: "Calendly attribution",
        description: calendlyDescription,
        accomplishes:
          "Adds booking and cancellation attribution without treating tokens as health.",
        status: calendlyStatus,
        required: false,
        keys: ["CALENDLY_WEBHOOK_SECRET"],
        lastSuccessAt:
          calendlyStatus === "ready" || calendlyStatus === "degraded"
            ? "2026-09-04T11:00:00.000Z"
            : null,
      },
    ],
    summary: {
      requiredReady: 1,
      requiredTotal: 1,
      optionalReady: calendlyStatus === "ready" ? 1 : 0,
      optionalTotal: 2,
      launchReady: true,
      percent: 100,
      degraded: calendlyStatus === "degraded" ? 1 : 0,
    },
  };
}

const visualStates = [
  {
    id: "enabled",
    bookingMode: "embed",
    calendlyStatus: "action",
    heading: "Public scheduler embed",
    copy: "not implied by the embed",
    calendlyDescription:
      "The public embed is on. Signed webhooks are still required before attribution can be Ready.",
  },
  {
    id: "disabled",
    bookingMode: "disabled",
    calendlyStatus: "disabled",
    heading: "Public booking paused",
    copy: "paused",
    calendlyDescription:
      "Public self-booking is paused. Attribution stays off until the embed is re-enabled.",
  },
  {
    id: "not-configured",
    bookingMode: "manual",
    calendlyStatus: "optional",
    heading: "Manual scheduling",
    copy: "No public embed",
    calendlyDescription:
      "The founder schedules by reply. Calendly API tokens are not required and are not treated as ready.",
  },
  {
    id: "degraded",
    bookingMode: "embed",
    calendlyStatus: "degraded",
    heading: "Public scheduler embed",
    copy: "not implied by the embed",
    calendlyDescription:
      "The latest signed booking or cancellation receipt is older than the freshness window.",
  },
  {
    id: "recovered",
    bookingMode: "embed",
    calendlyStatus: "ready",
    heading: "Public scheduler embed",
    copy: "not implied by the embed",
    calendlyDescription:
      "A fresh signed Calendly booking or cancellation receipt is on the ledger.",
  },
];
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [],
      escaped = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin || url.pathname.startsWith("/api/")) {
        escaped.push(url.origin + url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(base + "/demo/command-center/northline-roofing/setup");
    await page.getByRole("button", { name: "Refresh checks", exact: true }).waitFor();
    // Wait for the initial demo transport and Setup read to settle before
    // overriding the response; an in-flight initial load can overwrite fixtures.
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (button) => button.textContent?.includes("Refresh checks") && !button.disabled,
      ),
    );
    for (const state of visualStates) {
      // Controlled response exercises the shared Setup screen. Runtime state rules
      // are proved separately by test-booking-mode-contract.ts; no live API is mocked as proof.
      await page.evaluate(
        (payload) => {
          const original = window.fetch;
          window.fetch = async (input, init) => {
            const url = new URL(
              typeof input === "string" ? input : input instanceof Request ? input.url : input.href,
              location.origin,
            );
            return url.pathname === "/api/admin/setup"
              ? Response.json(payload)
              : original(input, init);
          };
        },
        setupPayload(state.bookingMode, state.calendlyStatus, state.calendlyDescription),
      );
      await page.getByRole("button", { name: "Refresh checks", exact: true }).click();
      await page.getByRole("heading", { name: state.heading, level: 2, exact: true }).waitFor();
      await page.getByText(state.calendlyDescription, { exact: true }).first().waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page
        .getByText(state.calendlyDescription, { exact: true })
        .last()
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${outDir}/${state.id}-${width}.png`, fullPage: true });
      results.push({ state: state.id, width, sharedScreen: true, controlledResponse: true });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(escaped, []);
    await context.close();
  }
  writeFileSync(
    `${outDir}/results.json`,
    JSON.stringify({ results, providerRequests: 0, protectedRequests: 0 }, null, 2),
  );
  console.log(
    "PASS: shared Setup desktop/mobile enabled, disabled, unconfigured, degraded and recovered fixtures without credentials or provider calls.",
  );
} finally {
  await browser.close();
}
