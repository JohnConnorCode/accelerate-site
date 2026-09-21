import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const neutral = process.argv.includes("--neutral");
const siteName = process.env.QA_SITE_NAME || "Harbor Operations";
const siteUrl = process.env.QA_SITE_URL || "https://harbor.example";
const output =
  process.env.QA_OUTPUT || (neutral ? "/tmp/accelerate-neutral-qa" : "/tmp/accelerate-turnkey-qa");
mkdirSync(output, { recursive: true });
async function captureNeutral(page, name, fullPage = true) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await page.screenshot({ path: `${output}/${name}.png`, fullPage });
}
const browser = await chromium.launch({ headless: true });
try {
  for (const [label, viewport, motion] of [
    ["desktop", { width: 1440, height: 1000 }, "no-preference"],
    ["mobile", { width: 390, height: 844 }, "reduce"],
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: motion });
    const page = await context.newPage();
    if (neutral) {
      const escaped = [],
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/api/analytics/events")
          errors.push("Unconfigured fork attempted first-party analytics");
      });
      page.on("console", (message) => {
        if (message.type() === "error")
          errors.push(`${message.text()} (${message.location().url})`);
      });
      page.on("response", (response) => {
        if (response.status() >= 400)
          errors.push(
            `HTTP ${response.status()}: ${response.request().method()} ${response.url()}`,
          );
      });
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin) {
          escaped.push(url.origin + url.pathname);
          return route.abort();
        }
        return route.continue();
      });
      try {
        assert.equal((await page.goto(base)).status(), 200);
        await page
          .getByRole("heading", {
            name: "A home for your business. A workspace to move it forward.",
            exact: true,
          })
          .waitFor();
        assert.equal(await page.title(), siteName);
        const social = await page.request.get(base + "/api/og");
        assert.equal(social.status(), 200);
        assert.match(social.headers()["content-type"], /image\/png/);
        writeFileSync(`${output}/${label}-social.png`, await social.body());
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), siteUrl);
        if (label === "mobile") {
          const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
          const bounds = await menu.boundingBox();
          assert.ok(
            bounds.x >= 0 && bounds.x + bounds.width <= viewport.width,
            "Custom name leaves the menu fully on screen",
          );
          assert.ok(bounds.width >= 44 && bounds.height >= 44, "Menu retains its touch target");
          await menu.focus();
          await page.keyboard.press("Enter");
          const close = page.getByRole("button", { name: "Close navigation menu", exact: true });
          await close.waitFor();
          const closeBounds = await close.boundingBox();
          assert.ok(
            closeBounds.x >= 0 && closeBounds.x + closeBounds.width <= viewport.width,
            "Custom name leaves the close control on screen",
          );
          assert.ok(closeBounds.width >= 44, "Close control retains its touch target");
          await page.keyboard.press("Escape");
          assert.equal(await menu.getAttribute("aria-expanded"), "false");
        }
        await captureNeutral(page, `${label}-entry`);
        await page.getByRole("link", { name: "Open your workspace", exact: true }).first().focus();
        await page.keyboard.press("Enter");
        await page.getByRole("heading", { name: "Connect your Supabase project" }).waitFor();
        assert.equal(await page.locator('input[type="password"]').count(), 0);
        await page.getByRole("link", { name: "Open the installation guide", exact: true }).focus();
        await page.keyboard.press("Enter");
        await page.getByRole("heading", { level: 1, name: "Connect your installation" }).waitFor();
        await page.goto(base + "/admin/login");
        await page.getByRole("heading", { name: "Connect your Supabase project" }).waitFor();
        assert.equal(await page.locator('input[type="password"]').count(), 0);
        await captureNeutral(page, `${label}-setup`);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          "Setup fits the viewport",
        );
        for (const name of ["Open the installation guide", "Explore the fictional demo"]) {
          const link = page.getByRole("link", { name, exact: true });
          assert.ok(
            (await link.boundingBox()).height >= 44,
            "Setup actions have touch-sized targets",
          );
        }
        const accessibility = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(accessibility.violations, [], "Accessible setup screen");
        await page.getByRole("link", { name: "Explore the fictional demo", exact: true }).focus();
        await page.keyboard.press("Enter");
        await page.waitForURL(base + "/demo/command-center");
        await page
          .getByRole("heading", { level: 1, name: "Your business. Working together." })
          .waitFor();
        assert.equal(new URL(page.url()).pathname, "/demo/command-center");
        assert.equal(
          await page.locator('img[src*="%2Fimages%2F"], img[src^="/images/"]').count(),
          0,
          "Neutral demo chooser does not request protected screenshots",
        );
        await captureNeutral(page, `${label}-chooser`);
        const demo = base + "/demo/command-center/northline-roofing";
        await page.goto(demo + "/pipeline");
        await page.getByPlaceholder("Search company, person, or email").waitFor();
        await page.waitForFunction(() => Boolean(window.__accelerateAdminDemoRuntime));
        await page.locator(".kanban-scroller [data-opportunity-id]").first().waitFor();
        assert.ok(
          (await page.locator(".kanban-scroller [data-opportunity-id]").count()) > 0,
          "Fictional populated pipeline",
        );
        await page.locator(".kanban-scroller").scrollIntoViewIfNeeded();
        await captureNeutral(page, `${label}-populated`);
        await page
          .getByPlaceholder("Search company, person, or email")
          .fill("no-matching-neutral-fixture-81725");
        const empty = page.getByText("No opportunities in this stage.", { exact: true }).first();
        await empty.waitFor();
        assert.equal(await page.locator(".kanban-scroller [data-opportunity-id]").count(), 0);
        await empty.scrollIntoViewIfNeeded();
        await captureNeutral(page, `${label}-empty`);
        await page.goto(demo + "/branding");
        await page.getByLabel("Display name", { exact: true }).fill("Harbor Demo Team");
        await page.getByRole("button", { name: "Save branding", exact: true }).focus();
        await page.keyboard.press("Enter");
        await page
          .getByRole("button", { name: "Save branding", exact: true })
          .and(page.locator(":disabled"))
          .waitFor();
        await page.reload();
        await page.getByLabel("Display name", { exact: true }).waitFor();
        assert.equal(
          await page.getByLabel("Display name", { exact: true }).inputValue(),
          "Harbor Demo Team",
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
          true,
        );
        await page.getByLabel("Display name", { exact: true }).scrollIntoViewIfNeeded();
        await captureNeutral(page, `${label}-branding`, false);
        await page.goto(base + "/docs/workspace/setup");
        await page
          .getByRole("heading", { name: "Set up a working workspace", exact: true })
          .waitFor();
        assert.equal(
          await page.locator('link[rel="canonical"]').getAttribute("href"),
          siteUrl + "/docs/workspace/setup",
        );
        assert.equal(
          await page.locator('img[src*="images%2Fdocs"], img[src*="/images/docs/"]').count(),
          0,
        );
        await captureNeutral(page, `${label}-docs`);
        assert.deepEqual(
          escaped,
          [],
          "No escaped external requests, including original installation domains",
        );
        assert.deepEqual(errors, [], "No browser console or runtime errors");
        writeFileSync(
          `${output}/${label}.json`,
          JSON.stringify(
            {
              passed: true,
              viewport,
              motion,
              escaped,
              errors,
              evidence: [
                "configured entry metadata and social image",
                "retained documentation omits protected screenshots",
                "setup boundary",
                "fictional populated pipeline",
                "filtered empty state",
                "saved demo branding survives reload",
              ],
            },
            null,
            2,
          ),
        );
      } catch (error) {
        await page.screenshot({ path: `${output}/${label}-failure.png`, fullPage: true });
        writeFileSync(
          `${output}/${label}.json`,
          JSON.stringify({ passed: false, message: error.message, escaped, errors }, null, 2),
        );
        throw error;
      } finally {
        await context.close();
      }
      continue;
    }
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    assert.equal((await page.goto(base + "/roadmap")).status(), 200);
    await page.getByText("No workspace data is connected.", { exact: false }).waitFor();
    const demo = page.getByRole("link", { name: "Explore the fictional Command Center" });
    await demo.focus();
    assert.equal(await demo.evaluate((el) => el === document.activeElement), true);
    assert.equal(await page.getByRole("heading", { name: "Got an idea?" }).count(), 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
      true,
    );
    await demo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
    await demo.press("Enter");
    await page.waitForURL("**/demo/command-center/northline-roofing**");
    await page
      .getByText("Northline Roofing", { exact: false })
      .filter({ visible: true })
      .first()
      .waitFor();
    assert.equal(errors.length, 0, errors.join("\n"));
    assert.equal((await page.goto(base + "/docs/self-hosting/overview")).status(), 200);
    await page.goto(base + "/admin");
    await page.getByRole("heading", { name: "Connect your Supabase project" }).waitFor();
    assert.equal(errors.length, 0, errors.join("\n"));
    await context.close();
  }
  console.log(
    "PASS: credential-free roadmap, demo navigation, setup docs, admin setup boundary, desktop/mobile, keyboard, reduced motion, console, overflow.",
  );
} finally {
  await browser.close();
}
