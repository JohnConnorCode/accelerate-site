import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const output = "/tmp/accelerate-radar-workspace";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
let activePage;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(30000);
    const page = await context.newPage(),
      errors = [],
      escaped = [];
    activePage = page;
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
      console.log(`Radar browser: ${scenario} at ${width}px`);
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
        .getByRole("status")
        .filter({ hasText: "Change approved and recorded. The workspace has been refreshed." })
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
      const detailUrl = page.url();
      assert.equal(
        await page.getByRole("button", { name: "Review exact message", exact: true }).isDisabled(),
        true,
      );
      await page.getByText("Prepare a new outreach draft", { exact: true }).click();
      await page
        .getByLabel("Useful contribution", { exact: true })
        .fill("We can offer a practical workshop outline.");
      await page.getByLabel("Specific ask", { exact: true }).fill("Would you like to review it?");
      await page.getByRole("button", { name: "Prepare draft for review", exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill("Reviewed outreach example");
      await page.getByRole("button", { name: "Preview exact change", exact: true }).click();
      await page.getByRole("button", { name: "Approve this change", exact: true }).click();
      await page.getByRole("button", { name: /Reviewed outreach example/ }).waitFor();
      await page.goto(root + "/integrations");
      await page.getByRole("tab", { name: /Pluggable Modules/ }).click();
      await page.getByLabel("Search modules", { exact: true }).fill("Opportunity Radar");
      await page.getByLabel(/^Outreach mode/).selectOption("approval-required");
      await page.getByRole("button", { name: "Save settings", exact: true }).click();
      await page.getByText("Settings saved", { exact: true }).waitFor();
      await page.goto(detailUrl);
      await page
        .getByLabel(/^Saved outreach draft/)
        .selectOption({ label: "Reviewed outreach example" });
      await page
        .getByLabel("Why this message is appropriate now", { exact: true })
        .fill("The current request matches this useful contribution.");
      await page.getByRole("button", { name: "Review exact message", exact: true }).click();
      await page.getByRole("button", { name: "Approve and send", exact: true }).waitFor();
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[data-admin-overlay="dialog"]');
        return dialog && Number(getComputedStyle(dialog).opacity) >= 0.999;
      });
      assert.equal(
        await page.getByRole("dialog").evaluate((el) => {
          const panel = el.querySelector("div");
          return panel ? getComputedStyle(panel).backgroundColor !== "rgba(0, 0, 0, 0)" : false;
        }),
        true,
        "Review must have an opaque readable surface",
      );
      await page.screenshot({
        path: `${output}/${scenario}-${width}-outreach-review.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Approve and send", exact: true }).press("Enter");
      await page.getByText("Simulated sent", { exact: true }).waitFor();
      await page.reload();
      await page.getByText("Simulated sent", { exact: true }).waitFor();
      assert.equal(await page.getByText("Simulated sent", { exact: true }).count(), 1);
      await page.getByText("Simulated sent", { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${output}/${scenario}-${width}-outreach-receipt.png`,
        fullPage: true,
      });
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
          "default-off outreach, exact keyboard approval and persisted simulated receipt",
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
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
    await writeFile(
      `${output}/failure.json`,
      JSON.stringify(
        {
          message: String(error),
          url: activePage.url(),
          body: await activePage
            .locator("body")
            .innerText()
            .catch(() => "unavailable"),
        },
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  await browser.close();
}
