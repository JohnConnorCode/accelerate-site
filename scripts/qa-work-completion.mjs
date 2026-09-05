import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// Fixtures are emitted by the real settlement service in test:work-completion.
const entries = JSON.parse(await readFile("/tmp/accelerate-work-completion-fixtures.json", "utf8"));
const output = "/tmp/accelerate-work-completion";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 1100 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (/\/api\/(admin|cron|webhooks|chat)/.test(new URL(request.url()).pathname))
        errors.push("Protected request escaped demo runtime");
    });
    await page.addInitScript((rows) => {
      const wrap = (original) => async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input.url, location.origin);
        if (url.pathname === "/api/admin/activity") {
          const filtered = rows.filter(
            (row) =>
              !url.searchParams.get("action") || row.action === url.searchParams.get("action"),
          );
          return new Response(
            JSON.stringify({
              entries: filtered,
              filterOptions: {
                actors: ["system"],
                entityTypes: ["work_item"],
                actions: rows.map((row) => row.action),
                sources: ["automation"],
              },
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        return original(input, init);
      };
      let fetchValue = wrap(window.fetch.bind(window));
      Object.defineProperty(window, "fetch", {
        configurable: true,
        get: () => fetchValue,
        set: (value) => {
          fetchValue = wrap(value);
        },
      });
    }, entries);
    await page.goto(
      `${process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117"}/demo/command-center/northline-roofing/activity`,
      { waitUntil: "domcontentloaded", timeout: 120_000 },
    );
    for (const status of ["completed", "deferred", "partial", "failed", "skipped"]) {
      await page.getByRole("heading", { name: `work_item · ${status}`, exact: true }).waitFor();
    }
    assert.match(await page.locator("main").innerText(), /Connect Google/);
    assert.match(await page.locator("main").innerText(), /action:artifact-1/);
    await page.getByLabel("Action").focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.getByLabel("Source").evaluate((node) => node === document.activeElement),
      true,
    );
    await page.getByLabel("Action").selectOption("work_item.deferred");
    await page.waitForFunction(() => document.querySelectorAll("article").length === 1);
    assert.match(await page.locator("article").innerText(), /Connect Google/);
    await page.locator("article").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${label}-deferred.png`, fullPage: true });
    await page.getByLabel("Action").selectOption("");
    await page.waitForFunction(() => document.querySelectorAll("article").length === 5);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
      true,
    );
    await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    JSON.stringify({
      result: "passed",
      screenshots: [`${output}/desktop.png`, `${output}/mobile.png`],
      checks: [
        "five dispositions",
        "deferral reason",
        "artifact receipt",
        "keyboard",
        "filters",
        "reduced motion",
        "overflow",
        "console",
        "demo isolation",
      ],
    }),
  );
} finally {
  await browser.close();
}
