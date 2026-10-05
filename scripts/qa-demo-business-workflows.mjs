import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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
  "superdebate",
];
const startedAt = new Date().toISOString();
const results = [];
let passed = false;
const browser = await chromium.launch();
let activePage;
let activeScenario = "starting";
let activeViewport = "unknown";
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
      reducedMotion: mobile ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    activePage = page;
    activeViewport = mobile ? "mobile" : "desktop";
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
      activeScenario = scenario;
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
        superdebate: "SuperDebate Demo",
      };
      assert.equal(name, names[scenario], "Scenario identity leaked from another workspace");
      await page.getByLabel("Display name", { exact: true }).fill(name + " Studio");
      await page.getByRole("button", { name: "Save branding", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Save branding", exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Save branding", exact: true })
        .and(page.locator(":disabled"))
        .waitFor();
      assert.equal(
        await page.getByLabel("Display name", { exact: true }).inputValue(),
        name + " Studio",
      );
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
      // Collections seeds invoices into the same history. Their receipts must
      // remain renderable when the operator subsequently opens Invoicing.
      await page.goto(root + "/collections");
      await page.getByRole("button", { name: "Preview reminder", exact: true }).waitFor();
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
      const livePreview = page.getByRole("region", { name: "Invoice design preview", exact: true });
      await livePreview.waitFor();
      const billingBefore = await livePreview.locator("table, dl").allTextContents();
      // Reversible style starters preserve presentation wording and financial facts.
      assert.equal(
        await page.getByRole("button", { name: "Undo changes", exact: true }).isEnabled(),
        false,
      );
      const originalHeading = await page.getByLabel("Heading", { exact: true }).inputValue();
      await page.getByRole("button", { name: "Use minimal style", exact: true }).click();
      assert.equal(await page.getByLabel("Heading", { exact: true }).inputValue(), originalHeading);
      assert.equal(
        await page.getByRole("combobox", { name: "Typography", exact: true }).inputValue(),
        "sans",
      );
      await page.getByRole("button", { name: "Undo changes", exact: true }).click();
      assert.equal(
        await page.getByRole("combobox", { name: "Typography", exact: true }).inputValue(),
        "workspace",
      );
      await page.getByRole("button", { name: "Redo changes", exact: true }).click();
      assert.equal(
        await page.getByRole("combobox", { name: "Spacing", exact: true }).inputValue(),
        "compact",
      );
      await page.getByRole("button", { name: "Use workspace style", exact: true }).click();
      assert.equal(
        await page.getByRole("button", { name: "Redo changes", exact: true }).isEnabled(),
        false,
      );
      // One typing session is one undo, rather than one step per keystroke.
      await page.getByLabel("Heading", { exact: true }).focus();
      await page.getByLabel("Heading", { exact: true }).pressSequentially(" revised");
      await page.getByLabel("Heading", { exact: true }).blur();
      await page.getByRole("button", { name: "Undo changes", exact: true }).click();
      assert.equal(await page.getByLabel("Heading", { exact: true }).inputValue(), originalHeading);
      await page.getByRole("button", { name: "Redo changes", exact: true }).click();
      assert.equal(
        await page.getByLabel("Heading", { exact: true }).inputValue(),
        originalHeading + " revised",
      );
      await page.getByLabel("Heading", { exact: true }).fill("");
      assert.equal(
        await page.getByRole("button", { name: "Apply AI changes", exact: true }).isEnabled(),
        false,
      );
      assert.equal(
        await page.getByRole("button", { name: "Preview page", exact: true }).isEnabled(),
        false,
      );
      const invoiceHeading = `${name} services`;
      await page.getByLabel("Heading", { exact: true }).fill(invoiceHeading);
      await livePreview.getByRole("heading", { name: invoiceHeading, exact: true }).waitFor();
      await page
        .getByRole("heading", { name: "Customer invoice page", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-invoice-studio.png`,
      });
      await page
        .getByRole("textbox", { name: "Describe your changes", exact: true })
        .fill(
          "Use editorial layout, serif typography, compact spacing, and #164e63. Keep my wording.",
        );
      await page.getByRole("button", { name: "Apply AI changes", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Apply AI changes", exact: true }).waitFor();
      await page.getByRole("button", { name: "Undo changes", exact: true }).click({ trial: true });
      assert.equal(await page.getByLabel("Heading", { exact: true }).inputValue(), invoiceHeading);
      assert.equal(
        await page.getByRole("combobox", { name: "Typography", exact: true }).inputValue(),
        "serif",
      );
      assert.equal(
        await page.getByRole("combobox", { name: "Spacing", exact: true }).inputValue(),
        "compact",
      );
      assert.equal(
        await page.getByLabel("Invoice accent color", { exact: true }).inputValue(),
        "#164e63",
      );
      assert.deepEqual(await livePreview.locator("table, dl").allTextContents(), billingBefore);
      await page.waitForFunction(
        ({ mobile }) => {
          const node = document.querySelector('[aria-label="Invoice design preview"]');
          return (
            node && getComputedStyle(node.children[1]).paddingTop === (mobile ? "20px" : "28px")
          );
        },
        { mobile },
      );
      const appearance = await livePreview.evaluate((node) => ({
        font: getComputedStyle(node).fontFamily,
        headingFont: getComputedStyle(node.querySelector("h2")).fontFamily,
        accent: getComputedStyle(node.firstElementChild).backgroundColor,
        padding: getComputedStyle(node.children[1]).paddingTop,
      }));
      assert.match(appearance.font, /Georgia/);
      assert.match(appearance.headingFont, /Georgia/);
      assert.equal(appearance.accent, "rgb(22, 78, 99)");
      assert.equal(appearance.padding, mobile ? "20px" : "28px");
      assert.equal(
        await livePreview.getByRole("link", { name: "Pay securely with Stripe" }).count(),
        0,
        "The editor must not navigate to payment",
      );

      const paper = page.locator("[data-invoice-preview-width]");
      const motionDuration = await paper.evaluate(
        (node) => getComputedStyle(node).transitionDuration,
      );
      assert.equal(motionDuration, mobile ? "0s" : "0.32s", "Preview motion honors reduced motion");
      if (!mobile) {
        // Capture an in-progress native transition and interrupt it with a reversal.
        await page.getByRole("button", { name: "Phone", exact: true }).click();
        await page.waitForFunction(() => {
          const node = document.querySelector('[data-invoice-preview-width="phone"]');
          return (
            node && node.getAnimations().some((animation) => animation.playState === "running")
          );
        });
        await page.getByRole("button", { name: "Full width", exact: true }).click();
        await page.waitForFunction(() => {
          const node = document.querySelector('[data-invoice-preview-width="desktop"]');
          return (
            node && node.getAnimations().every((animation) => animation.playState !== "running")
          );
        });
        assert.equal(
          await page
            .getByRole("button", { name: "Full width", exact: true })
            .getAttribute("aria-pressed"),
          "true",
        );
      }
      await page.getByRole("button", { name: "Phone", exact: true }).click();
      await page.waitForFunction(() => {
        const node = document.querySelector('[data-invoice-preview-width="phone"]');
        return node && node.getBoundingClientRect().width <= 360;
      });
      await page.waitForFunction(() => {
        const node = document.querySelector('[aria-label="Invoice design preview"]');
        return node && getComputedStyle(node.children[1]).paddingTop === "20px";
      });
      const phone = await livePreview.boundingBox();
      assert.ok(phone.width <= 360, "Phone preview is bounded on a desktop screen");
      assert.equal(
        await livePreview.evaluate((node) => getComputedStyle(node.children[1]).paddingTop),
        "20px",
      );
      assert.ok(
        await livePreview.evaluate((node) => node.scrollWidth <= node.clientWidth),
        "Phone invoice content fits",
      );
      const normalViewport = page.viewportSize();
      const documentHeight = Math.ceil((await livePreview.boundingBox()).height);
      await page.setViewportSize({ width: normalViewport.width, height: documentHeight + 600 });
      await livePreview.screenshot({
        path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-phone-document.png`,
      });
      await page.setViewportSize(normalViewport);
      await page.getByRole("button", { name: "Full width", exact: true }).click();
      await page.getByRole("button", { name: "Undo changes", exact: true }).click();
      assert.equal(
        await page.getByRole("combobox", { name: "Typography", exact: true }).inputValue(),
        "workspace",
      );
      await page.getByRole("button", { name: "Apply AI changes", exact: true }).click();
      await page.getByRole("button", { name: "Apply AI changes", exact: true }).waitFor();
      await page.getByRole("button", { name: "Undo changes", exact: true }).click({ trial: true });
      await page.getByRole("button", { name: "Preview page", exact: true }).click();
      await page
        .getByRole("button", { name: "Request publication approval", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Undo changes", exact: true }).click();
      assert.equal(
        await page
          .getByRole("button", { name: "Request publication approval", exact: true })
          .count(),
        0,
      );
      await page.getByRole("button", { name: "Redo changes", exact: true }).click();
      assert.equal(
        await page
          .getByRole("button", { name: "Request publication approval", exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("textbox", { name: "Closing note", exact: true })
        .fill("Thank you for working with our team.");
      assert.equal(
        await page
          .getByRole("button", { name: "Request publication approval", exact: true })
          .count(),
        0,
        "Any edit requires a new publication review",
      );
      await page.getByRole("button", { name: "Preview page", exact: true }).click();
      await stable(page);
      await page.screenshot({
        path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-invoice-designer.png`,
      });
      await page.getByRole("button", { name: "Request publication approval", exact: true }).click();
      await page
        .getByRole("button", { name: "Approve & publish page", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "Refresh published links", exact: true }).click();
      await page.getByRole("link", { name: "Open demo invoice", exact: true }).click();
      await page.getByRole("heading", { name: "Customer invoice", exact: true }).waitFor();
      await page.getByRole("region", { name: "Customer invoice", exact: true }).waitFor();
      await page
        .getByRole("region", { name: "Customer invoice", exact: true })
        .getByRole("heading", { name: invoiceHeading, exact: true })
        .waitFor();
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
      await page.getByRole("region", { name: "Invoice design preview", exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("Heading", { exact: true }).inputValue(),
        invoiceHeading,
        "Reopening starts from the published design",
      );
      assert.equal(
        await page.getByRole("combobox", { name: "Typography", exact: true }).inputValue(),
        "serif",
      );
      await page.getByLabel("Heading", { exact: true }).fill("Private draft changes");
      await page.goto(customerUrl);
      await page
        .getByRole("region", { name: "Customer invoice", exact: true })
        .getByRole("heading", { name: invoiceHeading, exact: true })
        .waitFor();
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
        await page.getByRole("button", { name: "Reject", exact: true }).focus();
        await page.keyboard.press("Enter");
        await page
          .getByRole("button", { name: "Approve & create tasks", exact: true })
          .waitFor({ state: "detached" });
        await page
          .getByLabel("Task 1", { exact: true })
          .fill("Confirm the revised customer kickoff");
        await page.getByRole("button", { name: "Review workflow", exact: true }).click();
        await page
          .getByLabel("Task 1", { exact: true })
          .fill("Confirm the revised customer kickoff and owner");
        assert.equal(
          await page.getByRole("button", { name: "Request approval", exact: true }).count(),
          0,
          "Editing must invalidate the reviewed plan",
        );
        await page.getByRole("button", { name: "Review workflow", exact: true }).click();
        await page.getByRole("button", { name: "Request approval", exact: true }).click();
        await page.getByRole("button", { name: "Approve & create tasks", exact: true }).click();
        const createdWorkflow = page
          .locator("article")
          .filter({ hasText: "Confirm the revised customer kickoff and owner" });
        await createdWorkflow
          .getByRole("button", { name: "Mark complete", exact: true })
          .first()
          .click();
        await createdWorkflow.getByText("completed", { exact: true }).waitFor();
        await stable(page);
        await page.screenshot({
          path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-${route}.png`,
        });
      }
      await page.goto(root + "/plugins");
      const plugin = page.locator('[data-plugin="stripe-invoicing"]');
      await plugin.getByRole("button", { name: /^Disable / }).click();
      // Visibility can precede completion of the mutation/refetch. Wait for an
      // actionable control and assert stored state before navigating away.
      await plugin.getByRole("button", { name: /^Enable / }).click({ trial: true });
      const storedDisabled = () =>
        page.evaluate(
          (id) =>
            JSON.parse(sessionStorage.getItem(`accelerate:admin-demo:${id}:v3`) || "{}")
              .moduleOverrides?.["stripe-invoicing"] === false,
          scenario,
        );
      assert.equal(await storedDisabled(), true, "Completed disable must be stored before reload");
      await page.reload();
      assert.equal(await storedDisabled(), true, "Reload must preserve disabled plugin state");
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
      results.push({ scenario, viewport: activeViewport, finishedAt: new Date().toISOString() });
      console.log(`${scenario} ${mobile ? "mobile" : "desktop"} passed`);
    }
    assert.deepEqual(escaped, [], "Protected or external request escaped");
    assert.deepEqual(errors, [], "Browser errors");
    await context.close();
  }
  passed = true;
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    const prefix = `${output}/failure-${activeScenario}-${activeViewport}`;
    await activePage.screenshot({ path: `${prefix}.png`, timeout: 5000 }).catch(() => {});
    const details = await activePage
      .evaluate(
        (id) => ({
          path: location.pathname,
          runtime: window.__accelerateAdminDemoRuntime,
          moduleOverrides: JSON.parse(
            sessionStorage.getItem(`accelerate:admin-demo:${id}:v3`) || "{}",
          ).moduleOverrides,
          visibleText: document.body.innerText.slice(0, 20000),
        }),
        activeScenario,
      )
      .catch(() => ({ diagnostic: "Page unavailable" }));
    await writeFile(`${prefix}.json`, JSON.stringify(details, null, 2));
  }
  throw error;
} finally {
  await browser.close();
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        commitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        startedAt,
        finishedAt: new Date().toISOString(),
        results,
        providerEvidence: "fictional-browser-adapter",
        realProviderTraffic: false,
        status: passed ? "passed" : "failed",
      },
      null,
      2,
    ),
  );
}
