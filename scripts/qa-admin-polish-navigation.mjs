import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045",
  output = process.env.QA_OUTPUT || "/tmp/admin-polish-qa";
const browser = await chromium.launch(),
  results = [];
async function navigate(page, suffix) {
  const link = page.locator(`a[href$="/${suffix}"]`).first();
  const toggle = link
    .locator("xpath=ancestor::section[1]")
    .locator("button[aria-expanded]")
    .first();
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await link.click();
}
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`${base}/demo/command-center/superdebate/pipeline`, { timeout: 120000 });
    await page.locator("[data-opportunity-id]").first().waitFor();
    await page.evaluate(() => {
      const original = window.fetch;
      window.__navDelay = 750;
      window.__navFailure = false;
      window.__navSamples = [];
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.url || String(input);
        if (url.includes("/api/admin/content") && (!init?.method || init.method === "GET")) {
          await new Promise((resolve) => setTimeout(resolve, window.__navDelay));
          if (window.__navFailure)
            return new Response(JSON.stringify({ error: "Temporary content read failure" }), {
              status: 503,
              headers: { "content-type": "application/json" },
            });
        }
        return original(input, init);
      };
      const sample = () => {
        window.__navSamples.push({
          time: performance.now(),
          path: location.pathname,
          heading: document.querySelector("h1")?.textContent,
          visible: !!document.querySelector('[data-admin-async-visible="true"]'),
          cards: document.querySelectorAll("[data-kanban-card]").length,
        });
        window.__navFrame = requestAnimationFrame(sample);
      };
      sample();
    });
    await page.route("**/demo/command-center/superdebate/content?*", async (route) => {
      if (route.request().headers().rsc) await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });
    await navigate(page, "content");
    await page.locator('[data-admin-async-visible="true"]').waitFor();
    await page.screenshot({ path: `${output}/navigation-slow-${reducedMotion}.png` });
    await page.locator("[data-kanban-card]").first().waitFor();
    const samples = await page.evaluate(() =>
      window.__navSamples.filter((s) => s.path.endsWith("/content")),
    );
    assert.ok(samples.some((s) => s.visible));
    assert.ok(samples.some((s) => s.heading === "Content Calendar"));
    results.push(`${reducedMotion}: slow read keeps page identity and reveals delayed placeholder`);
    await navigate(page, "pipeline");
    await page.locator("[data-opportunity-id]").first().waitFor();
    await page.evaluate(() => (window.__navSamples = []));
    await navigate(page, "content");
    await page.locator("[data-kanban-card]").first().waitFor();
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(() =>
        window.__navSamples.some((s) => s.path.endsWith("/content") && s.visible),
      ),
      false,
    );
    results.push(`${reducedMotion}: cached return renders cards without skeleton flash`);
    await page.screenshot({ path: `${output}/navigation-ready-${reducedMotion}.png` });
    await page.evaluate(() => {
      window.__navFailure = true;
      window.__navSamples = [];
      window.dispatchEvent(new Event("admin:priority-refresh"));
    });
    await page.getByText("Showing previously loaded information", { exact: true }).waitFor();
    assert.ok(await page.locator("[data-kanban-card]").count());
    assert.equal(await page.evaluate(() => window.__navSamples.some((s) => s.visible)), false);
    await page.screenshot({ path: `${output}/navigation-refresh-error-${reducedMotion}.png` });
    await page.evaluate(() => (window.__navFailure = false));
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page
      .getByText("Showing previously loaded information", { exact: true })
      .waitFor({ state: "hidden" });
    results.push(`${reducedMotion}: failed refresh keeps cards and retries without blanking`);
    await page.evaluate(() => cancelAnimationFrame(window.__navFrame));
    assert.deepEqual(errors, []);
    await context.close();
  }
  // The live routes and fictional demo share these same page/read-region owners.
  // Delay only their fictional reads; no authenticated service is contacted.
  const themes = JSON.parse(
    await readFile(new URL("../src/lib/admin/themes.json", import.meta.url), "utf8"),
  );
  const states = [];
  for (const [themeIndex, theme] of themes.entries()) {
    for (const [route, endpoint, field] of [
      ["features", "/api/admin/features", "features"],
      ["pipeline", "/api/admin/revenue-os/pipeline", "opportunities"],
      ["content", "/api/admin/content", "items"],
    ]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: themeIndex % 2 ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await context.addInitScript((theme) => {
        if (window === window.top)
          sessionStorage.setItem("accelerate:admin-demo:superdebate:appearance:v1", theme);
      }, theme.id);
      await page.route("**/api/**", (request) => {
        errors.push(`Protected API attempted: ${request.request().url()}`);
        return request.abort();
      });
      await page.goto(`${base}/demo/command-center/superdebate/today`, { timeout: 120000 });
      await page.locator("h1").waitFor();
      // The server-rendered heading can precede hydration. Install the controlled
      // read only after the real demo boundary has installed its fictional fetch.
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "superdebate");
      await page.evaluate(
        ({ endpoint, field }) => {
          const original = window.fetch;
          window.__boardRead = { mode: "hold", calls: 0, release: null };
          window.fetch = async (input, init) => {
            const url = new URL(
              typeof input === "string" ? input : input.url || String(input),
              location.href,
            );
            if (
              url.pathname !== endpoint ||
              (init?.method && init.method !== "GET") ||
              url.searchParams.has("history")
            )
              return original(input, init);
            const state = window.__boardRead;
            state.calls++;
            if (state.mode === "hold")
              await new Promise((resolve) => {
                state.release = resolve;
              });
            if (state.mode === "error")
              return new Response(JSON.stringify({ error: "Controlled board read failure" }), {
                status: 503,
                headers: { "content-type": "application/json" },
              });
            const response = await original(input, init);
            if (state.mode !== "empty") return response;
            const payload = await response.json();
            return new Response(JSON.stringify({ ...payload, [field]: [] }), {
              headers: { "content-type": "application/json" },
            });
          };
        },
        { endpoint, field },
      );
      await navigate(page, route);
      try {
        await page.locator('[data-admin-async-visible="true"]').waitFor();
      } catch (error) {
        const diagnostic = await page.evaluate(() => ({
          url: location.href,
          heading: document.querySelector("h1")?.textContent,
          runtime: window.__accelerateAdminDemoRuntime,
          read: {
            mode: window.__boardRead?.mode,
            calls: window.__boardRead?.calls,
            held: !!window.__boardRead?.release,
          },
          asyncStates: [...document.querySelectorAll("[data-admin-async-state]")].map((el) =>
            el.outerHTML.slice(0, 500),
          ),
        }));
        await writeFile(
          `${output}/state-${theme.id}-${route}-failed.json`,
          JSON.stringify({ diagnostic, errors }, null, 2),
        );
        await page.screenshot({ path: `${output}/state-${theme.id}-${route}-failed.png` });
        throw error;
      }
      async function measure(state) {
        for (const width of [390, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.waitForTimeout(150);
          const geometry = await page.evaluate(() => {
            const main = document.querySelector(".admin-main");
            const header = document.querySelector("h1").getBoundingClientRect();
            const region =
              document.querySelector(".admin-read-body") ??
              document.querySelector(".admin-surface-attention");
            const stacks = [...document.querySelectorAll(".admin-content-stack")];
            return {
              mainWidth: main.clientWidth,
              mainScrollWidth: main.scrollWidth,
              documentWidth: document.documentElement.scrollWidth,
              headingWidth: header.width,
              regionWidth: region?.getBoundingClientRect().width ?? null,
              stackGaps: stacks.map((stack) => getComputedStyle(stack).rowGap),
              visibleLoading: !!document.querySelector('[data-admin-async-visible="true"]'),
              cards: document.querySelectorAll("[data-kanban-card]").length,
            };
          });
          // Retain the measured state even when its acceptance assertion fails.
          states.push({ theme: theme.id, route, state, width, ...geometry });
          await writeFile(`${output}/board-states.json`, JSON.stringify(states, null, 2));
          await page.screenshot({
            path: `${output}/state-${theme.id}-${route}-${state}-${width}.png`,
          });
          assert.ok(
            geometry.mainScrollWidth <= geometry.mainWidth + 1,
            `${theme.id}/${route}/${state}/${width}: main overflow`,
          );
          assert.ok(
            geometry.documentWidth <= width + 1,
            `${theme.id}/${route}/${state}/${width}: document overflow`,
          );
          assert.ok(geometry.headingWidth > 0, "Page identity remains visible");
          assert.ok(
            geometry.regionWidth > 0 && geometry.regionWidth <= geometry.mainWidth,
            "Read state stays inside the shared page region",
          );
          assert.ok(
            geometry.stackGaps.every((gap) => parseFloat(gap) >= 20 && parseFloat(gap) <= 24),
            JSON.stringify(geometry),
          );
        }
      }
      await measure("loading");
      await page.evaluate(() => {
        window.__boardRead.mode = "error";
        window.__boardRead.release();
      });
      await page.getByRole("heading", { name: "We couldn’t load this information" }).waitFor();
      await measure("initial-error");
      await page.evaluate(() => {
        window.__boardRead.mode = "ready";
      });
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      const board = page.getByRole("region", { name: "Kanban board", exact: true });
      await board.waitFor();
      await page.locator("[data-kanban-card]").first().waitFor();
      await measure("ready");
      await board.evaluate((el) => {
        el.scrollLeft = 173;
      });
      await page.waitForTimeout(200);
      const offset = await board.evaluate((el) => el.scrollLeft);
      await page.evaluate(() => {
        window.__boardRead.mode = "hold";
        window.__boardRead.release = null;
        window.dispatchEvent(new Event("admin:priority-refresh"));
      });
      await page.waitForFunction(() => !!window.__boardRead.release);
      await measure("retained-refresh");
      // Resizing can clamp a scrollport; compare at the same final viewport.
      assert.ok(
        Math.abs((await board.evaluate((el) => el.scrollLeft)) - offset) < 2,
        "Retained refresh preserves board position",
      );
      await page.evaluate(() => {
        window.__boardRead.mode = "error";
        window.__boardRead.release();
      });
      await page.getByText("Showing previously loaded information", { exact: true }).waitFor();
      await measure("refresh-error");
      assert.ok(await page.locator("[data-kanban-card]").count());
      assert.ok(
        Math.abs((await board.evaluate((el) => el.scrollLeft)) - offset) < 2,
        "Failed refresh preserves board position",
      );
      await page.evaluate(() => {
        window.__boardRead.mode = "empty";
      });
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-label="Kanban board"]') &&
          !document.querySelector("[data-kanban-card]"),
      );
      await measure("empty");
      await page.evaluate(() => {
        window.__boardRead.mode = "ready";
        window.dispatchEvent(new Event("admin:priority-refresh"));
      });
      await page.locator("[data-kanban-card]").first().waitFor();
      await measure("recovered");
      assert.deepEqual(errors, [], `${theme.id}/${route}: browser errors`);
      await context.close();
      await writeFile(`${output}/board-states.json`, JSON.stringify(states, null, 2));
    }
  }
  await writeFile(`${output}/navigation.json`, JSON.stringify(results, null, 2));
  console.log(results);
} finally {
  await browser.close();
}
