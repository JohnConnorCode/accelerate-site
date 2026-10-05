import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3017";
const output = "/tmp/accelerate-core-release-browser";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const escaped = [],
      errors = [];
    context.route("**/api/**", (route) => {
      escaped.push(route.request().url());
      return route.abort();
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${base}/demo/command-center/northline-roofing/setup`, {
      waitUntil: "networkidle",
    });
    const button = page.getByRole("button", { name: "Check stable releases" });
    await button.focus();
    await page.keyboard.press("Enter");
    await page
      .getByText("This fictional workspace has no installed core release.", { exact: false })
      .waitFor();
    await page.getByText("Unversioned", { exact: true }).waitFor();
    assert.equal(escaped.length, 0, "Demo release check escaped to a live API");
    const card = page
      .getByRole("heading", { name: "Core releases", exact: true })
      .locator("xpath=../../..");
    await card.screenshot({ path: `${output}/${mobile ? "mobile" : "desktop"}-demo.png` });
    for (const status of ["available", "incompatible", "unavailable", "failure"]) {
      await page.evaluate(
        ({ status }) => {
          const previous = window.fetch.bind(window);
          window.fetch = async (input, init) => {
            const url =
              typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            if (!url.endsWith("/api/admin/setup/release")) return previous(input, init);
            await new Promise((resolve) => setTimeout(resolve, 300));
            if (status === "failure")
              return new Response(JSON.stringify({ error: "Controlled failure" }), { status: 503 });
            return new Response(
              JSON.stringify({
                status,
                message: `Controlled ${status} release result.`,
                checkedAt: "2026-10-05T12:00:00Z",
                installed: {
                  coreVersion: "v0.1.0",
                  coreCommit: "a".repeat(40),
                  forkCommit: "b".repeat(40),
                  customized: true,
                },
                path: status === "available" ? ["v0.2.0", "v0.3.0"] : [],
                target:
                  status === "available"
                    ? {
                        version: "v0.3.0",
                        runtime: {
                          nodeMinimum: "22.16.0",
                          npmMinimum: "10.0.0",
                          postgresMinimum: "15.0.0",
                        },
                        url: "https://github.com/JohnConnorCode/accelerate-site/releases/tag/v0.3.0",
                      }
                    : null,
              }),
              { headers: { "Content-Type": "application/json" } },
            );
          };
        },
        { status },
      );
      await button.click();
      await page.getByRole("button", { name: "Checking releases…" }).waitFor();
      assert(await page.getByRole("button", { name: "Checking releases…" }).isDisabled());
      await page.getByRole("button", { name: "Check stable releases" }).waitFor();
      if (status === "failure")
        await page.getByText("The release check failed.", { exact: false }).waitFor();
      else await page.getByText(`Controlled ${status} release result.`, { exact: true }).waitFor();
      if (status === "available") {
        await page.getByText("v0.2.0 → v0.3.0", { exact: true }).waitFor();
        assert.equal(
          await page.getByRole("link", { name: "Read v0.3.0 release notes" }).getAttribute("href"),
          "https://github.com/JohnConnorCode/accelerate-site/releases/tag/v0.3.0",
        );
      }
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        "Horizontal overflow",
      );
      await card.screenshot({ path: `${output}/${mobile ? "mobile" : "desktop"}-${status}.png` });
    }
    await page.goto(`${base}/docs/self-hosting/installation#check-core-releases`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("heading", { name: "Check core releases", exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: `${output}/${mobile ? "mobile" : "desktop"}-guide.png` });
    assert.deepEqual(errors, []);
    assert.deepEqual(escaped, []);
    results.push({
      viewport: mobile ? "390x844" : "1440x1000",
      demo: "passed",
      controlledStates: ["available", "incompatible", "unavailable", "failure"],
      keyboard: "passed",
      overflow: "none",
      consoleErrors: 0,
    });
    await context.close();
  }
  writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(
      {
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        results,
        proof:
          "Fictional demo and controlled browser states; no hosted release or owner sign-in acceptance.",
        result: "passed",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ result: "passed", results, output }));
} finally {
  await browser.close();
}
