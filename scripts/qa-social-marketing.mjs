import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdirSync, createWriteStream, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
const output = join(tmpdir(), "accelerate-social-qa");
mkdirSync(output, { recursive: true });
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3038";
const log = createWriteStream(`${output}/server.log`);
const server = process.env.PLAYWRIGHT_BASE_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--webpack",
        "--hostname",
        "localhost",
        "--port",
        "3038",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
server?.stdout.pipe(log);
server?.stderr.pipe(log);
let browser;
let activePage;
try {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/demo/command-center/northline-roofing/social`);
      if (r.ok) break;
    } catch {}
    if (i === 59) throw new Error("Social QA server did not start");
    await new Promise((r) => setTimeout(r, 1000));
  }
  browser = await chromium.launch();
  const results = [];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    context.setDefaultTimeout(20000);
    const page = await context.newPage();
    activePage = page;
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
    console.log(`Social browser ${width}px`);
    await page.goto(`${base}/demo/command-center/northline-roofing/social`);
    await page.getByRole("heading", { name: "Social Marketing", exact: true }).waitFor();
    await page.getByRole("button", { name: "New draft", exact: true }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Edit social draft" });
    await dialog.waitFor();
    assert.notEqual(
      await dialog.evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgba(0, 0, 0, 0)",
      "Editor must have an opaque themed surface",
    );
    await dialog.getByLabel("Title", { exact: true }).fill("Spring roof maintenance");
    await dialog
      .getByLabel("Post text", { exact: true })
      .fill("Keep drainage routes clear and record maintenance work.");
    const source = dialog.getByRole("group", { name: "Source supporting this post" });
    await source.getByLabel("title", { exact: true }).fill("Northline maintenance guide");
    await source.getByLabel("url", { exact: true }).fill("https://northline.example/maintenance");
    await source
      .getByLabel("excerpt", { exact: true })
      .fill("Keep drainage routes clear and record maintenance work.");
    await dialog.getByRole("button", { name: "Save draft", exact: true }).press("Enter");
    await page.getByRole("status").filter({ hasText: "1 draft saved" }).waitFor();
    await page.screenshot({ path: `${output}/drafts-${width}.png`, fullPage: true });
    if (width === 1440) {
      mkdirSync("public/images/docs/plugins", { recursive: true });
      await page.screenshot({ path: "public/images/docs/plugins/social-marketing.png" });
    }
    await page.getByRole("button", { name: "Review schedule", exact: true }).click();
    const review = page.getByRole("dialog", { name: "Review exact social changes" });
    await review.waitFor();
    assert.ok(
      await review
        .getByText("Keep drainage routes clear and record maintenance work.", { exact: true })
        .count(),
    );
    await page.screenshot({ path: `${output}/approval-${width}.png`, fullPage: true });
    await review.getByRole("button", { name: "Approve these exact changes" }).press("Enter");
    await page.getByRole("status").filter({ hasText: "Approved change recorded" }).waitFor();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    await page.getByText("scheduled", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Edit draft", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Post text", { exact: true })
      .fill("Revised maintenance advice, still awaiting approval.");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "1 draft saved" }).waitFor();
    assert.equal(await page.getByText("scheduled", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Review schedule", exact: true }).click();
    await page.getByRole("button", { name: "Approve these exact changes" }).click();
    await page.getByRole("status").filter({ hasText: "Approved change recorded" }).waitFor();
    await page.getByRole("button", { name: "Cancel schedule", exact: true }).click();
    await page.getByRole("button", { name: "Approve these exact changes" }).click();
    await page.getByRole("status").filter({ hasText: "Approved change recorded" }).waitFor();
    await page.getByText("cancelled", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Setup", exact: true }).click();
    await page.getByRole("heading", { name: "Postiz connection" }).waitFor();
    await page.screenshot({ path: `${output}/setup-${width}.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "Horizontal overflow",
    );
    await page.reload();
    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    await page.getByText("cancelled", { exact: true }).waitFor();
    assert.deepEqual(escaped, [], "Demo escaped protected transport");
    assert.deepEqual(errors, [], "Unexpected browser errors");
    results.push({
      width,
      keyboard: true,
      approval: true,
      editInvalidatesApproval: true,
      cancellation: true,
      reload: true,
      externalRequests: 0,
    });
    await context.close();
  }
  writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${output}/failure.png`, fullPage: true });
    writeFileSync(`${output}/failure.txt`, await activePage.locator("body").innerText());
  }
  throw error;
} finally {
  await browser?.close();
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("close", resolve);
      setTimeout(resolve, 5000);
    });
  }
  log.end();
}
