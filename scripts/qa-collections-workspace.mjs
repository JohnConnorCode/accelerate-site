import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3036";
const output = "/tmp/accelerate-collections-workspace";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const scenarios = [
  "northline-roofing",
  "alder-ridge-law",
  "ledgerstone-advisory",
  "hearthline-realty",
  "common-table-network",
];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    const errors = [],
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
    for (const [index, scenario] of scenarios.entries()) {
      const root = `${base}/demo/command-center/${scenario}`;
      await page.goto(root + "/collections");
      await page.getByRole("button", { name: "Preview reminder", exact: true }).waitFor();
      const cases = page.locator("button[aria-pressed]");
      await cases.first().waitFor();
      assert.equal(await cases.count(), 6);
      assert.equal(await page.locator("h1").textContent(), "Collections Action Desk");
      await page.getByLabel("Owner email", { exact: true }).fill("finance@operator.example");
      await page.getByRole("button", { name: "Save case policy", exact: true }).press("Enter");
      await page.getByText("Case policy saved with a revision and history receipt.").waitFor();
      await page.reload();
      await page.getByRole("button", { name: "Preview reminder", exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("Owner email", { exact: true }).inputValue(),
        "finance@operator.example",
      );
      await page.getByRole("button", { name: "Preview reminder", exact: true }).click();
      await page.getByTitle("Branded reminder preview").waitFor();
      await page
        .getByRole("button", { name: "Queue reviewed reminder", exact: true })
        .press("Enter");
      await page.getByRole("button", { name: "Approve and send", exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Simulate payment before approval", exact: true })
        .click();
      await page
        .getByText("Simulated payment recorded. A pending reminder must now be skipped.")
        .waitFor();
      await page.getByRole("button", { name: "Approve and send", exact: true }).press("Enter");
      await page.getByRole("alert").filter({ hasText: "Reminder skipped" }).waitFor();
      await cases.nth(1).click();
      await page.getByRole("button", { name: "Preview reminder", exact: true }).click();
      await page
        .getByRole("button", { name: "Queue reviewed reminder", exact: true })
        .press("Enter");
      await page.getByRole("button", { name: "Approve and send", exact: true }).press("Enter");
      await page.getByText(/Receipt: sent/).waitFor();
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        "Viewport overflow",
      );
      if (index === 0) {
        await page.screenshot({ path: `${output}/collections-${width}.png`, fullPage: true });
        for (const theme of ["Paper", "Night"]) {
          if (width === 390)
            await page.getByRole("button", { name: "Open More", exact: true }).click();
          await page.getByRole("button", { name: /^Appearance:/ }).click();
          await page.getByRole("radio", { name: new RegExp(theme) }).click();
          await page.getByRole("radio", { name: new RegExp(theme) }).waitFor({ state: "hidden" });
          if (width === 390)
            await page.getByRole("button", { name: "Close navigation", exact: true }).click();
          if (width === 390)
            await page
              .getByRole("button", { name: "Close navigation", exact: true })
              .waitFor({ state: "hidden" });
          await page.evaluate(() => document.querySelector(".admin-main")?.scrollTo(0, 0));
          await page.screenshot({
            path: `${output}/collections-${width}-${theme}.png`,
            fullPage: true,
          });
        }
        const verifyCollectionCapabilities = async (enabled) => {
          await page.goto(root + "/ai?view=capabilities");
          await page.getByText("Registry revenue-os-tools.v12", { exact: true }).waitFor();
          for (const [label, ready, connection] of [
            ["Read collection cases", "Ready to read", "No provider connection required"],
            ["preview collection reminder", "Ready to read", "Connection required"],
            ["Stage collection reminder", "Approval gated", "Connection required"],
          ]) {
            const heading = page.getByRole("heading", { name: label, exact: true });
            await heading.waitFor();
            const card = heading.locator("..");
            await card.getByText(enabled ? ready : "Unavailable", { exact: true }).waitFor();
            assert.ok((await card.textContent()).includes(connection));
          }
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          const heading = page.getByRole("heading", { name: "Read collection cases", exact: true });
          await heading.scrollIntoViewIfNeeded();
          await heading.locator("..").screenshot({
            path: `${output}/capability-${width}-${enabled ? "enabled" : "disabled"}.png`,
          });
        };
        await verifyCollectionCapabilities(true);
        await page.goto(root + "/plugins");
        await page
          .getByRole("button", { name: "Disable Collections Action Desk", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Enable Collections Action Desk", exact: true })
          .waitFor();
        await verifyCollectionCapabilities(false);
        await page.goto(root + "/plugins");
        await page
          .getByRole("button", { name: "Enable Collections Action Desk", exact: true })
          .click();
        await verifyCollectionCapabilities(true);
        await page.goto(root + "/collections");
        await cases.nth(1).waitFor();
        await cases.nth(1).click();
        await page.getByText(/Receipt: sent/).waitFor();
      }
      await page.getByRole("link", { name: "Customer record", exact: true }).click();
      await page.getByRole("heading", { name: "Collections follow-up", exact: true }).waitFor();
      await page.goto(root + "/today");
      await page.getByRole("heading", { name: "Collections follow-up", exact: true }).waitFor();
      await page.getByRole("link", { name: "Open Collections Action Desk", exact: true }).click();
      await page.getByRole("button", { name: "Preview reminder", exact: true }).waitFor();
      // Keyboard navigation remains available without motion.
      await page.keyboard.press("Tab");
      assert.ok(await page.evaluate(() => document.activeElement !== document.body));
      if (width === 390) await page.getByRole("button", { name: "Open More", exact: true }).click();
      await page.getByRole("button", { name: "Open demo controls", exact: true }).click();
      await page.getByRole("button", { name: "Reset this demo", exact: true }).click();
      await page.getByRole("button", { name: "Preview reminder", exact: true }).waitFor();
      assert.equal(await page.getByLabel("Owner email", { exact: true }).inputValue(), "");
    }
    assert.deepEqual(escaped, []);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "PASS: shared Collections UI in all five scenarios at desktop/mobile; edited state persistence/reset, stale approval skip, successful receipt, toggle retention, Today links, keyboard/reduced motion and zero escaped API/provider requests or console errors.",
  );
} finally {
  await browser.close();
}
