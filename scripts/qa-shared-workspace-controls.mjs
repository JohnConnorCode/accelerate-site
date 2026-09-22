import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045";
const output = process.env.QA_OUTPUT || "/tmp/shared-workspace-controls";
const themes = JSON.parse(await readFile("src/lib/admin/themes.json", "utf8"));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const route = (path) => `${base}/demo/command-center/northline-roofing/${path}`;
try {
  for (const width of [1440, 390]) {
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
        hasTouch: width === 390,
        isMobile: width === 390,
      });
      await context.addInitScript((id) => {
        sessionStorage.setItem("accelerate:admin-demo:northline-roofing:appearance:v1", id);
      }, theme.id);
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(120000);
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto(route("setup"));
      const readiness = page.locator(".admin-surface-ink");
      await readiness.waitFor();
      await page.waitForFunction((id) => document.documentElement.dataset.theme === id, theme.id);
      const accessibility = await new AxeBuilder({ page })
        .include(".admin-surface-ink")
        .withRules(["color-contrast"])
        .analyze();
      assert.deepEqual(accessibility.violations, [], `${theme.id}/${width}: rendered contrast`);
      const contrast = await readiness.evaluate((surface) => {
        const rgb = (value) =>
          value
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number);
        const luminance = (values) =>
          values
            .map((x) => {
              const v = x / 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
        const background = luminance(rgb(getComputedStyle(surface).backgroundColor));
        return [...surface.querySelectorAll("h2,p,span,svg")].map((element) => {
          const foreground = luminance(rgb(getComputedStyle(element).color));
          return {
            text: element.textContent,
            ratio:
              (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
          };
        });
      });
      assert(
        contrast.every((x) => x.ratio >= 4.5),
        JSON.stringify({ theme: theme.id, width, contrast }),
      );
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      await page.waitForTimeout(500); // Capture committed pixels after existing page transitions.
      await page.screenshot({
        path: `${output}/setup-${theme.id}-${width}.png`,
        style: "nextjs-portal {visibility:hidden}",
      });
      await page.goto(route("clients"));
      const field = page.getByLabel("Search clients", { exact: true });
      await field.waitFor();
      const geometry = await field.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          height: el.getBoundingClientRect().height,
          radius: style.borderRadius,
          expected: style.getPropertyValue("--admin-control-radius").trim(),
        };
      });
      assert(geometry.height >= (width === 390 ? 44 : 40));
      assert.equal(geometry.radius, geometry.expected);
      await page.getByLabel("Filter by status", { exact: true }).focus();
      await page.keyboard.press("Tab");
      assert(
        await field.evaluate(
          (el) => document.activeElement === el && getComputedStyle(el).boxShadow !== "none",
        ),
      );
      await field.fill("no-client-with-this-name");
      await page.waitForTimeout(250);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      await page.waitForTimeout(500); // Capture committed pixels after existing page transitions.
      await page.screenshot({
        path: `${output}/clients-${theme.id}-${width}.png`,
        style: "nextjs-portal {visibility:hidden}",
      });
      assert.deepEqual(errors, []);
      results.push({ theme: theme.id, width, contrast, geometry, keyboardFocus: "passed" });
      await context.close();
    }
  }
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of ["analytics", "campaigns", "integrations", "proposals"]) {
      await page.goto(route(path));
      if (path === "campaigns")
        await page.getByRole("button", { name: "New campaign", exact: true }).click();
      await page.locator(".admin-field").first().waitFor();
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
        `${path}/${width}: overflow`,
      );
      await page.waitForTimeout(500); // Capture committed pixels after existing page transitions.
      await page.screenshot({
        path: `${output}/${path}-${width}.png`,
        style: "nextjs-portal {visibility:hidden}",
      });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    window.__qaFailRelationship = true;
    let handler = window.fetch;
    Object.defineProperty(window, "fetch", {
      configurable: true,
      get: () => {
        const currentHandler = handler;
        return (...args) => {
          const url = String(args[0] instanceof Request ? args[0].url : args[0]);
          if (window.__qaFailRelationship && url.includes("/api/admin/contacts/timeline"))
            return Promise.resolve(
              new Response(JSON.stringify({ error: "Relationship temporarily unavailable" }), {
                status: 503,
                headers: { "content-type": "application/json" },
              }),
            );
          return currentHandler.apply(window, args);
        };
      },
      set: (next) => {
        handler = next;
      },
    });
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(60000);
  await page.goto(route("contacts/lena.walsh%40northlineroofing.example"));
  await page.getByRole("heading", { name: "We couldn’t load this information" }).waitFor();
  assert.equal(
    await page.getByText("No interactions found for this contact", { exact: true }).count(),
    0,
  );
  await page.waitForTimeout(500); // Capture committed pixels after existing page transitions.
  await page.screenshot({
    path: `${output}/relationship-error.png`,
    style: "nextjs-portal {visibility:hidden}",
  });
  await page.evaluate(() => {
    window.__qaFailRelationship = false;
  });
  await page.getByRole("button", { name: "Retry", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByText("Confirm the Walsh inspection window", { exact: true }).waitFor();
  await page.waitForTimeout(500); // Capture committed pixels after existing page transitions.
  await page.screenshot({
    path: `${output}/relationship-recovered.png`,
    style: "nextjs-portal {visibility:hidden}",
  });
  results.push({ relationshipFailureAndRetry: "passed" });
  await context.close();
  await writeFile(`${output}/receipt.json`, JSON.stringify({ status: "passed", results }, null, 2));
  console.log(`Shared controls: ${results.length} cases passed. Evidence: ${output}`);
} finally {
  await browser.close();
}
