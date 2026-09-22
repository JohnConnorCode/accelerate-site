const { createRequire } = require("node:module"),
  { resolve } = require("node:path"),
  { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
// Run through npm run resources:run. All edits use fictional demo session data.
const req = createRequire(resolve("package.json"));
const { chromium } = req("playwright");
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
      await page.screenshot({ path: out + "/" + width + ".png", fullPage: true });
      if (width === 1440) {
        await page.screenshot({ path: resolve("public/images/docs/command-center/work.png") });
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
      assert((await page.getByLabel("View", { exact: true }).inputValue()).startsWith("saved:"));
      await page
        .getByRole("button", { name: "Delete saved view QA saved view", exact: true })
        .click();
      await page.getByText("View options", { exact: true }).click();
      await page.screenshot({ path: out + "/pipeline-" + width + ".png", fullPage: true });
      if (width === 1440)
        await page.screenshot({ path: resolve("public/images/docs/pipeline/overview.png") });
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
          "no runtime errors",
        ],
        boundary: "Fictional session only; no production writes",
      }),
    );
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
    fs.closeSync(log);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
