/** Refresh the public product gallery from the exact local fictional demo.
 * Run with the resource-gated local QA owner: QA_FOCUS=product npm run qa:admin-polish.
 * For one screen, pass --only followed by its exact demo path to this script.
 * No customer records, external providers or authenticated admin API are used. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
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
  Signal: "signal",
  Studio: "studio",
  Frost: "frost",
};
async function main() {
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
        deviceScaleFactor: 1,
      });
      await context.addInitScript(
        ({ scenario, theme }) => {
          sessionStorage.setItem(`accelerate:admin-demo:${scenario}:appearance:v1`, theme);
          localStorage.setItem(`accelerate:demo-theme:${scenario}`, theme);
        },
        { scenario, theme },
      );
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
        return url.origin === origin && !url.pathname.startsWith("/api/admin")
          ? route.continue()
          : route.abort();
      });
      await page.goto(`${base}${shot.demoHref}`, { waitUntil: "networkidle" });
      await page.locator(".admin-page-title, .admin-page-header h1").first().waitFor();
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        theme,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      assert.deepEqual(errors, [], `${shot.demoHref}: runtime errors`);
      const target = path.resolve(`public${shot.src}`);
      mkdirSync(path.dirname(target), { recursive: true });
      await page.screenshot({ path: target });
      if (shot.demoHref === "/demo/command-center/northline-roofing/today") {
        await page.setViewportSize({ width: 1440, height: 1000 });
        const docsTarget = path.resolve("public/images/docs/command-center/today.png");
        mkdirSync(path.dirname(docsTarget), { recursive: true });
        await page.screenshot({ path: docsTarget });
      }
      console.log(`Captured ${shot.demoHref} · ${label} → ${shot.src}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
