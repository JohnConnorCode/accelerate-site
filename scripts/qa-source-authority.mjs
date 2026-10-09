import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-source-authority";
const failures = [],
  checks = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, timezoneId: "America/Chicago" });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/admin"))
          failures.push(`${label}: demo escaped its fictional runtime`);
      });
      const url = `${base}/demo/command-center/northline-roofing/source-authority`;
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Registered sources" }).waitFor();
      await page.getByText("Canonical CRM", { exact: true }).waitFor();
      await page.getByText("Stale", { exact: true }).waitFor();
      await page.getByText("Slack asides", { exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2),
        false,
      );
      await page.screenshot({ path: `${output}/${label}-registry.png`, fullPage: true });
      await page.getByRole("button", { name: "Register source", exact: true }).click();
      await page.getByLabel("System key", { exact: true }).fill("reviewed_uploads");
      await page.getByLabel("Display name", { exact: true }).fill("Reviewed uploads");
      await page.getByLabel("Owner", { exact: true }).fill("reviewer@example.test");
      await page.getByLabel("Entity scope (optional)", { exact: true }).fill("document");
      const expectedDate = await page.getByLabel("Last verified", { exact: true }).inputValue();
      await page.getByLabel("Display name", { exact: true }).focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .getByLabel("Truth domains", { exact: true })
          .evaluate((el) => el === document.activeElement),
        true,
      );
      // Lose the reply after the fictional owner commits. This is a browser
      // transport/recovery proof, not a replacement for native database proof.
      await page.evaluate(() => {
        const original = window.fetch;
        let lost = false;
        window.fetch = async (...args) => {
          const response = await original(...args);
          if (
            !lost &&
            String(args[0]).endsWith("/source-authority") &&
            args[1]?.method === "POST"
          ) {
            lost = true;
            throw new TypeError("Injected lost save response");
          }
          return response;
        };
      });
      await page.getByRole("button", { name: "Save source", exact: true }).click();
      await page.getByRole("button", { name: "Retry same save", exact: true }).waitFor();
      assert.equal(await page.getByLabel("Display name", { exact: true }).isDisabled(), true);
      assert.equal(
        await page.getByRole("button", { name: "Cancel", exact: true }).isDisabled(),
        true,
      );
      await page.screenshot({ path: `${output}/${label}-unconfirmed.png`, fullPage: true });
      const pending = await page.evaluate(() =>
        sessionStorage.getItem("accelerate:source-authority:demo:northline-roofing"),
      );
      assert.ok(pending);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Retry same save", exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("Display name", { exact: true }).inputValue(),
        "Reviewed uploads",
      );
      await page.getByRole("button", { name: "Retry same save", exact: true }).click();
      await page.getByText("Earlier save confirmed", { exact: true }).waitFor();
      await page.getByText("Reviewed uploads", { exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() =>
          sessionStorage.getItem("accelerate:source-authority:demo:northline-roofing"),
        ),
        null,
      );
      await page.screenshot({ path: `${output}/${label}-recovered.png`, fullPage: true });
      const saved = await page.evaluate(async () =>
        (await (await fetch("/api/admin/source-authority")).json()).entries.filter(
          (entry) => entry.system_key === "reviewed_uploads",
        ),
      );
      assert.equal(saved.length, 1);
      assert.equal(saved[0].version, 1);
      assert.equal(
        await page.evaluate((value) => {
          const date = new Date(value);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        }, saved[0].last_verified_at),
        expectedDate,
        "Verification date retains the user's local calendar day",
      );
      assert.deepEqual(saved[0].applies_to, { entityTypes: ["document"] });
      checks.push(
        `${label}: registry, stale evidence, keyboard, lost-response recovery after reload, one save and no overflow`,
      );
      // An unavailable list must not look like a successful empty registry.
      await page.evaluate(() => {
        const original = window.fetch;
        window.fetch = async (...args) =>
          String(args[0]).endsWith("/source-authority") &&
          (!args[1]?.method || args[1].method === "GET")
            ? Response.json({ error: "Injected unavailable list" }, { status: 503 })
            : original(...args);
      });
      await page.getByRole("button", { name: "Register source", exact: true }).click();
      await page.getByLabel("System key", { exact: true }).fill("canonical_crm");
      await page.getByLabel("Display name", { exact: true }).fill("Reviewed CRM");
      await page.getByRole("button", { name: "Save source", exact: true }).click();
      await page.getByRole("button", { name: "Reload sources", exact: true }).waitFor();
      assert.equal(await page.getByText("No sources registered.", { exact: false }).count(), 0);
      await page.screenshot({ path: `${output}/${label}-refresh-failed.png`, fullPage: true });
      checks.push(`${label}: confirmed save with explicit list-refresh failure`);
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(failures, []);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        result: "passed",
        boundary: "fictional browser runtime; transactional database proof is separate",
        checks,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ result: "passed", checks, screenshots: output }));
} finally {
  await browser.close();
}
