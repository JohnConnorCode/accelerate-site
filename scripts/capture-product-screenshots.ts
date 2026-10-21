/** Refresh the public product gallery from the actual local demo UI.
 * Run with the resource-gated local QA owner: QA_FOCUS=product npm run qa:admin-polish.
 * For one screen, pass --only followed by its exact demo path to this script.
 * No customer records, external providers or authenticated admin API are used. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PRODUCT_SCREENSHOTS } from "../src/content/product-screenshots";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045";
const origin = new URL(base).origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex < 0 ? null : process.argv[onlyIndex + 1];
assert.ok(onlyIndex < 0 || only, "--only requires an exact demo path");
const shots = PRODUCT_SCREENSHOTS.filter((shot) => !only || shot.demoHref === only);
assert.ok(shots.length, "No product screenshot matches the selected demo path");
const themes: Record<string, string> = {
  Paper: "light",
  Night: "dark",
  Accelerate: "accelerate",
  Operator: "operator",
};
async function main() {
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const receipt: {
    sourceCommit: string;
    baseUrl: string;
    capturedAt: string;
    deviceScaleFactor: number;
    screenshots: Array<{ route: string; theme: string; file: string; sha256: string }>;
  } = {
    sourceCommit,
    baseUrl: base,
    capturedAt: new Date().toISOString(),
    deviceScaleFactor: 2,
    screenshots: [],
  };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const shot of shots) {
      const scenario = shot.demoHref.split("/")[3];
      const label = shot.caption?.split(" · ")[1]?.replace(" theme", "") || "";
      const theme = themes[label];
      assert.ok(theme, `Unknown screenshot appearance: ${label}`);
      const context = await browser.newContext({
        viewport: { width: shot.width!, height: shot.height! },
        reducedMotion: "reduce",
        deviceScaleFactor: 2,
        serviceWorkers: "block",
      });
      await context.addInitScript(
        ({ scenario, theme }) => {
          if (window.top !== window) return;
          sessionStorage.setItem(`accelerate:admin-demo:${scenario}:appearance:v1`, theme);
          localStorage.setItem(`accelerate:demo-theme:${scenario}`, theme);
        },
        { scenario, theme },
      );
      const page = await context.newPage();
      const errors: string[] = [];
      const escaped: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && !message.text().includes("favicon")) {
          errors.push(message.text());
        }
      });
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
        if (url.origin === origin && url.pathname === "/api/analytics/events") {
          return route.fulfill({ status: 204 });
        }
        if (url.origin !== origin || url.pathname.startsWith("/api/")) {
          escaped.push(url.origin + url.pathname);
          return route.abort();
        }
        return route.continue();
      });
      await page.goto(`${base}${shot.demoHref}`, { waitUntil: "domcontentloaded" });
      await page.locator(".admin-page-title, .admin-page-header h1").first().waitFor();
      await page.waitForFunction(
        (theme) =>
          document.documentElement.dataset.theme === theme &&
          document.documentElement.dataset.motionHydrated === "true",
        theme,
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      });
      await page.waitForFunction(() => {
        return (
          [...document.querySelectorAll('main [aria-busy="true"]')].every(
            (element) =>
              !element.getClientRects().length || getComputedStyle(element).visibility === "hidden",
          ) &&
          [...document.querySelectorAll('main p, main [role="status"]')].every(
            (element) =>
              !element.getClientRects().length ||
              getComputedStyle(element).visibility === "hidden" ||
              !/^(?:Loading(?:[ .…]|$)|Checking…$)/.test(element.textContent?.trim() || ""),
          ) &&
          [...document.querySelectorAll<HTMLImageElement>("main img")].every(
            (element) => element.complete && element.naturalWidth > 0,
          )
        );
      });
      if (shot.demoHref === "/demo/command-center/hearthline-realty/site") {
        await page.getByLabel("Service name", { exact: true }).fill("Property inquiry follow-up");
        await page.getByLabel("Audience", { exact: true }).fill("Home buyers and sellers");
        await page
          .getByLabel("Outcome", { exact: true })
          .fill("Respond to property inquiries and arrange the next viewing");
        await page
          .getByLabel("Page address (optional)", { exact: true })
          .fill("property-inquiries");
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        });
      }
      assert.doesNotMatch(
        await page.locator("main").first().innerText(),
        /fictional\s+workspaces?/i,
        `${shot.demoHref}: obsolete demo notice is visible`,
      );
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${shot.demoHref}: workspace overflows the capture viewport`,
      );
      const demoLabels = await page.getByText(/^Demo(?: workspace)?$/i).all();
      assert.ok(
        (await Promise.all(demoLabels.map((label) => label.isVisible()))).some(Boolean),
        `${shot.demoHref}: compact demo identity remains visible`,
      );
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      assert.deepEqual(escaped, [], `${shot.demoHref}: request reached protected network`);
      assert.deepEqual(errors, [], `${shot.demoHref}: runtime errors`);
      const target = path.resolve(`public${shot.src}`);
      mkdirSync(path.dirname(target), { recursive: true });
      await page.screenshot({ path: target });
      assert.deepEqual(escaped, [], `${shot.demoHref}: request escaped during capture`);
      assert.deepEqual(errors, [], `${shot.demoHref}: runtime error during capture`);
      receipt.screenshots.push({
        route: shot.demoHref,
        theme,
        file: shot.src,
        sha256: createHash("sha256").update(readFileSync(target)).digest("hex"),
      });
      console.log(`Captured ${shot.demoHref} · ${label} → ${shot.src}`);
      await context.close();
    }
    if (process.env.PRODUCT_SCREENSHOT_RECEIPT) {
      const target = path.resolve(process.env.PRODUCT_SCREENSHOT_RECEIPT);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, JSON.stringify(receipt, null, 2) + "\n");
    }
  } finally {
    await browser.close();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
