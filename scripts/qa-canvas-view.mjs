import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium, webkit } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3043";
const output = process.env.CANVAS_QA_OUTPUT || "/tmp/accelerate-canvas-view";
const demo = `${base}/demo/command-center/northline-roofing`;
// Frame budget for scripted pan and pinch over a 400-node Today canvas.
const BUDGET = { p95: 18, longest: 50, throttledP95: 34 };
await mkdir(output, { recursive: true });
const results = [];
const errors = [];

const ignoredConsole = (text) =>
  text.includes("was delivered in report-only mode") ||
  text.includes("Download the React DevTools");

function watch(page, label) {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !ignoredConsole(message.text()))
      errors.push(`${label}: ${message.text()}`);
  });
}

async function openCanvas(page, path) {
  await page.goto(`${demo}${path}`, { waitUntil: "networkidle" });
  await page.locator("[data-canvas-view][data-canvas-ready]").waitFor({ timeout: 20000 });
  return page.locator("[data-canvas-view]");
}

const transform = (page) =>
  page.locator(".react-flow__viewport").evaluate((element) => element.style.transform);
const zoomOf = async (page) => {
  const match = /scale\(([\d.]+)\)/.exec(await transform(page));
  return match ? Number(match[1]) : NaN;
};

async function sampleFrames(page, duration) {
  return page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const started = performance.now();
        let previous = started;
        const gaps = [];
        let longTasks = 0;
        const observer = PerformanceObserver.supportedEntryTypes.includes("longtask")
          ? new PerformanceObserver((list) => (longTasks += list.getEntries().length))
          : null;
        observer?.observe({ type: "longtask" });
        const sample = (now) => {
          gaps.push(now - previous);
          previous = now;
          if (now - started < ms) requestAnimationFrame(sample);
          else {
            observer?.disconnect();
            gaps.sort((a, b) => a - b);
            resolve({
              p95: gaps[Math.floor(gaps.length * 0.95)],
              longest: gaps.at(-1),
              count: gaps.length,
              longTasks,
            });
          }
        };
        requestAnimationFrame(sample);
      }),
    duration,
  );
}

async function scriptedGestures(page) {
  const box = await page.locator(".admin-canvas-flow").boundingBox();
  const x = box.x + box.width * 0.8;
  const y = box.y + box.height * 0.85;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 40; step++) {
    await page.mouse.move(x - step * 14, y - step * 10);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  // Control plus wheel is the pinch gesture; a plain wheel would scroll the page.
  await page.keyboard.down("Control");
  for (let step = 0; step < 12; step++) {
    await page.mouse.wheel(0, step < 6 ? -60 : 60);
    await page.waitForTimeout(30);
  }
  await page.keyboard.up("Control");
}

