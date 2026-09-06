import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const output = "/tmp/accelerate-radar-workspace";
await mkdir(output, { recursive: true });
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
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
    });
    await page.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== new URL(base).origin || u.pathname.startsWith("/api/")) {
        escaped.push(u.origin + u.pathname);
        return route.abort();
      }
      return route.continue();
    });
    for (const scenario of ["superdebate", "northline-roofing"]) {
      const root = `${base}/demo/command-center/${scenario}`;
      await page.goto(root + "/radar/today");
      await page.getByRole("heading", { name: "Worth reviewing today", exact: true }).waitFor();
      assert.equal(await page.getByText("Estimate", { exact: true }).count(), 5);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({ path: `${output}/${scenario}-${width}-today.png`, fullPage: true });
      await page
        .getByRole("link", { name: /Partner workshop invitation/ })
        .first()
        .click();
      await page.getByRole("button", { name: "Edit opportunity", exact: true }).waitFor();
      await page.screenshot({ path: `${output}/${scenario}-${width}-detail.png`, fullPage: true });
      const edit = page.getByRole("button", { name: "Edit opportunity", exact: true });
      await edit.focus();
      await page.keyboard.press("Enter");
      await page.getByLabel("Title", { exact: true }).fill("Workshop scope reviewed in demo");
      await page.getByRole("button", { name: "Preview exact change", exact: true }).click();
      await page.getByRole("dialog", { name: "Review before saving", exact: true }).waitFor();
      await page.screenshot({
        path: `${output}/${scenario}-${width}-approval.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Approve this change", exact: true }).press("Enter");
      await page
        .getByText("Change approved and recorded. The workspace has been refreshed.", {
          exact: true,
        })
        .waitFor();
      assert.equal(await page.locator("h1").textContent(), "Workshop scope reviewed in demo");
      await page.reload();
      await page.getByRole("button", { name: "Prepare a draft", exact: true }).waitFor();
      assert.equal(await page.locator("h1").textContent(), "Workshop scope reviewed in demo");
      await page.getByRole("button", { name: "Prepare a draft", exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill("Workshop preparation draft");
      await page
        .getByLabel("Draft text", { exact: true })
        .fill(
          "A practical listening exercise, a structured exchange and a reflection. Review the scope before proposing dates.",
        );
      await page.getByRole("button", { name: "Preview exact change", exact: true }).click();
      await page.getByRole("button", { name: "Approve this change", exact: true }).click();
      await page.getByRole("button", { name: /Workshop preparation draft/ }).waitFor();
      await page.getByRole("button", { name: /Workshop preparation draft/ }).click();
      await page.getByRole("dialog", { name: "Workshop preparation draft", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), "BUTTON");
      await page.goto(root + "/radar/history");
      await page.getByRole("heading", { name: "Radar history", exact: true }).waitFor();
      await page.screenshot({ path: `${output}/${scenario}-${width}-history.png`, fullPage: true });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      if (width === 390) await page.getByRole("button", { name: "Open More", exact: true }).click();
      await page.getByRole("button", { name: "Open demo controls", exact: true }).click();
      await page.getByRole("button", { name: "Reset this demo", exact: true }).click();
      await page.goto(root + "/radar/today");
      await page.getByRole("heading", { name: "Worth reviewing today", exact: true }).waitFor();
      assert.equal(
        await page.getByText("Workshop scope reviewed in demo", { exact: true }).count(),
        0,
      );
      assert.equal(await page.getByText("Estimate", { exact: true }).count(), 5);
      results.push({
        scenario,
        width,
        checks: [
          "shared page",
          "five reviewed actions",
          "source detail",
          "keyboard approval",
          "draft creation",
          "reload persistence",
          "session reset and scenario isolation",
          "dialog escape/focus",
          "retained history",
          "no overflow",
          "reduced motion",
        ],
      });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(escaped, []);
    await context.close();
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ results, protectedRequests: 0, providerRequests: 0 }, null, 2),
  );
} finally {
  await browser.close();
}
