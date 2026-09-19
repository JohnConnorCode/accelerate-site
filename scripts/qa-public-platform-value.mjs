import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const capture = process.argv.includes("--capture");
const preview = process.argv.includes("--preview");
const port = 3027;
const base = process.env.QA_BASE ?? `http://localhost:${port}`;
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Use a local fictional QA server",
);
const output = process.env.QA_OUTPUT ?? "/tmp/accelerate-platform-value-qa";
mkdirSync(output, { recursive: true });
const server = process.env.QA_BASE
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        capture || preview ? "dev" : "start",
        ...(capture || preview ? ["--webpack"] : []),
        "--port",
        String(port),
      ],
      { stdio: ["ignore", "pipe", "pipe"], env: process.env },
    );
let log = "";
server?.stdout.on("data", (chunk) => {
  log += chunk;
});
server?.stderr.on("data", (chunk) => {
  log += chunk;
});
const checks = [];
// Public analytics needs a connected database. Visual QA keeps it local and records this boundary.
async function isolateAnalytics(context) {
  await context.route("**/api/analytics/events", (route) => route.fulfill({ status: 204 }));
}
let browser;
try {
  for (let i = 0; i < 90; i++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined)
      throw new Error(`QA server exited: ${log.slice(-2000)}`);
    try {
      const response = await fetch(`${base}/robots.txt`);
      if (response.ok) break;
    } catch {
      /* server starting */
    }
    if (i === 89) throw new Error("QA server did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch();
  if (capture) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin !== new URL(base).origin || url.pathname.startsWith("/api/")
        ? route.abort()
        : route.continue();
    });
    const page = await context.newPage();
    const shots = [
      ["superdebate", "today", "public/images/demo/superdebate-today.png", "Today"],
      ["northline-roofing", "forms", "public/images/docs/plugins/forms.png", /Forms|Form builder/],
      [
        "northline-roofing",
        "subscriptions",
        "public/images/docs/plugins/subscriptions.png",
        /Subscriptions/,
      ],
      ["northline-roofing", "site", "public/images/docs/plugins/site-studio.png", /Site Studio/],
      ["northline-roofing", "learning", "public/images/docs/intelligence/learning.png", /Learning/],
    ];
    for (const [scenario, route, file, heading] of shots) {
      if (process.argv.includes("--remaining") && ["today", "subscriptions"].includes(route))
        continue;
      await page.goto(`${base}/demo/command-center/${scenario}/${route}`, {
        waitUntil: "networkidle",
        timeout: 90000,
      });
      await page.locator(".admin-shell").waitFor();
      await page.getByRole("heading", { name: heading }).first().waitFor();
      await page.getByText(/Loading forms/).waitFor({ state: "hidden" });
      await page.evaluate(() =>
        document.querySelectorAll("nextjs-portal").forEach((node) => node.remove()),
      );
      mkdirSync(join(file, ".."), { recursive: true });
      await page.screenshot({ path: file });
      console.log(`Captured ${file}`);
      checks.push({ capture: file, route });
    }
    await context.close();
  } else if (preview) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      for (const route of [
        "/command-center",
        "/demo/command-center",
        "/docs",
        "/docs/recipes/roofing-inquiry",
        "/industries/home-services",
      ]) {
        const response = await page.goto(base + route, {
          waitUntil: "networkidle",
          timeout: 90000,
        });
        assert(response?.ok(), `${route}: HTTP ${response?.status()}`);
        await page.evaluate(() =>
          document.querySelectorAll("nextjs-portal").forEach((node) => node.remove()),
        );
        await page.screenshot({
          path: `${output}/preview-${width}-${route.replaceAll("/", "_")}.png`,
          fullPage: true,
        });
        console.log(`Preview ${width} ${route}`);
      }
      await context.close();
    }
  } else {
    const industries = [
      "home-services",
      "law-firms",
      "professional-services",
      "real-estate",
      "manufacturing",
      "startups",
      "medical-dental",
      "insurance-agencies",
      "auto-dealers",
      "nonprofits",
    ];
    const scenarios = [
      "northline-roofing",
      "alder-ridge-law",
      "ledgerstone-advisory",
      "hearthline-realty",
      "common-table-network",
      "superdebate",
    ];
    for (const width of [1440, 390]) {
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          reducedMotion: "reduce",
        });
        await isolateAnalytics(context);
        await context.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        for (const route of [
          "/command-center",
          "/demo/command-center",
          "/docs",
          "/docs/recipes",
          "/docs/recipes/roofing-inquiry",
          "/industries/home-services",
          "/industries/nonprofits",
        ]) {
          const response = await page.goto(base + route, {
            waitUntil: "networkidle",
            timeout: 60000,
          });
          assert(response?.ok(), `${route}: HTTP ${response?.status()}`);
          assert(
            await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
            "Reduced motion enabled",
          );
          assert.equal(
            await page.locator("html").getAttribute("data-theme"),
            theme,
            "Requested public theme",
          );
          assert.equal(await page.locator("h1").count(), 1, `${route}: one clear page title`);
          assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            `${route}: horizontal overflow at ${width}`,
          );
          assert.equal(
            await page
              .locator("img")
              .evaluateAll(
                (images) =>
                  images.filter((image) => image.complete && image.naturalWidth === 0).length,
              ),
            0,
            `${route}: broken image`,
          );
          await page.screenshot({
            path: `${output}/${width}-${theme}-${route.replaceAll("/", "_")}.png`,
            fullPage: true,
          });
          await page.screenshot({
            path: `${output}/top-${width}-${theme}-${route.replaceAll("/", "_")}.png`,
          });
          if (route === "/command-center")
            await page
              .locator("#surface")
              .screenshot({ path: `${output}/features-${width}-${theme}.png` });
          if (route === "/industries/home-services")
            await page
              .locator("#workflow-recipes")
              .screenshot({ path: `${output}/recipes-${width}-${theme}.png` });
          if (route === "/docs/recipes/roofing-inquiry")
            assert.equal(
              await page
                .locator(".prose-docs ul")
                .first()
                .evaluate((node) => getComputedStyle(node).listStyleType),
              "none",
              "Recipe ingredients retain chip layout",
            );
          checks.push({ route, width, theme, status: "passed" });
        }
        await page.goto(`${base}/command-center`, { waitUntil: "networkidle" });
        const search = page.getByRole("searchbox", { name: "Find a capability" });
        await search.fill("invoice");
        assert((await page.locator("#capabilities details").count()) > 0);
        await search.fill("no-such-capability-93857");
        await page.getByRole("button", { name: "Clear filters" }).click();
        assert((await page.locator("#capabilities details").count()) > 10);
        await page.getByRole("button", { name: "Capture", exact: true }).click();
        assert.equal(
          await page
            .getByRole("button", { name: "Capture", exact: true })
            .getAttribute("aria-pressed"),
          "true",
        );
        const summary = page.locator("#capabilities summary").first();
        await summary.focus();
        await page.keyboard.press("Enter");
        assert(
          await page
            .locator("#capabilities details")
            .first()
            .evaluate((node) => node.open),
        );
        await page.keyboard.press("Tab");
        assert(
          await page.evaluate(() => document.activeElement !== document.body),
          "Keyboard focus remains on controls",
        );
        await page.goto(`${base}/docs`, { waitUntil: "networkidle" });
        await page.getByRole("searchbox", { name: "Search the docs" }).fill("roofing inquiry");
        const result = page
          .getByRole("region", { name: "Search documentation" })
          .getByRole("link")
          .first();
        await result.waitFor();
        assert((await result.getAttribute("href")).includes("recipes/roofing-inquiry"));
        await result.focus();
        await page.keyboard.press("Enter");
        await page.waitForURL("**/docs/recipes/roofing-inquiry");
        checks.push({
          interaction: "capability search, filters, keyboard disclosure and docs search",
          width,
          theme,
          status: "passed",
        });
        assert.deepEqual(errors, [], `${width}/${theme}: browser errors`);
        await context.close();
      }
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await isolateAnalytics(context);
    await context.addInitScript(() => {
      localStorage.setItem("theme", "dark");
      sessionStorage.setItem("accelerate:admin-demo:northline-roofing:appearance:v1", "frost");
    });
    const page = await context.newPage();
    for (const industry of industries) {
      await page.goto(`${base}/industries/${industry}`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("#workflow-recipes article").count(), 2, industry);
    }
    await page.goto(`${base}/demo/command-center`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#business-demos article").count(), 6);
    assert.equal(
      await page.locator('meta[name="robots"]').getAttribute("content"),
      "noindex, nofollow",
    );
    for (const scenario of scenarios) {
      await page.goto(`${base}/demo/command-center`, { waitUntil: "networkidle" });
      await page
        .locator(`#business-demos a[href='/demo/command-center/${scenario}/today']`)
        .click();
      await page.locator(".admin-shell").waitFor();
      assert(page.url().endsWith(`/${scenario}/today`), `Demo launch ${scenario}`);
      await page.getByRole("heading", { name: "Today", exact: true }).first().waitFor();
      assert.equal(
        await page.evaluate(() => localStorage.getItem("theme")),
        "dark",
        "Demo preserves public preference",
      );
      if (scenario === "northline-roofing") {
        await page.waitForFunction(() => document.documentElement.dataset.theme === "frost");
        await page.reload({ waitUntil: "networkidle" });
        await page.waitForFunction(() => document.documentElement.dataset.theme === "frost");
      }
      await page.goto(`${base}/demo/command-center`, { waitUntil: "networkidle" });
      assert.equal(
        await page.locator("html").getAttribute("data-theme"),
        "dark",
        "Launcher restores public appearance",
      );
      checks.push({ scenario, status: "passed" });
    }
    // Compile and render every guide, including generated component maps and old URLs.
    function docsFiles(dir, prefix = "") {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? docsFiles(join(dir, entry.name), `${prefix}${entry.name}/`)
          : entry.name.endsWith(".mdx")
            ? [`${prefix}${entry.name.slice(0, -4)}`]
            : [],
      );
    }
    for (const slug of docsFiles("src/content/docs")) {
      const response = await context.request.get(`${base}/docs/${slug}`);
      assert(response.ok(), `Docs route ${slug}`);
      const html = await response.text();
      assert(html.includes("<h1"), `Docs title ${slug}`);
      checks.push({ guide: slug, status: "passed" });
    }
    await context.close();
  }
  writeFileSync(
    `${output}/${capture ? "capture" : "results"}.json`,
    JSON.stringify(
      { status: "passed", analytics: "Local 204 stub; live analytics not tested", checks },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: "passed", checks: checks.length, output }));
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
  if (server && server.exitCode === null)
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  if (server && server.exitCode === null) server.kill("SIGKILL");
  writeFileSync(`${output}/server.log`, log);
}
