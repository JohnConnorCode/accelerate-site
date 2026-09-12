import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";

// Render the actual response component with production CSS and controlled HTTP
// responses. Native lifecycle/route tests separately prove persistence semantics.
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const output = "/tmp/accelerate-proposal-decisions";
mkdirSync(output, { recursive: true });
const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {ProposalDecision} from './src/components/proposal/ProposalDecision';
      createRoot(document.getElementById('root')).render(React.createElement(ProposalDecision,{token:'fictional-proposal',status:'sent'}));`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(base);
    const styles = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) => links.map((link) => link.href));
    assert.ok(styles.length, "Use the application production CSS");
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const requests = [];
    let outcome = "declined",
      responseStatus = 200;
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const expectedExpiryResponse =
        responseStatus === 410 &&
        message.location().url === `${base}/api/proposal/fictional-proposal` &&
        /\b410\b/.test(message.text());
      if (!expectedExpiryResponse) errors.push(message.text());
    });
    await page.route("**/api/proposal/fictional-proposal", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        status: responseStatus,
        json:
          responseStatus === 200
            ? { success: true, status: outcome, alreadyResponded: true }
            : { error: "This proposal has expired. Contact us for an updated proposal." },
      });
    });
    await page.route("**/__qa/proposal-decision", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}</head><body style="background:#101010"><main style="max-width:768px;margin:auto;padding:24px"><h1 style="color:white;font-size:28px">Fictional customer proposal</h1><div id="root"></div></main><script>${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`,
      }),
    );
    await page.goto(`${base}/__qa/proposal-decision`);
    const decline = page.getByRole("button", { name: "Decline", exact: true });
    await decline.focus();
    await page.keyboard.press("Enter");
    const reason = page.getByRole("textbox", { name: "Reason for declining (optional)" });
    await reason.waitFor();
    assert.equal(await reason.getAttribute("maxlength"), "1000");
    assert.equal(await reason.inputValue(), "");
    await page.screenshot({ path: `${output}/${width}-optional-reason.png`, fullPage: true });
    await page.getByRole("button", { name: "Confirm decline", exact: true }).click();
    await page.getByRole("heading", { name: "Proposal declined", exact: true }).waitFor();
    assert.deepEqual(requests.at(-1), { decision: "declined" });
    await page.screenshot({ path: `${output}/${width}-declined.png`, fullPage: true });
    await page.reload();
    outcome = "accepted";
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    await page.getByRole("button", { name: "Confirm decline", exact: true }).click();
    await page.getByRole("heading", { name: "Proposal accepted", exact: true }).waitFor();
    await page.screenshot({ path: `${output}/${width}-settled-replay.png`, fullPage: true });
    await page.reload();
    responseStatus = 410;
    await page.getByRole("button", { name: "Accept proposal", exact: true }).click();
    await page
      .getByText("This proposal has expired. Contact us for an updated proposal.", { exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "Proposal accepted", exact: true }).count(),
      0,
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    results.push({
      width,
      result: "passed",
      proof:
        "Actual component, production CSS, synthetic HTTP outcomes; optional blank submission, keyboard, authoritative replay, expiry error, no overflow or page errors",
    });
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${output}/summary.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
