import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3023";
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"])
  if (!process.env[key]) throw new Error(`${key} is required`);
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const key = `sb-${projectRef}-auth-token`;
async function createAuthCookies() {
  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: process.env.ADMIN_EMAIL,
  });
  if (linkError || !link.properties?.hashed_token)
    throw linkError || new Error("Could not create QA session");
  const { data: verified, error: verifyError } = await service.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verified.session)
    throw verifyError || new Error("Could not verify QA session");
  const value = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
  return value.length <= 3180
    ? [{ name: key, value }]
    : Array.from({ length: Math.ceil(value.length / 3180) }, (_, index) => ({
        name: `${key}.${index}`,
        value: value.slice(index * 3180, (index + 1) * 3180),
      }));
}

const output = "/private/tmp/accelerate-report-plugins";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const cookies = await createAuthCookies();
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addCookies(
      cookies.map((cookie) => ({
        ...cookie,
        domain: new URL(base).hostname,
        path: "/",
        sameSite: "Lax",
      })),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !/422|favicon/.test(message.text()))
        errors.push(message.text());
    });
    const enabled = new Set();
    let failNext = false;
    let writes = 0;
    await page.route("**/api/admin/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const json = (body) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (path === "/api/admin/tenant/modules") {
        if (request.method() === "PATCH") {
          const body = request.postDataJSON();
          writes++;
          if (body.enabled) enabled.add(body.moduleId);
          else enabled.delete(body.moduleId);
        }
        return json({ modules: [...enabled], overrides: {}, moduleSettings: {} });
      }
      if (path === "/api/admin/plugins/run") {
        const { pluginId } = request.postDataJSON();
        assert.ok(enabled.has(pluginId), "UI attempted a disabled report");
        if (failNext) {
          failNext = false;
          return route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({ error: "Report source unavailable. No result was published." }),
          });
        }
        return json({
          summary: "One finding from fictional QA records.",
          totalFindings: 1,
          items: [
            {
              source: "records",
              id: "qa-record-1",
              title: "Example customer follow-up",
              detail: "A stored commitment needs review.",
              severity: "attention",
            },
          ],
          receipt: {
            runId: "qa-run",
            pluginId,
            sha256: "fixture",
            inspectedRows: 5,
            truncated: false,
            generatedAt: new Date().toISOString(),
            elapsedMs: 4,
          },
        });
      }
      if (!["GET", "HEAD"].includes(request.method()))
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return route.continue();
    });
    await page.goto(base + "/admin/plugins", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Plugins", exact: true }).waitFor();
    const cards = page
      .locator("[data-plugin]")
      .filter({ has: page.getByRole("button", { name: "Run report", exact: true }) });
    await cards
      .first()
      .getByRole("button", { name: /^Enable / })
      .waitFor();
    assert.equal(await cards.count(), 4);
    for (let i = 0; i < (await cards.count()); i++) {
      const card = cards.nth(i);
      assert.equal(await card.getByRole("button", { name: "Run report" }).isDisabled(), true);
      const toggle = card.getByRole("button", { name: /^Enable / });
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("[data-plugin] button")].every(
            (button) => !button.textContent.includes("Working"),
          ) && !document.querySelector("[data-plugin] button")?.disabled,
      );
      await toggle.focus();
      await page.keyboard.press("Enter");
      await card.getByRole("button", { name: /^Disable / }).waitFor();
      await card.getByRole("button", { name: "Run report" }).click();
      await card.getByText("One finding from fictional QA records.").waitFor();
      await card.getByRole("button", { name: /^Disable / }).click();
      await card.getByRole("button", { name: /^Enable / }).waitFor();
      assert.equal(await card.getByText("One finding from fictional QA records.").count(), 0);
      assert.equal(await card.getByRole("button", { name: "Run report" }).isDisabled(), true);
    }
    const first = cards.first();
    await first.getByRole("button", { name: /^Enable / }).click();
    await first.getByRole("button", { name: /^Disable / }).waitFor();
    failNext = true;
    await first.getByRole("button", { name: "Run report" }).click();
    await page.getByRole("alert").filter({ hasText: "Report source unavailable" }).waitFor();
    await page.screenshot({ path: output + "/" + name + "-error.png", fullPage: true });
    await first.getByRole("button", { name: "Run report" }).click();
    await first.getByText("One finding from fictional QA records.").waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.evaluate(() => document.querySelector(".admin-main")?.scrollTo(0, 0));
    const runColors = await first.getByRole("button", { name: "Run report" }).evaluate((el) => ({
      ink: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
    }));
    assert.notEqual(runColors.ink, runColors.background);
    await page.screenshot({ path: output + "/" + name + ".png", fullPage: true });
    assert.deepEqual(errors, []);
    assert.equal(writes, 9);
    console.log({
      viewport: name,
      plugins: 4,
      keyboard: true,
      toggles: true,
      failRetry: true,
      consoleErrors: errors.length,
      screenshots: output,
    });
    await context.close();
  }
} finally {
  await browser.close();
}
