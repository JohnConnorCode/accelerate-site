import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045";
const output = process.env.QA_OUTPUT || "/tmp/admin-ai-capabilities-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/demo/command-center/superdebate/ai?view=capabilities`, {
      timeout: 120_000,
    });
    const search = page.getByRole("searchbox", { name: "Find a capability" });
    await search.waitFor();
    const cards = page.getByRole("heading", { level: 3 });
    const total = await cards.count();
    assert.ok(total > 0, "fictional catalogue renders shared capability cards");
    await search.focus();
    assert.equal(await search.evaluate((element) => element === document.activeElement), true);
    await search.fill("GET_TODAY_SNAPSHOT");
    assert.equal(await cards.count(), 1, "tool names normalize underscores and case");
    await search.fill("no matching operation xyz");
    await page.getByText("No matching capabilities", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    assert.equal(await search.inputValue(), "");
    assert.equal(
      await search.evaluate((element) => element === document.activeElement),
      true,
      "clear returns keyboard focus to search",
    );
    assert.equal(await cards.count(), total);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      "no horizontal page overflow",
    );
    await page.screenshot({ path: `${output}/capabilities-${width}.png`, fullPage: true });

    // Wrap the fictional transport to exercise the actual component's failed-read recovery.
    await page.evaluate(() => {
      const fetchOriginal = window.fetch;
      window.__capabilityReadFailure = true;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.url || String(input);
        if (url.includes("/api/admin/revenue-os/ai/capabilities") && window.__capabilityReadFailure)
          return new Response(JSON.stringify({ error: "Temporary capability read failure" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        return fetchOriginal(input, init);
      };
    });
    await page.getByRole("button", { name: /Run history/ }).click();
    await page.waitForURL((url) => url.searchParams.get("view") === "runs");
    await page.getByRole("button", { name: /Capabilities/ }).click();
    await page.waitForURL((url) => url.searchParams.get("view") === "capabilities");
    await page.getByText("Capabilities could not be loaded", { exact: true }).waitFor();
    await page.screenshot({ path: `${output}/capabilities-recovery-${width}.png` });
    await page.evaluate(() => {
      window.__capabilityReadFailure = false;
    });
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await search.waitFor();
    assert.equal(await cards.count(), total, "retry restores catalogue");
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `PASS ${width}px: capability search, empty recovery, keyboard focus, failed read/retry and overflow. Fictional data; no live-client proof.`,
    );
  }
} finally {
  await browser.close();
}
