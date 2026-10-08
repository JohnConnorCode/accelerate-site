import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL;
if (!base) throw new Error("Start a repository QA server and set PLAYWRIGHT_BASE_URL.");
const output =
  process.env.WORKSPACE_OPERATIONS_QA_OUTPUT ?? "/tmp/accelerate-workspace-operations-qa";
await mkdir(output, { recursive: true });
const blueprint = "11111111-1111-4111-8111-111111111111";
const checks = [];
const browser = await chromium.launch();
try {
  for (const scenario of ["northline-roofing", "superdebate"]) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      try {
        // The actual shared demo handles reads and simulated saves. This narrow
        // adapter forces one transport failure and a legacy read projection.
        await context.addInitScript(() => {
          let failed = false;
          window.__generationRequests = [];
          const wrap = (next) => async (input, init) => {
            const raw =
              typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            const url = new URL(raw, location.href);
            if (url.pathname.endsWith("/generate-operations")) {
              window.__generationRequests.push(JSON.parse(String(init?.body)));
              if (!failed) {
                failed = true;
                return new Response(
                  JSON.stringify({
                    error: "Operating setup was not saved. Check the connection, then retry.",
                  }),
                  { status: 503, headers: { "content-type": "application/json" } },
                );
              }
            }
            const response = await next(input, init);
            if (
              /\/api\/admin\/blueprints\/[0-9a-f-]+$/.test(url.pathname) &&
              sessionStorage.getItem("qa:legacy-generation") === "true"
            ) {
              const body = await response.json();
              return new Response(
                JSON.stringify({
                  ...body,
                  generation: { state: "reconciliation_required", receipt: null },
                }),
                { headers: { "content-type": "application/json" } },
              );
            }
            return response;
          };
          let wrapped = wrap(window.fetch.bind(window));
          Object.defineProperty(window, "fetch", {
            configurable: true,
            get: () => wrapped,
            set: (value) => {
              wrapped = wrap(value);
            },
          });
        });
        const page = await context.newPage();
        const errors = [],
          escaped = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== new URL(base).origin || url.pathname.startsWith("/api/")) {
            escaped.push(url.pathname);
            return route.abort();
          }
          return route.continue();
        });
        page.setDefaultTimeout(20_000);
        const url = `${base}/demo/command-center/${scenario}/blueprints/${blueprint}`;
        await page.goto(url, { timeout: 60_000 });
        await page.getByRole("heading", { name: "Blueprint v1", exact: true }).waitFor();
        const save = page.getByRole("button", { name: "Save operating setup", exact: true });
        assert.equal(await save.isDisabled(), true);
        await page.getByRole("button", { name: "Approve", exact: true }).focus();
        await page.keyboard.press("Enter");
        await save.waitFor();
        await page.waitForFunction(() =>
          [...document.querySelectorAll("button")].some(
            (button) => button.textContent?.trim() === "Save operating setup" && !button.disabled,
          ),
        );
        await save.click();
        await page
          .getByRole("alert")
          .filter({ hasText: "Operating setup was not saved" })
          .waitFor();
        const read = () =>
          page.evaluate(async (id) => {
            const detail = await (await fetch(`/api/admin/blueprints/${id}`)).json();
            const columns = await (
              await fetch("/api/admin/kanban/columns?board_key=pipeline")
            ).json();
            return {
              generation: detail.generation,
              columns: columns.columns.map((row) => row.column_key),
            };
          }, blueprint);
        const failed = await read();
        assert.equal(failed.generation.state, "not_generated");
        await save.focus();
        await page.keyboard.press("Enter");
        await page
          .getByRole("status")
          .filter({ hasText: "Setup saved with an audit record" })
          .waitFor();
        const saved = await read();
        assert.equal(saved.generation.state, "saved");
        assert.ok(saved.generation.receipt.auditId);
        assert.ok(saved.columns.includes("quote_review"));
        assert.deepEqual(
          saved.generation.receipt.boards.find((board) => board.targetBoardKey === "pipeline")
            .columnsCreated,
          ["quote_review"],
        );
        assert.equal(new Set(saved.columns).size, saved.columns.length);
        assert.ok(saved.generation.receipt.workflows.every((item) => item.actionId === null));
        const requests = await page.evaluate(() => window.__generationRequests);
        assert.equal(
          requests[0].requestKey,
          requests[1].requestKey,
          "transport retry reuses its request identity",
        );
        const panel = page
          .getByRole("heading", { name: "Operating setup", exact: true })
          .locator("..");
        await panel.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/${scenario}-${width}-review.png` });
        await panel.screenshot({ path: `${output}/${scenario}-${width}-saved.png` });
        await page.reload();
        await page
          .getByRole("status")
          .filter({ hasText: "Setup saved with an audit record" })
          .waitFor();
        const afterReload = await read();
        assert.deepEqual(afterReload, saved, "reload retains the saved receipt and columns");
        // The adapter's first failure resets with a reload; the subsequent
        // retry exercises a fresh caller key against the same saved version.
        await save.click();
        await page
          .getByRole("alert")
          .filter({ hasText: "Operating setup was not saved" })
          .waitFor();
        await save.click();
        await page.getByRole("status").filter({ hasText: "already saved" }).waitFor();
        assert.deepEqual(await read(), saved, "fresh-key replay does not duplicate setup");
        await page.evaluate(() => sessionStorage.setItem("qa:legacy-generation", "true"));
        await page.reload();
        await page
          .getByRole("alert")
          .filter({ hasText: "earlier setup save needs maintainer reconciliation" })
          .waitFor();
        assert.equal(await save.isDisabled(), true);
        await panel.screenshot({ path: `${output}/${scenario}-${width}-reconciliation.png` });
        await page.evaluate(() => sessionStorage.removeItem("qa:legacy-generation"));
        await page.reload();
        await page.getByRole("button", { name: "Edit blueprint", exact: true }).click();
        await page
          .getByRole("textbox", { name: "Business summary", exact: true })
          .fill(
            "This fictional team reviews every won project before preparing the welcome email.",
          );
        await page.getByRole("button", { name: "Save as new version", exact: true }).click();
        await page.getByRole("heading", { name: "Blueprint v2", exact: true }).waitFor();
        assert.equal(await save.isDisabled(), true, "a changed version needs fresh approval");
        const stale = await page.evaluate(
          async (id) =>
            (
              await fetch(`/api/admin/blueprints/${id}/generate-operations`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ version: 1, requestKey: "stale" }),
              })
            ).status,
          blueprint,
        );
        // A reload resets the forced-failure adapter, so consume that failure
        // before asserting the shared demo's actual version refusal.
        const staleActual =
          stale === 503
            ? await page.evaluate(
                async (id) =>
                  (
                    await fetch(`/api/admin/blueprints/${id}/generate-operations`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ version: 1, requestKey: "stale" }),
                    })
                  ).status,
                blueprint,
              )
            : stale;
        assert.equal(staleActual, 409);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        assert.deepEqual(errors, []);
        assert.deepEqual(escaped, []);
        checks.push(
          `${scenario} ${width}: explicit approval, forced failure without saved setup, same-key keyboard retry, durable receipt, fresh-key replay, controlled legacy recovery, fresh-version approval, stale refusal, overflow and no escaped API/provider request`,
        );
      } finally {
        await context.close();
      }
    }
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        result: "passed",
        checks,
        environment:
          "repository browser and shared fictional runtime; failure/legacy adapters controlled; native transaction proof separate",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ result: "passed", checks: checks.length, output }));
} finally {
  await browser.close();
}
