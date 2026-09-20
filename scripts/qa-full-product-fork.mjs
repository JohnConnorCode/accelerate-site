import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const output = "/tmp/accelerate-full-product-fork-qa";
const base = "http://localhost:3057";
const { config } = JSON.parse(await readFile(".next/required-server-files.json", "utf8"));
await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3057"],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NEXT_PUBLIC_DISTRIBUTION_PROFILE: "neutral",
      NEXT_DEPLOYMENT_ID: config.deploymentId,
    },
  },
);
let log = "",
  browser;
const results = [];
server.stdout.on("data", (chunk) => {
  log += chunk;
});
server.stderr.on("data", (chunk) => {
  log += chunk;
});
try {
  for (let i = 0; i < 120 && !log.includes("Ready in"); i++) {
    if (server.exitCode !== null) throw new Error(log);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(log.includes("Ready in"), "Production server ready");
  for (const path of [
    "/about",
    "/chicago",
    "/services",
    "/team/john-connor",
    "/images/john.jpg",
    "/%69mages/john.jpg",
    "/_next/image?url=%2Fimages%2Fjohn.jpg&w=640&q=75",
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, `${path} cannot expose agency content`);
  }
  const search = await (await fetch(`${base}/api/search`)).json();
  assert.ok(search.entries.length > 20);
  assert.ok(
    search.entries.every(
      (entry) => entry.group === "Docs" || ["/", "/demo/command-center"].includes(entry.href),
    ),
  );
  assert.match((await fetch(`${base}/apple-icon`)).headers.get("content-type"), /image\/png/);
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const errors = [],
      external = [];
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin !== base) {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(base);
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.match(await page.locator("h1").innerText(), /A home for your business/);
    assert.doesNotMatch(
      await page.locator("body").innerText(),
      /John Connor|Accelerate Agency|Book a call/i,
    );
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "No horizontal overflow",
    );
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").innerText(), "Skip to main content");
    await page.locator("h1").click();
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      accessibility.violations.map(({ id, nodes }) => ({ id, count: nodes.length })),
      [],
    );
    await page.screenshot({ path: `${output}/homepage-${width}.png`, fullPage: true });
    assert.deepEqual(external, [], "No external calls from the fresh homepage");
    assert.deepEqual(errors, [], "No browser runtime errors");
    await context.addInitScript(() => {
      let requests = 0;
      const wrap = (next) => async (input, init) => {
        const url = new URL(
          typeof input === "string" ? input : (input.url ?? input.href),
          location.href,
        );
        if (url.pathname === "/api/admin/forms") {
          requests++;
          if (requests === 1)
            return Response.json({ error: "Controlled unavailable state" }, { status: 503 });
          return Response.json({
            forms:
              requests === 2
                ? []
                : [
                    { name: "Website inquiry", status: "published", share_token: "a".repeat(64) },
                    { name: "Private draft", status: "draft", share_token: "b".repeat(64) },
                  ],
          });
        }
        return next(input, init);
      };
      let wrapped = wrap(window.fetch.bind(window));
      Object.defineProperty(window, "fetch", {
        configurable: true,
        get: () => wrapped,
        set: (next) => {
          wrapped = wrap(next);
        },
      });
    });
    await page.goto(`${base}/demo/command-center/northline-roofing/site/website`);
    await page.getByText("Bundled website loaded.", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Add page", exact: true }).click();
    const create = page.getByRole("dialog", { name: "Create a page" });
    await create
      .getByRole("textbox", { name: "Page title", exact: true })
      .fill("Website inquiries");
    await create.getByRole("button", { name: "Create draft page", exact: true }).click();
    await page.getByRole("button", { name: "Load published forms" }).click();
    await page.getByRole("alert").filter({ hasText: "Forms could not be loaded" }).waitFor();
    await page.getByRole("button", { name: "Load published forms" }).click();
    await page
      .getByText("Publish a form in this workspace, then refresh this list.", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Refresh forms" }).click();
    await page.getByLabel("Published form", { exact: true }).selectOption("a".repeat(64));
    assert.equal(
      await page.getByLabel("Published form", { exact: true }).locator("option").count(),
      2,
      "Draft forms excluded",
    );
    await page.getByRole("button", { name: "Add form section" }).click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText("Private revision 1 saved.", { exact: false }).waitFor();
    const saved = await page.evaluate(
      async () => (await (await fetch("/api/admin/site/website")).json()).website,
    );
    assert.ok(
      JSON.stringify(saved.draft.document).includes("a".repeat(64)),
      "Binding persisted through the existing draft path",
    );
    await page
      .getByRole("group", { name: "Connect a form" })
      .screenshot({ path: `${output}/form-picker-${width}.png` });
    if (width < 768) await page.getByRole("button", { name: "Preview page", exact: true }).click();
    const preview = page.frameLocator('iframe[title="Live website preview"]');
    assert.equal(
      await preview.getByRole("button", { name: /Switch to (dark|light) mode/ }).count(),
      0,
      "Preview and publication share the document-owned theme",
    );
    await preview
      .getByText("Connected form. Submissions are disabled in this preview.", { exact: true })
      .waitFor();
    assert.equal(await preview.locator("form").count(), 0, "Preview cannot submit");
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      "Connected editor fits viewport",
    );
    await page.screenshot({ path: `${output}/connected-editor-${width}.png`, fullPage: true });
    results.push({
      width,
      overflow: false,
      keyboard: "skip link",
      accessibility: "passed",
      externalRequests: external.length,
      formPicker: "failure, empty, published-only binding, private save and non-submitting preview",
    });
    await context.close();
  }
  await browser.close();
  browser = undefined;
  await new Promise((resolve, reject) => {
    const journey = spawn(process.execPath, ["scripts/qa-turnkey.mjs", "--neutral"], {
      stdio: "inherit",
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: base,
        QA_SITE_NAME: "Command Center",
        QA_SITE_URL: "http://localhost:3000",
        QA_OUTPUT: `${output}/first-use`,
      },
    });
    journey.on("error", reject);
    journey.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`First-use journey failed: ${code}`)),
    );
  });
  results.push({
    firstUse:
      "desktop/mobile CTA, direct setup, keyboard guide, accessibility, demo edits, docs, no failed requests",
  });
  console.log(JSON.stringify({ result: "passed", results, output }, null, 2));
  await writeFile(`${output}/results.json`, JSON.stringify({ result: "passed", results }, null, 2));
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    await writeFile(`${output}/failure.txt`, await page.locator("body").innerText());
  }
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await writeFile(`${output}/server.log`, log);
}
