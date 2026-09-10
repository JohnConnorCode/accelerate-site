import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3043";
const output = process.env.TODAY_QA_OUTPUT || "/tmp/accelerate-today-workspace";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 820, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: width === 390 ? "reduce" : "no-preference" });
    const page = await context.newPage(), errors = [], protectedRequests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/admin")) protectedRequests.push(r.url()); });
    await page.goto(base + "/demo/command-center/northline-roofing/today", { waitUntil: "networkidle" });
    await page.locator('[data-today-module="brief"]').waitFor({ timeout: 15000 }).catch(async (error) => {
      await page.screenshot({ path: output + "/load-failure.png", fullPage: true });
      const read = await page.evaluate(async () => {
        try { return await Promise.race([fetch("/api/admin/revenue-os/today").then(async (r) => ({ status: r.status, body: await r.json() })), new Promise((resolve) => setTimeout(() => resolve("timeout"), 1000))]); }
        catch (e) { return String(e); }
      });
      console.log(JSON.stringify({ errors, read, body: (await page.locator("body").innerText()).slice(-7000) }));
      throw error;
    });
    await page.evaluate(() => {
      const original = window.fetch;
      window.__todayTestFetch = original;
      window.fetch = async (input, init) => {
        const path = new URL(typeof input === "string" ? input : input.url, location.origin).pathname;
        if (path === "/api/admin/revenue-os/today" && window.__todayFixture) return Response.json(window.__todayFixture);
        return original(input, init);
      };
    });
    const original = await page.evaluate(async () => (await window.__todayTestFetch("/api/admin/revenue-os/today")).json());
    assert.ok(original.attention.data.length);
    for (const content of ["busy", "sparse", "one", "empty", "partial"]) {
      await page.evaluate(({ original, content }) => {
        const fixture = structuredClone(original);
        const count = content === "busy" ? 20 : content === "sparse" ? 2 : content === "one" ? 1 : 0;
        fixture.generatedAt = new Date().toISOString();
        for (const name of ["attention", "facts", "handling", "activity", "apps"]) {
          fixture[name].data = fixture[name].data.slice(0, count);
          fixture[name].state = count ? "ready" : "empty";
        }
        if (content === "partial") { fixture.attention.state = "unavailable"; fixture.attention.message = "Tasks are temporarily unavailable."; fixture.facts.state = "partial"; }
        window.__todayFixture = fixture;
      }, { original, content });
      await page.getByRole("button", { name: "Refresh Today", exact: true }).click();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      if (await page.getByRole("button", { name: "Show updates", exact: true }).count())
        await page.getByRole("button", { name: "Show updates", exact: true }).click();
      await page.screenshot({ path: output + "/" + width + "-" + content + ".png", fullPage: true });
      const overflow = await page.evaluate(() => [...document.querySelectorAll("[data-today-workspace]")].some((node) => node.scrollWidth > node.clientWidth + 2));
      assert.equal(overflow, false, width + " " + content + " overflows");
      results.push({ width, content, overflow });
    }
    // Compose, save, reload and independently duplicate a personal view.
    await page.getByRole("button", { name: "Customize", exact: true }).click();
    await page.getByLabel("View name", { exact: true }).fill("Focused day");
    await page.getByLabel("Save for", { exact: true }).selectOption("personal");
    await page.getByLabel("Open this view by default").check();
    await page.getByRole("button", { name: "Move attention up", exact: true }).click();
    await page.screenshot({ path: output + "/" + width + "-editor.png" });
    await page.getByRole("button", { name: "Save view", exact: true }).click();
    await page.getByRole("dialog", { name: "Customize Today" }).waitFor({ state: "hidden" });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-today-module="brief"]').waitFor();
    assert.match(await page.getByLabel("Today view", { exact: true }).locator("option:checked").innerText(), /Focused day/);
    await page.getByRole("button", { name: "Duplicate view", exact: true }).click();
    await page.getByLabel("View name", { exact: true }).fill("Cancelled draft");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("dialog", { name: "Customize Today" }).waitFor({ state: "hidden" });
    assert.equal(await page.getByLabel("Today view", { exact: true }).locator("option").filter({ hasText: "Cancelled draft" }).count(), 0);
    const task = page.locator('[data-attention-kind="work"]').first();
    if (await task.count()) {
      await task.getByRole("button", { name: /^Inspect / }).click();
      await page.getByRole("heading", { name: "Why this matters" }).waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog", { name: "Work context" }).waitFor({ state: "hidden" });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(protectedRequests, []);
    await context.close();
  }
  writeFileSync(output + "/results.json", JSON.stringify({ result: "passed", results }, null, 2));
  console.log(JSON.stringify({ result: "passed", cases: results.length, output }));
} finally { await browser.close(); }
