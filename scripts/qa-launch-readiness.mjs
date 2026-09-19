import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const output = "/tmp/accelerate-launch-readiness-qa";
const production = process.env.LAUNCH_QA_MODE === "production";
const port = "3049",
  base = `http://localhost:${port}`;
const themes = JSON.parse(await readFile("src/lib/admin/themes.json", "utf8"));
await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    production ? "start" : "dev",
    ...(production ? [] : ["--webpack"]),
    "--port",
    port,
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_DIST_DIR: production ? ".next" : ".next-launch-qa" },
  },
);
let log = "",
  browser;
server.stdout.on("data", (chunk) => (log += chunk));
server.stderr.on("data", (chunk) => (log += chunk));
const results = [],
  errors = [];
try {
  for (let i = 0; i < 120 && !log.includes("Ready in"); i++) {
    if (server.exitCode !== null) throw new Error(log);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(log.includes("Ready in"), "QA server ready");
  // Compile routes before timing client navigation. Cold dev compilations can
  // trigger Fast Refresh while a rewrite-backed navigation is in flight.
  for (const path of [
    "/demo/command-center/northline-roofing/site/website",
    "/demo/command-center/northline-roofing/site/website/preview?page=home",
    "/site-preview",
    "/demo/command-center/northline-roofing/features",
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.ok(response.ok, `QA route ready: ${path}`);
    await response.text();
  }
  browser = await chromium.launch({ headless: true });
  for (const theme of process.env.LAUNCH_QA_SECTION === "website" ? [] : themes)
    for (const density of ["comfortable", "compact"]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        ({ theme, density }) => {
          sessionStorage.setItem("accelerate:admin-demo:superdebate:appearance:v1", theme);
          sessionStorage.setItem(
            "accelerate:admin-demo:superdebate:v3",
            JSON.stringify({ moduleOverrides: { "form-builder": true } }),
          );
          localStorage.setItem("accelerate:admin:density:v1", density);
          // Controlled transport around real UI, not a claim of a live form workflow.
          const form = {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Roof inspection request",
            description: "Controlled fictional form",
            status: "draft",
            share_token: "a".repeat(64),
            published_at: null,
            updated_at: "2026-09-19T00:00:00Z",
            schema: {
              title: "Roof inspection request",
              elements: [
                {
                  name: "email",
                  title: "Work email",
                  type: "text",
                  inputType: "email",
                  isRequired: true,
                },
                {
                  name: "topic",
                  title: "Inspection type",
                  type: "dropdown",
                  choices: ["Routine", "Storm damage"],
                },
                { name: "message", title: "What should we inspect?", type: "comment" },
              ],
            },
          };
          const wrap = (next) => async (input, init) => {
            const url = new URL(
              typeof input === "string" ? input : (input.url ?? input.href),
              location.href,
            );
            if (url.pathname === "/api/admin/forms") {
              if ((init?.method ?? "GET") === "POST")
                return Response.json(
                  { error: "Form changed. Reload before saving." },
                  { status: 409 },
                );
              return Response.json(
                url.searchParams.has("view") ? { submissions: [] } : { forms: [form] },
              );
            }
            if (url.pathname === "/api/admin/site/delegations")
              return Response.json(
                url.searchParams.has("authorization_id")
                  ? {
                      authorization: {
                        authorization_id: "controlled",
                        client: {
                          id: "22222222-2222-4222-8222-222222222222",
                          name: "Controlled ChatGPT client",
                        },
                        scope: "openid email",
                        redirect_uri: "https://chatgpt.com/connector_platform/oauth/callback",
                      },
                    }
                  : { resource: `${location.origin}/api/mcp/site-studio`, delegations: [] },
              );
            return next(input, init);
          };
          let wrapped = wrap(window.fetch.bind(window));
          Object.defineProperty(window, "fetch", {
            configurable: true,
            get: () => wrapped,
            set: (value) => {
              wrapped = wrap(value);
            },
          });
        },
        { theme: theme.id, density },
      );
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return url.origin !== base || url.pathname.startsWith("/api/")
          ? route.abort()
          : route.continue();
      });
      page.setDefaultTimeout(20000);
      await page.goto(`${base}/demo/command-center/superdebate/forms`, { timeout: 120000 });
      await page.getByRole("button", { name: "Edit", exact: true }).first().click();
      await page.locator(".sd-root-modern").waitFor();
      await page.locator(".sd-root-modern .sd-formbox").first().waitFor();
      const measurements = await page.locator(".sd-root-modern").evaluate((root) => {
        const style = getComputedStyle(root),
          shell = getComputedStyle(document.querySelector(".admin-shell"));
        const field = root.querySelector(".sd-formbox"),
          question = root.querySelector(".sd-question");
        return {
          theme: document.documentElement.dataset.theme,
          density: document.documentElement.dataset.adminDensity,
          ink: style.color,
          fieldRadius: getComputedStyle(field).borderRadius,
          radius: shell.getPropertyValue("--admin-control-radius").trim(),
          questionBackground: getComputedStyle(question).backgroundColor,
          surface: shell.getPropertyValue("--admin-surface").trim(),
        };
      });
      assert.equal(measurements.theme, theme.id);
      assert.equal(measurements.density, density);
      assert.notEqual(measurements.ink, "rgba(0, 0, 0, 0)");
      assert.equal(
        measurements.fieldRadius,
        measurements.radius,
        "SurveyJS control geometry follows the shared token",
      );
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${theme.id}/${density}/${width}: overflow`,
        );
        await page.screenshot({
          path: `${output}/forms-${theme.id}-${density}-${width}.png`,
          fullPage: true,
        });
        if (width === 390) {
          await page.locator(".sd-root-modern").scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${output}/survey-${theme.id}-${density}-390.png` });
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      const title = page.getByLabel("Form title shown to respondents", { exact: true });
      await title.fill("Unsaved local title");
      await page.getByRole("button", { name: "Save draft", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Form changed" }).waitFor();
      assert.equal(
        await title.inputValue(),
        "Unsaved local title",
        "conflict preserves local editing",
      );
      await title.focus();
      await page.keyboard.press("Tab");
      assert.ok(
        await page.evaluate(() => document.activeElement !== document.body),
        "keyboard navigation",
      );
      results.push({ theme: theme.id, density, ...measurements });
      if (theme.id === themes.at(-1).id && density === "compact") {
        await page.goto(
          `${base}/demo/command-center/superdebate/site/connect?authorization_id=controlled`,
        );
        await page.getByRole("button", { name: "Allow Site Studio control for 30 days" }).waitFor();
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 1000 });
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          await page.screenshot({ path: `${output}/connection-consent-${width}.png` });
        }
      }
      await context.close();
    }
  assert.deepEqual(errors, []);
  if (results.length)
    await writeFile(
      `${output}/results.json`,
      JSON.stringify(
        { results, errors, mode: "controlled UI transport; no live database or provider" },
        null,
        2,
      ),
    );
  if (results.length)
    console.log(
      `PASS: ${results.length} appearance/density combinations, desktop/mobile forms, retained edits, keyboard and reduced motion. Screenshots: ${output}`,
    );
  await browser.close();
  browser = null;
  process.env.PLAYWRIGHT_BASE_URL = base;
  await import("./qa-website-editor.mjs");
  await import("./qa-website-authoring.mjs");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await writeFile(`${output}/server.log`, log);
}
