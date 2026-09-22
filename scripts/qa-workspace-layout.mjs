import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
// Run through npm run resources:run. All edits use fictional demo session data.
const themes = JSON.parse(fs.readFileSync(resolve("src/lib/admin/themes.json"), "utf8"));
const updateDocs = process.argv.includes("--update-docs");
(async () => {
  const out = "/tmp/work-desktop-browser";
  fs.mkdirSync(out, { recursive: true });
  const log = fs.openSync(out + "/server.log", "w");
  const server = spawn(
    process.execPath,
    [require.resolve(resolve("node_modules/next/dist/bin/next")), "dev", "--webpack", "-p", "3082"],
    { stdio: ["ignore", log, log], env: { ...process.env, NODE_ENV: "development" } },
  );
  let browser;
  try {
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null) throw Error("Server exited");
      try {
        if (
          (await fetch("http://localhost:3082/demo/command-center/northline-roofing/work"))
            .status === 200
        )
          break;
      } catch {
        /* Wait for the local development server. */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    browser = await chromium.launch({ headless: true });
    for (const width of [1440, 1280, 1024, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: width === 390 ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto("http://localhost:3082/demo/command-center/northline-roofing/work", {
        waitUntil: "networkidle",
      });
      await page.locator("[data-source-type=task]").first().waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      const boxes = await page.locator("[role=search] .admin-field").evaluateAll((xs) =>
        xs.map((x) => ({
          top: x.getBoundingClientRect().top,
          width: x.getBoundingClientRect().width,
        })),
      );
      if (width >= 1280)
        assert(
          Math.max(...boxes.map((x) => x.top)) - Math.min(...boxes.map((x) => x.top)) < 2,
          JSON.stringify(boxes),
        );
      await page.screenshot({
        style: "nextjs-portal { visibility: hidden; }",
        path: out + "/" + width + ".png",
        fullPage: true,
      });
      if (width === 1440 && updateDocs) {
        await page.screenshot({
          style: "nextjs-portal { visibility: hidden; }",
          path: resolve("public/images/docs/command-center/work.png"),
        });
      }
      if (width === 1440) {
        for (const theme of themes) {
          await page.getByRole("button", { name: /^Appearance:/ }).click();
          await page.getByRole("radio", { name: new RegExp(`^${theme.label}`) }).click();
          await page.waitForFunction(
            (id) => document.documentElement.dataset.theme === id,
            theme.id,
          );
          await page.getByRole("dialog").waitFor({ state: "hidden" });
          await page.screenshot({
            style: "nextjs-portal { visibility: hidden; }",
            path: `${out}/work-${theme.id}.png`,
          });
          assert(
            await page
              .locator(".admin-main")
              .evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
          );
        }
      }
      if (width === 1440) {
        await page.getByRole("button", { name: /^Appearance:/ }).click();
        await page.getByRole("radio", { name: /^Studio/ }).click();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      }
      const search = page.getByLabel("Search tasks", { exact: true });
      await search.fill("NO_MATCH_EXPECTED");
      await page.getByText("No tasks match these filters.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Reset filters", exact: true }).click();
      await page.locator("[data-source-type=task]").first().waitFor();
      const first = page.getByRole("button", { name: /^Open task / }).first();
      await first.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Close task", exact: true }).waitFor();
      await page.getByLabel("Title", { exact: true }).fill("Polish verification task");
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await page
        .getByRole("button", { name: "Open task Polish verification task", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Complete Polish verification task", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Open task Polish verification task", exact: true })
        .waitFor({ state: "hidden" });
      if (width === 390) await page.getByRole("button", { name: "Filters", exact: true }).click();
      await page.getByLabel("Task status", { exact: true }).selectOption("completed");
      await page
        .getByRole("button", { name: "Open task Polish verification task", exact: true })
        .waitFor();
      await page.getByRole("link", { name: "Approvals", exact: true }).click();
      await page.waitForURL("**/*tab=approvals*");
      await page.goto("http://localhost:3082/demo/command-center/northline-roofing/pipeline", {
        waitUntil: "networkidle",
      });
      await page.getByLabel("View", { exact: true }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      assert.equal(await page.getByLabel("Filter by stage").isVisible(), false);
      await page.getByLabel("View", { exact: true }).selectOption("at-risk");
      await page.getByRole("button", { name: "Reset filters", exact: true }).click();
      await page.getByRole("button", { name: /^Filters/ }).click();
      await page.getByLabel("Filter by stage").selectOption("proposal");
      await page.getByRole("button", { name: "Filters (1)", exact: true }).waitFor();
      await page.getByRole("button", { name: "Filters (1)", exact: true }).click();
      assert.equal(await page.getByLabel("Filter by stage").isVisible(), false);
      await page.getByRole("button", { name: "Reset filters", exact: true }).click();
      await page.getByRole("button", { name: "List view", exact: true }).click();
      await page.getByRole("button", { name: "Board view", exact: true }).click();
      await page.getByText("View options", { exact: true }).click();
      await page.getByRole("button", { name: "Customize", exact: true }).click();
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page.getByRole("button", { name: "Save view", exact: true }).click();
      await page.getByLabel("View name").fill("QA saved view");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Save view", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert((await page.getByLabel("View", { exact: true }).inputValue()).startsWith("saved:"));
      await page
        .getByRole("button", { name: "Delete saved view QA saved view", exact: true })
        .click();
      await page.getByText("View options", { exact: true }).click();
      await page.locator(".admin-main").evaluate((el) => el.scrollTo(0, 0));
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        style: "nextjs-portal { visibility: hidden; }",
        path: out + "/pipeline-" + width + ".png",
        fullPage: true,
      });
      if (width === 1440 && updateDocs)
        await page.screenshot({
          style: "nextjs-portal { visibility: hidden; }",
          path: resolve("public/images/docs/pipeline/overview.png"),
        });
      await page.goto("http://localhost:3082/demo/command-center/northline-roofing/contacts", {
        waitUntil: "networkidle",
      });
      const from = page.getByLabel("From date", { exact: true });
      const to = page.getByLabel("To date", { exact: true });
      await from.waitFor();
      assert(
        Math.abs((await from.boundingBox()).y - (await to.boundingBox()).y) < 2,
        "Date range stays paired",
      );
      assert(await page.getByText("From", { exact: true }).isVisible());
      assert(await page.getByText("To", { exact: true }).isVisible());
      await from.fill("2099-01-01");
      await page.getByRole("button", { name: "Reset filters", exact: true }).click();
      assert.equal(await from.inputValue(), "");
      assert.equal(await to.inputValue(), "");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      await page.screenshot({
        style: "nextjs-portal { visibility: hidden; }",
        path: `${out}/contacts-${width}.png`,
      });
      if (width === 1440 && updateDocs)
        await page.screenshot({
          style: "nextjs-portal { visibility: hidden; }",
          path: resolve("public/images/docs/contacts/overview.png"),
        });
      await page.goto(
        "http://localhost:3082/demo/command-center/northline-roofing/contacts/lena.walsh%40northlineroofing.example",
        { waitUntil: "networkidle" },
      );
      if (width === 1440) {
        await page.getByRole("button", { name: /^Appearance:/ }).click();
        await page.getByRole("radio", { name: /^Night/ }).click();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      }
      const timeline = page.locator("[data-contact-timeline-item]");
      await timeline.first().waitFor();
      const cards = await timeline.locator(".admin-timeline-card").evaluateAll((els) =>
        els.map((el) => ({
          top: el.getBoundingClientRect().top,
          bottom: el.getBoundingClientRect().bottom,
        })),
      );
      assert(cards.length > 1);
      for (let i = 1; i < cards.length; i++)
        assert(cards[i].top - cards[i - 1].bottom >= 8, "Timeline cards need a visible gap");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      const timelineLink = timeline.first().getByRole("link");
      await timelineLink.focus();
      assert(await timelineLink.evaluate((el) => el === document.activeElement));
      await timeline.first().scrollIntoViewIfNeeded();
      // Allow the shared, bounded route entrance to settle before recording pixels.
      await page.waitForTimeout(500);
      await page.screenshot({
        style: "nextjs-portal { visibility: hidden; }",
        path: `${out}/timeline-${width}.png`,
      });
      const href = await timelineLink.getAttribute("href");
      assert(href.includes("/demo/command-center/northline-roofing/"));
      await page.keyboard.press("Enter");
      await page.waitForURL((url) => url.pathname + url.search === href);
      assert.deepEqual(errors, []);
      await context.close();
      console.log("Passed width", width);
    }
    fs.writeFileSync(
      out + "/receipt.json",
      JSON.stringify({
        passed: true,
        widths: [1440, 1280, 1024, 390],
        checks: [
          "toolbar geometry",
          "no overflow",
          "search/reset",
          "keyboard dialog",
          "demo edit/save/complete",
          "completed filter",
          "approvals navigation",
          "pipeline view selection, active filters, reset and board/list",
          "pipeline customize and saved view lifecycle",
          "labeled contact date range, paired alignment and reset",
          "timeline spacing, keyboard focus and source navigation",
          "no runtime or console errors",
        ],
        boundary: "Fictional session only; no production writes",
      }),
    );
  } finally {
    await browser?.close();
    if (server.exitCode === null) {
      await new Promise((r) => {
        server.once("exit", r);
        server.kill("SIGTERM");
      });
    }
    fs.closeSync(log);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