const browser = await chromium.launch();
try {
  // Responsive geometry at four widths.
  for (const width of [1440, 1100, 820, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });
    const page = await context.newPage();
    watch(page, `today-${width}`);
    const canvas = await openCanvas(page, "/today?view=canvas");
    const box = await canvas.boundingBox();
    assert(
      box.x >= 0 && box.x + box.width <= width + 1,
      `${width}: canvas stays inside the viewport`,
    );
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      `${width}: the page does not widen`,
    );
    assert(await page.getByRole("application", { name: "Today canvas" }).isVisible());
    assert(await page.getByRole("button", { name: "Zoom in" }).isVisible());
    const target = await page.getByRole("button", { name: "Zoom in" }).boundingBox();
    assert(target.height >= (width === 390 ? 44 : 40), `${width}: zoom target meets the floor`);
    const dock = await page.locator(".admin-mobile-dock").boundingBox();
    if (dock && (await page.locator(".admin-mobile-dock").isVisible()))
      assert(target.y + target.height <= dock.y, `${width}: zoom controls clear the mobile dock`);
    assert(await page.locator("[data-canvas-node]").count(), `${width}: openers are rendered`);
    await page.screenshot({ path: `${output}/today-canvas-${width}.png` });
    results.push({ check: "geometry", width, canvas: box });
    await context.close();
  }

  // Keyboard-only journey: enter the tree, traverse, open, Escape returns focus, zoom keys.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    watch(page, "keyboard");
    await openCanvas(page, "/today?view=canvas");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    const active = () =>
      page.evaluate(() => document.activeElement?.getAttribute("data-canvas-node"));
    for (let presses = 0; presses < 60 && !(await active()); presses++)
      await page.keyboard.press("Tab");
    assert(await active(), "Tab reaches the canvas tab stop");
    assert.equal(await active(), "today", "The tab stop starts at the anchor");
    assert.equal(
      await page.locator('[data-canvas-node][tabindex="0"]').count(),
      1,
      "Exactly one tab stop",
    );
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() =>
      document.activeElement?.getAttribute("data-canvas-node")?.startsWith("group:"),
    );
    const firstGroup = await active();
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(
      (id) => document.activeElement?.getAttribute("data-canvas-node") !== id,
      firstGroup,
    );
    await page.keyboard.press("ArrowUp");
    await page.waitForFunction(
      (id) => document.activeElement?.getAttribute("data-canvas-node") === id,
      firstGroup,
    );
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => {
      const id = document.activeElement?.getAttribute("data-canvas-node") || "";
      return id && id !== "today" && !id.startsWith("group:");
    });
    const card = await active();
    const before = await zoomOf(page);
    await page.keyboard.press("Enter");
    const dialog = page.locator('[data-admin-overlay="dialog"]');
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /Work context/);
    await page.screenshot({ path: `${output}/today-canvas-keyboard-open.png` });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await active(), card, "Escape returns focus to the opened node");
    await page.keyboard.press("+");
    await page.waitForTimeout(260);
    assert((await zoomOf(page)) > before, "+ zooms in");
    await page.keyboard.press("0");
    await page.waitForTimeout(260);
    results.push({ check: "keyboard", card });
    await context.close();
  }

  // Scope navigation and selection stay truthful across Back and Forward.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    watch(page, "history");
    await openCanvas(page, "/work?tab=approvals&view=canvas");
    const hub = page.locator('[data-canvas-node^="group:"]').first();
    const hubId = await hub.getAttribute("data-canvas-node");
    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("scope") === hubId),
      hub.click(),
    ]);
    assert(await page.locator('.admin-canvas-crumb--current[aria-current="location"]').isVisible());
    const cardNode = page.locator('[data-canvas-node^="approval:"]').first();
    const actionId = (await cardNode.getAttribute("data-canvas-node")).slice("approval:".length);
    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("action") === actionId),
      cardNode.click(),
    ]);
    await page.locator('[data-admin-overlay="dialog"]').waitFor();
    assert.equal(
      await page
        .locator(`[data-canvas-node="approval:${actionId}"]`)
        .evaluate((el) => el.getAttribute("aria-current")),
      "true",
      "The open record is marked current",
    );
    await page.screenshot({ path: `${output}/approvals-canvas-review.png` });
    await page.keyboard.press("Escape");
    await page.waitForURL((url) => !url.searchParams.has("action"));
    const url = new URL(page.url());
    assert.equal(url.searchParams.get("view"), "canvas", "Closing a review keeps the canvas");
    assert.equal(url.searchParams.get("scope"), hubId, "Closing a review keeps the scope");
    await page.goBack({ waitUntil: "networkidle" });
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForURL((current) => !current.searchParams.has("scope"));
    assert.equal(
      await page.locator(".admin-canvas-crumb--current").count(),
      0,
      "Back leaves the scope",
    );
    await page.goForward({ waitUntil: "networkidle" });
    await page.waitForURL((current) => current.searchParams.get("scope") === hubId);
    assert(
      await page.locator(".admin-canvas-crumb--current").isVisible(),
      "Forward restores the scope",
    );
    results.push({ check: "history", hubId, actionId });
    await context.close();
  }

  // Touch: tap opens without dragging, one finger pans, two fingers pinch.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    watch(page, "touch");
    await openCanvas(page, "/work?tab=approvals&view=canvas");
    const session = await context.newCDPSession(page);
    const touch = async (type, points) =>
      session.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map(([x, y], id) => ({ x, y, id })),
      });
    const hub = page.locator('[data-canvas-node^="group:"]').first();
    const hubId = await hub.getAttribute("data-canvas-node");
    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("scope") === hubId),
      hub.tap(),
    ]);
    await page.waitForTimeout(300);
    const box = await page.locator(".admin-canvas-flow").boundingBox();
    const start = [box.x + box.width / 2, box.y + box.height / 2];
    const panned = await transform(page);
    const url = page.url();
    await touch("touchStart", [start]);
    for (let step = 1; step <= 12; step++)
      await touch("touchMove", [[start[0] - step * 8, start[1] - step * 10]]);
    await touch("touchEnd", []);
    await page.waitForTimeout(200);
    assert.notEqual(await transform(page), panned, "One finger pans the canvas");
    assert.equal(page.url(), url, "A pan never opens a record");
    const zoomBefore = await zoomOf(page);
    await touch("touchStart", [
      [start[0] - 30, start[1]],
      [start[0] + 30, start[1]],
    ]);
    for (let step = 1; step <= 10; step++)
      await touch("touchMove", [
        [start[0] - 30 - step * 9, start[1]],
        [start[0] + 30 + step * 9, start[1]],
      ]);
    await touch("touchEnd", []);
    await page.waitForTimeout(200);
    assert((await zoomOf(page)) > zoomBefore, "Two fingers pinch to zoom");
    await page.screenshot({ path: `${output}/approvals-canvas-touch.png` });
    results.push({ check: "touch", hubId });
    await context.close();
  }

  // Reduced motion: programmatic viewport moves are instant.
  {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    watch(page, "reduced-motion");
    await openCanvas(page, "/today?view=canvas");
    const before = await zoomOf(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    const immediate = await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() =>
            resolve(document.querySelector(".react-flow__viewport").style.transform),
          ),
        ),
    );
    await page.waitForTimeout(300);
    assert.equal(immediate, await transform(page), "Zoom applies without animation");
    assert((await zoomOf(page)) > before);
    results.push({ check: "reduced-motion" });
    await context.close();
  }

  // Accessibility scan of the canvas region.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    watch(page, "axe");
    await openCanvas(page, "/today?view=canvas");
    const audit = await new AxeBuilder({ page }).include("[data-canvas-view]").analyze();
    await writeFile(`${output}/axe.json`, JSON.stringify(audit.violations, null, 2));
    assert.deepEqual(
      audit.violations.map((violation) => violation.id),
      [],
      "Canvas has no axe violations",
    );
    await context.close();
  }

  // 400 Today records within the frame budget, unthrottled and at 4x CPU throttle.
  for (const throttle of [1, 4]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    watch(page, `frames-${throttle}x`);
    await page.goto(`${demo}/today`, { waitUntil: "networkidle" });
    await page.locator('[data-today-module="brief"]').waitFor({ timeout: 20000 });
    await page.evaluate(() => {
      const original = window.fetch;
      const kinds = [
        ["decision", "approval"],
        ["work", "task"],
        ["watch", "conversation"],
        ["upcoming", "calendar_event"],
      ];
      window.fetch = async (input, init) => {
        const response = await original(input, init);
        const path = new URL(typeof input === "string" ? input : input.url, location.origin)
          .pathname;
        if (path !== "/api/admin/revenue-os/today") return response;
        const snapshot = await response.json();
        const now = Date.now();
        snapshot.attention = {
          state: "ready",
          data: Array.from({ length: 400 }, (_, index) => {
            const [attentionKind, sourceType] = kinds[index % 4];
            return {
              id: `${sourceType}:qa-${index}`,
              kind: sourceType,
              title: `Fixture record ${index + 1}`,
              summary: "Fictional record for the canvas frame budget.",
              urgency: index % 9 === 0 ? "high" : "normal",
              dueAt: new Date(now + index * 3_600_000).toISOString(),
              sourceTimestamp: new Date(now).toISOString(),
              priorityReason: "Generated to measure canvas performance.",
              recommendedNextAction: "Review",
              href: "/admin/work",
              sourceType,
              sourceId: `qa-${index}`,
              attentionKind,
            };
          }),
        };
        return Response.json(snapshot);
      };
    });
    await page.getByRole("button", { name: "Refresh Today" }).click();
    await page.waitForTimeout(800);
    await page
      .getByRole("group", { name: "Today layout" })
      .getByRole("button", { name: "Canvas" })
      .click();
    await page.locator("[data-canvas-view][data-canvas-ready]").waitFor({ timeout: 20000 });
    const showUpdates = page.getByRole("button", { name: "Show updates" });
    if (await showUpdates.isVisible()) await showUpdates.click();
    // Each attention group holds 100 of the 400 fixture records once the snapshot applies.
    await page.waitForFunction(() =>
      document.querySelector('[data-canvas-node="today"]')?.textContent?.includes("400 items"),
    );
    const rendered = await page.locator(".react-flow__node").count();
    if (throttle > 1) {
      const session = await context.newCDPSession(page);
      await session.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    }
    const [frames] = await Promise.all([sampleFrames(page, 1800), scriptedGestures(page)]);
    await page.screenshot({ path: `${output}/today-canvas-400-${throttle}x.png` });
    results.push({ check: "frames", throttle, rendered, ...frames });
    if (throttle === 1) {
      assert(frames.p95 <= BUDGET.p95, `p95 frame gap ${frames.p95}ms exceeds ${BUDGET.p95}ms`);
      assert(
        frames.longest <= BUDGET.longest,
        `Longest frame ${frames.longest}ms exceeds ${BUDGET.longest}ms`,
      );
    } else {
      assert(
        frames.p95 <= BUDGET.throttledP95,
        `Throttled p95 ${frames.p95}ms exceeds ${BUDGET.throttledP95}ms`,
      );
    }
    await context.close();
  }

  if (process.argv.includes("--webkit")) {
    const engine = await webkit.launch();
    const context = await engine.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    watch(page, "webkit");
    await openCanvas(page, "/today?view=canvas");
    const hub = page.locator('[data-canvas-node^="group:"]').first();
    const hubId = await hub.getAttribute("data-canvas-node");
    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("scope") === hubId),
      hub.tap(),
    ]);
    await page.screenshot({ path: `${output}/today-canvas-webkit.png` });
    results.push({ check: "webkit-tap", hubId });
    await engine.close();
  }

  assert.deepEqual(errors, [], `Console errors: ${errors.join(" | ")}`);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ result: "passed", output, results }, null, 2));
