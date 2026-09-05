import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3023";
const output = "/tmp/accelerate-demo-business";
await mkdir(output, { recursive: true });
const scenarios = [
  "northline-roofing",
  "alder-ridge-law",
  "ledgerstone-advisory",
  "hearthline-realty",
  "common-table-network",
];
const browser = await chromium.launch();
async function stable(page) {
  await page.locator(".admin-main h1").waitFor();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "Viewport overflow",
  );
}
try {
  for (const mobile of process.argv.includes("--mobile") ? [true] : [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
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
    for (const scenario of scenarios) {
      const root = `${base}/demo/command-center/${scenario}`;
      await page.goto(root + "/branding");
      await page.getByRole("button", { name: "Save branding", exact: true }).waitFor();
      await stable(page);
      const name = await page.getByLabel("Display name", { exact: true }).inputValue();
      const names = {
        "northline-roofing": "Northline Roofing & Exteriors",
        "alder-ridge-law": "Alder Ridge Injury Law",
        "ledgerstone-advisory": "Ledgerstone Accounting & Advisory",
        "hearthline-realty": "Hearthline Realty Group",
        "common-table-network": "Common Table Community Network",
      };
      assert.equal(name, names[scenario], "Scenario identity leaked from another workspace");
      await page.getByLabel("Display name", { exact: true }).fill(name + " Studio");
      await page.getByRole("button", { name: "Save branding", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Save branding", exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector("input")?.value?.endsWith("Studio"));
      await page.reload();
      await page.getByLabel("Display name", { exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("Display name", { exact: true }).inputValue(),
        name + " Studio",
      );
      await page.getByRole("button", { name: "Remove logo", exact: true }).click();
      await page.getByRole("button", { name: "Use sample logo", exact: true }).click();
      await page.screenshot({
        path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-branding.png`,
      });
      await page.goto(root + "/invoicing");
      await page.getByRole("button", { name: "Use sample invoice" }).click();
      await page.getByRole("button", { name: "Prepare invoice", exact: true }).click();
      await page.getByRole("button", { name: "Request draft approval", exact: true }).click();
      const createdArticle = page
        .locator("article")
        .filter({ has: page.getByRole("button", { name: "Approve & create draft", exact: true }) });
      const creationId = await createdArticle.getAttribute("data-action-id");
      await page
        .getByRole("button", { name: "Approve & create draft", exact: true })
        .first()
        .click();
      await page
        .locator(`[data-action-id="${creationId}"]`)
        .getByRole("button", { name: "Request sending approval", exact: true })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Approve & send invoice", exact: true })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Approve & send invoice", exact: true })
        .waitFor({ state: "detached" });
      await page
        .locator(`[data-action-id="${creationId}"]`)
        .getByRole("button", { name: "Design customer page", exact: true })
        .click();
      await page.getByRole("button", { name: "Draft with AI", exact: true }).click();
      await page.getByRole("button", { name: "Preview page", exact: true }).click();
      await page.getByRole("button", { name: "Request publication approval", exact: true }).click();
      await page
        .getByRole("button", { name: "Approve & publish page", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "Refresh published links", exact: true }).click();
      await page.getByRole("link", { name: "Open demo invoice", exact: true }).click();
      await page.getByRole("heading", { name: "Customer invoice", exact: true }).waitFor();
      await page.getByRole("region", { name: "Customer invoice", exact: true }).waitFor();
      await page.locator(".admin-main").evaluate((el) => {
        el.scrollTop = 0;
      });
      await stable(page);
      assert.ok((await page.locator("main").innerText()).includes(name + " Studio"));
      await page.screenshot({
        path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-invoice.png`,
      });
      const customerUrl = page.url();
      await page.getByRole("link", { name: "Back to invoices" }).click();
      await page
        .locator(`[data-action-id="${creationId}"]`)
        .getByRole("button", { name: "Design customer page", exact: true })
        .click();
      await page.getByRole("button", { name: "Revoke", exact: true }).click();
      await page.getByText("Revoked", { exact: true }).waitFor();
      await page.goto(customerUrl);
      await page.getByRole("alert").filter({ hasText: "revoked" }).waitFor();
      for (const route of ["client-onboarding", "meeting-commitments"]) {
        await page.goto(root + "/" + route);
        const select = page.getByRole("combobox", {
          name: route === "client-onboarding" ? "Won opportunity" : "Stored meeting",
        });
        await select.selectOption({ index: 1 });
        await page.getByRole("button", { name: "Review workflow", exact: true }).click();
        await page.getByRole("button", { name: "Request approval", exact: true }).click();
        await page.getByRole("button", { name: "Approve & create tasks", exact: true }).click();
        await page.getByRole("button", { name: "Mark complete", exact: true }).first().click();
        await stable(page);
        await page.screenshot({
          path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-${route}.png`,
        });
      }
      await page.goto(root + "/plugins");
      const plugin = page.locator('[data-plugin="stripe-invoicing"]');
      await plugin.getByRole("button", { name: /^Disable / }).click();
      await plugin.getByRole("button", { name: /^Enable / }).waitFor();
      await page.reload();
      await plugin.getByRole("button", { name: /^Enable / }).click();
      await plugin.getByRole("button", { name: /^Disable / }).waitFor();
      // Exercise the shared Appearance control on the actual branded admin screen.
      await page.goto(root + "/branding");
      for (const theme of ["Paper", "Night", "Signal", "Studio", "Frost"]) {
        if (mobile) await page.getByRole("button", { name: "Open More", exact: true }).click();
        await page.getByRole("button", { name: /^Appearance:/ }).click();
        await page.getByRole("radio", { name: new RegExp(theme) }).click();
        if (mobile)
          await page.getByRole("button", { name: "Close navigation", exact: true }).click();
        await stable(page);
        await page.screenshot({
          path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-${theme}.png`,
        });
      }
      await page.goto(root + "/branding");
      assert.equal(
        await page.getByLabel("Display name", { exact: true }).inputValue(),
        name + " Studio",
      );
      if (mobile) await page.getByRole("button", { name: "Open More", exact: true }).click();
      await page.getByRole("button", { name: "Open demo controls", exact: true }).click();
      await page.getByRole("button", { name: "Reset this demo", exact: true }).click();
      await page.waitForLoadState("domcontentloaded");
      await page.getByLabel("Display name", { exact: true }).waitFor();
      assert.equal(await page.getByLabel("Display name", { exact: true }).inputValue(), name);
      console.log(`${scenario} ${mobile ? "mobile" : "desktop"} passed`);
    }
    assert.deepEqual(escaped, [], "Protected or external request escaped");
    assert.deepEqual(errors, [], "Browser errors");
    await context.close();
  }
} finally {
  await browser.close();
}
