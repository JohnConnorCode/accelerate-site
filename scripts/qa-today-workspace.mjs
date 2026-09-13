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
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    const page = await context.newPage(),
      errors = [],
      protectedRequests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/api/admin")) protectedRequests.push(r.url());
    });
    await page.goto(base + "/demo/command-center/northline-roofing/today", {
      waitUntil: "networkidle",
    });
    await page
      .locator('[data-today-module="brief"]')
      .waitFor({ timeout: 15000 })
      .catch(async (error) => {
        await page.screenshot({ path: output + "/load-failure.png", fullPage: true });
        const read = await page.evaluate(async () => {
          try {
            return await Promise.race([
              fetch("/api/admin/revenue-os/today").then(async (r) => ({
                status: r.status,
                body: await r.json(),
              })),
              new Promise((resolve) => setTimeout(() => resolve("timeout"), 1000)),
            ]);
          } catch (e) {
            return String(e);
          }
        });
        console.log(
          JSON.stringify({
            errors,
            read,
            body: (await page.locator("body").innerText()).slice(-7000),
          }),
        );
        throw error;
      });
    await page.evaluate(() => {
      const original = window.fetch;
      window.__todayTestFetch = original;
      window.fetch = async (input, init) => {
        const path = new URL(typeof input === "string" ? input : input.url, location.origin)
          .pathname;
        if (path === "/api/admin/revenue-os/today" && window.__todayFixture)
          return Response.json(window.__todayFixture);
        return original(input, init);
      };
    });
    const heading = page.locator(".admin-page-introduction");
    assert.equal(await heading.locator(".admin-eyebrow, .admin-copy").count(), 0);
    assert.equal(await heading.getByLabel("Today view", { exact: true }).count(), 1);
    if (width === 390) {
      assert(
        await page.getByLabel("Today view", { exact: true }).evaluate((select) => {
          const css = getComputedStyle(select);
          const context = document.createElement("canvas").getContext("2d");
          context.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
          return (
            context.measureText(select.selectedOptions[0].text).width <=
            select.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)
          );
        }),
        "Default view name is clipped on mobile",
      );
    }
    assert.equal(await page.locator("[data-today-module] article svg").count(), 0);
    assert.equal(
      await page
        .locator('[data-today-module="brief"]')
        .evaluate((node) => getComputedStyle(node).backgroundImage),
      "none",
    );
    assert.equal(await page.locator('[data-today-module="brief"] a').count(), 4);
    await page.getByLabel("Today view", { exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .getByRole("button", { name: "Customize", exact: true })
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await page.mouse.move(0, 0);
    const original = await page.evaluate(async () =>
      (await window.__todayTestFetch("/api/admin/revenue-os/today")).json(),
    );
    assert.ok(original.attention.data.length);
    for (const content of ["busy", "sparse", "one", "uneven", "empty", "partial"]) {
      await page.evaluate(
        ({ original, content }) => {
          const fixture = structuredClone(original);
          const count =
            content === "busy"
              ? 20
              : content === "sparse"
                ? 2
                : ["one", "uneven"].includes(content)
                  ? 1
                  : 0;
          fixture.generatedAt = new Date().toISOString();
          for (const name of ["attention", "facts", "handling", "activity", "apps"]) {
            fixture[name].data = fixture[name].data.slice(0, count);
            fixture[name].state = count ? "ready" : "empty";
          }
          if (content === "uneven") {
            fixture.handling.data = original.handling.data;
            fixture.handling.data[0] = {
              ...fixture.handling.data[0],
              status: "pending",
              nextCheckAt: new Date().toISOString(),
              nextCheckReason: "Source unavailable. Retrying in five minutes.",
              outcome: "Source unavailable.",
            };
          }
          if (content === "partial") {
            fixture.attention.state = "unavailable";
            fixture.attention.message = "Tasks are temporarily unavailable.";
            fixture.facts.state = "partial";
          }
          window.__todayFixture = fixture;
        },
        { original, content },
      );
      await page.getByRole("button", { name: "Refresh Today", exact: true }).click();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      if (await page.getByRole("button", { name: "Show updates", exact: true }).count())
        await page.getByRole("button", { name: "Show updates", exact: true }).click();
      await page.screenshot({
        path: output + "/" + width + "-" + content + ".png",
        fullPage: true,
      });
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll("[data-today-workspace]")].some(
          (node) => node.scrollWidth > node.clientWidth + 2,
        ),
      );
      assert.equal(overflow, false, width + " " + content + " overflows");
      if (content === "uneven") {
        assert.equal(
          await page.getByText("Source unavailable.", { exact: true }).count(),
          0,
          "Handling outcome repeats the same retry reason",
        );
        assert.equal(
          await page.getByText(/Source unavailable\. Retrying in five minutes\./).count(),
          1,
        );
      }
      const flow = await page.evaluate(() => {
        const modules = [...document.querySelectorAll("[data-today-module]")];
        const attention = document.querySelector('[data-today-module="attention"]');
        const changes = document.querySelector('[data-today-module="changes"]');
        return {
          order: modules.map((node) => node.dataset.todayModule),
          gap: changes.getBoundingClientRect().top - attention.getBoundingClientRect().bottom,
          sectionGap: parseFloat(
            getComputedStyle(attention).getPropertyValue("--admin-section-gap"),
          ),
        };
      });
      if (width >= 1200) {
        assert(
          Math.abs(flow.gap - flow.sectionGap) <= 1,
          `${content}: primary column reserves a blank row`,
        );
      } else {
        assert.deepEqual(flow.order, [
          "brief",
          "attention",
          "handling",
          "changes",
          "upcoming",
          "ai",
          "apps",
        ]);
      }
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
    assert.match(
      await page.getByLabel("Today view", { exact: true }).locator("option:checked").innerText(),
      /Focused day/,
    );
    await page.getByLabel("View actions", { exact: true }).selectOption("duplicate");
    await page.getByLabel("View name", { exact: true }).fill("Cancelled draft");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("dialog", { name: "Customize Today" }).waitFor({ state: "hidden" });
    assert.equal(
      await page
        .getByLabel("Today view", { exact: true })
        .locator("option")
        .filter({ hasText: "Cancelled draft" })
        .count(),
      0,
    );
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
} finally {
  await browser.close();
}
