import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3046";
const output = process.env.QA_OUTPUT_DIR || "/tmp/accelerate-invoice-navigation";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const errors = [];
const escaped = [];
let activePage;
let passed = false;

async function search(page, query) {
  await page.getByRole("button", { name: "Open command palette", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Admin command palette" });
  await dialog.getByPlaceholder("Search people, pages, or run a command…").fill(query);
  return dialog;
}

async function observeDemo(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon")) errors.push(message.text());
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin || url.pathname.startsWith("/api/")) {
      escaped.push(url.origin + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
}

async function openInvoices(page, mobile) {
  if (mobile) await page.getByRole("button", { name: "Open More", exact: true }).click();
  const navigation = page.locator('nav[aria-label="Admin navigation"]:visible');
  const invoices = navigation.getByRole("link", { name: "Invoices", exact: true });
  assert.equal(await invoices.count(), 1, "Invoices must be a visible destination without expanding Records");
  await invoices.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { level: 1, name: "Invoices", exact: true }).waitFor();
  if (mobile) assert.equal(await page.getByRole("button", { name: "Close navigation" }).count(), 0);
}

try {
  for (const mobile of [false, true]) {
    for (const scenario of ["northline-roofing", "superdebate"]) {
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        reducedMotion: mobile ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      activePage = page;
      await observeDemo(page);
      const root = `${base}/demo/command-center/${scenario}`;
      const label = `${scenario}-${mobile ? "mobile" : "desktop"}`;
      await page.goto(root + "/today");
      await page.getByRole("heading", { level: 1, name: "Today", exact: true }).waitFor();
      if (!mobile) {
        await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
        assert.equal(await page.locator('[data-admin-sidebar] a[aria-label="Invoices"]').count(), 1);
        await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
      }
      await openInvoices(page, mobile);
      await page.getByRole("heading", { name: "All invoices", exact: true }).waitFor();
      await page.screenshot({ path: `${output}/${label}-invoices.png` });
      const create = page.locator("main .admin-button--primary").filter({ hasText: "Create invoice" });
      await create.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("heading", { level: 1, name: "Create invoice", exact: true }).waitFor();
      await page.getByRole("button", { name: "Use sample invoice", exact: true }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get("view"), "create");
      assert.equal(await page.getByRole("heading", { name: "All invoices", exact: true }).count(), 0);
      const formRect = await page.getByRole("heading", { name: "New customer invoice", exact: true }).boundingBox();
      assert.ok(formRect && formRect.y < (mobile ? 844 : 1000), "The customer form must appear in the first screen");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `${output}/${label}-create.png` });
      await page.getByRole("button", { name: "Use sample invoice", exact: true }).click();
      await page.getByRole("button", { name: "Prepare invoice", exact: true }).click();
      await page.getByRole("button", { name: "Request draft approval", exact: true }).click();
      await page.getByRole("button", { name: "Approve & create draft", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Approve & send invoice", exact: true }).count(), 0);

      // The palette must find creation and retain the current demo workspace.
      const dialog = await search(page, "create invoice");
      await dialog.getByRole("button", { name: /Create invoice/ }).waitFor();
      await dialog.getByPlaceholder("Search people, pages, or run a command…").press("Enter");
      await page.getByRole("heading", { level: 1, name: "Create invoice", exact: true }).waitFor();
      assert.ok(page.url().startsWith(root + "/invoicing?view=create"));

      await page.goto(root + "/plugins");
      const plugin = page.locator('[data-plugin="stripe-invoicing"]');
      await plugin.getByRole("button", { name: /^Disable / }).click();
      await plugin.getByRole("button", { name: /^Enable / }).click({ trial: true });
      const disabledSearch = await search(page, "invoice");
      await disabledSearch.getByRole("button", { name: /Set up invoicing/ }).waitFor();
      assert.equal(await disabledSearch.getByRole("button", { name: /^Create invoice/ }).count(), 0);
      await disabledSearch.getByPlaceholder("Search people, pages, or run a command…").press("Enter");
      await page.getByText("Stripe invoicing is turned off", { exact: true }).waitFor();
      await page.getByRole("link", { name: "Go to Integrations & Modules", exact: true }).click();
      await page.getByRole("button", { name: "Enable Stripe invoicing", exact: true }).waitFor();
      assert.equal(await page.getByPlaceholder("Search modules or routes").inputValue(), "Stripe invoicing");
      await page.screenshot({ path: `${output}/${label}-setup.png` });
      results.push({ scenario, viewport: mobile ? "mobile" : "desktop", passed: true });
      await context.close();
    }

    // A controlled disconnected-provider response exercises setup through the same page.
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    activePage = page;
    await observeDemo(page);
    await page.goto(base + "/demo/command-center/northline-roofing/today");
    await page.getByRole("heading", { level: 1, name: "Today", exact: true }).waitFor();
    await page.evaluate(() => {
      const demoFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
        if (url.pathname === "/api/admin/tenant/providers") {
          return new Response(JSON.stringify({ providers: [] }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return demoFetch(input, init);
      };
    });
    const dialog = await search(page, "create invoice");
    await dialog.getByPlaceholder("Search people, pages, or run a command…").press("Enter");
    await page.getByRole("heading", { name: "Connect your Stripe account", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Prepare invoice", exact: true }).count(), 0);
    await page.getByLabel("Stripe API key", { exact: true }).focus();
    assert.ok(await page.getByLabel("Stripe API key", { exact: true }).evaluate((node) => node === document.activeElement));
    await page.screenshot({ path: `${output}/disconnected-${mobile ? "mobile" : "desktop"}.png` });
    results.push({ viewport: mobile ? "mobile" : "desktop", fixture: "disconnected Stripe", passed: true });
    await page.goto(base + "/docs/plugins/stripe-invoicing");
    await page.getByRole("heading", { level: 1, name: "Stripe invoicing", exact: true }).waitFor();
    const guide = await page.locator("main").innerText();
    assert.ok(guide.includes("Create invoice") && guide.includes("/admin/invoicing?view=create"));
    await page.screenshot({ path: `${output}/guide-${mobile ? "mobile" : "desktop"}.png` });
    results.push({ viewport: mobile ? "mobile" : "desktop", fixture: "public invoice guide", passed: true });
    await context.close();
  }
  assert.deepEqual(escaped, [], "No demo API or provider request may escape to the server");
  assert.deepEqual(errors, [], "The invoice journey must not produce browser errors");
  passed = true;
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: output + "/failure.png" }).catch(() => {});
    await writeFile(output + "/failure.txt", String(error));
  }
  throw error;
} finally {
  await browser.close();
  await writeFile(output + "/results.json", JSON.stringify({
    passed,
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    results, errors, escaped,
    providerEffects: "Fictional demo only; disconnected state uses a controlled browser fixture.",
  }, null, 2));
}
console.log(JSON.stringify({ passed, cases: results.length, output }));
