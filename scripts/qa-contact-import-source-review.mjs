import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3062";
const out = process.env.QA_OUTPUT || "/tmp/accelerate-import-source-review";
mkdirSync(out, { recursive: true });
const scenarios = [
  "northline-roofing",
  "alder-ridge-law",
  "ledgerstone-advisory",
  "hearthline-realty",
  "common-table-network",
  "superdebate",
];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const scenario of scenarios)
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: width === 390 ? "reduce" : "no-preference",
        colorScheme: width === 390 ? "dark" : "light",
      });
      await context.addInitScript(
        ({ scenario, dark }) => {
          localStorage.setItem(`accelerate:demo-theme:${scenario}`, dark ? "dark" : "light");
          sessionStorage.setItem(
            `accelerate:admin-demo:${scenario}:appearance:v1`,
            dark ? "dark" : "light",
          );
          const browserFetch = window.fetch.bind(window);
          let delegate = browserFetch;
          window.importQa = { reads: 0, writes: [], count: 3, failHistory: false };
          let batch;
          const makeBatch = () => {
            const rows = Array.from({ length: window.importQa.count }, (_, index) => ({
              id: `fictional-row-${index}`,
              row_index: index,
              raw_data: {
                name: index === 1 ? "José 王" : `Person ${index + 1}`,
                email: `person${index + 1}@fictional.example`,
                notes: "Original <script>text</script>\n" + "source ".repeat(50),
              },
              status: index === 1 ? "needs_review" : "proposed",
              action: "create",
              included: index !== 1,
              confidence: index === 1 ? "low" : "high",
              reviewed_data: {
                fullName: index === 1 ? "" : `Person ${index + 1}`,
                email: index === 1 ? null : `person${index + 1}@fictional.example`,
                phone: null,
                companyName: null,
                role: null,
                website: null,
                industry: null,
                source: null,
                notes: null,
              },
              warnings:
                index === 1
                  ? ["The AI omitted this source row. Correct it before including it."]
                  : [],
              errors: index === 1 ? ["A name and contact method are required"] : [],
              match_reason: "No exact match",
              matched_contact_id: null,
              imported_contact_id: null,
              error: null,
            }));
            return {
              id: "fictional-import-batch",
              status: "ready",
              source_type: "text",
              original_filename: "fictional.txt",
              source_row_count: rows.length,
              proposed_row_count: rows.length,
              selected_row_count: rows.filter((row) => row.included).length,
              review_digest: "fictional-original-digest",
              approval_digest: null,
              ai_model: "controlled-fixture",
              summary: {},
              error: null,
              approved_by: null,
              approved_at: null,
              completed_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              rows,
            };
          };
          const fetchFixture = async (input, init) => {
            const url = new URL(
              String(input instanceof Request ? input.url : input),
              location.origin,
            );
            if (!url.pathname.startsWith("/api/")) return browserFetch(input, init);
            if (url.pathname !== "/api/admin/revenue-os/contact-imports")
              return delegate(input, init);
            if (init?.method !== "POST") {
              window.importQa.reads++;
              if (window.importQa.failHistory)
                return Response.json({ error: "Controlled unavailable history" }, { status: 503 });
              return Response.json(
                url.searchParams.has("id")
                  ? { schemaReady: true, batch: batch || makeBatch() }
                  : { schemaReady: true, batches: [] },
              );
            }
            const body = JSON.parse(init.body);
            window.importQa.writes.push(body);
            if (body.action === "analyze") {
              batch = makeBatch();
              window.importQa.readyAt = performance.now();
              if (window.importQa.count === 500) {
                window.importQa.entrance = new Promise((resolve, reject) => {
                  const sample = () => {
                    const last = document.querySelector('[data-contact-import-row="49"]');
                    if (last && window.importQa.firstRowDomMs === undefined)
                      window.importQa.firstRowDomMs = performance.now() - window.importQa.readyAt;
                    let visible = Boolean(last);
                    for (let parent = last?.parentElement; parent; parent = parent.parentElement)
                      visible &&= Number(getComputedStyle(parent).opacity) >= 0.999;
                    if (visible) return resolve(performance.now() - window.importQa.readyAt);
                    if (performance.now() - window.importQa.readyAt > 2000)
                      return reject(new Error("Last row stayed hidden"));
                    requestAnimationFrame(sample);
                  };
                  requestAnimationFrame(sample);
                });
              }
            }
            if (body.action === "save_review") {
              await new Promise((resolve) => setTimeout(resolve, 200));
              batch.rows = batch.rows.map((row) => {
                const edit = body.rows.find((value) => value.id === row.id);
                return {
                  ...row,
                  included: edit.included,
                  action: edit.action,
                  reviewed_data: edit.data,
                  errors: [],
                  status: edit.included ? "proposed" : "skipped",
                };
              });
              batch.review_digest = "fictional-edited-digest";
            }
            return Response.json({ schemaReady: true, batch });
          };
          Object.defineProperty(window, "fetch", {
            configurable: true,
            get: () => fetchFixture,
            set: (value) => {
              delegate = value;
            },
          });
        },
        { scenario, dark: width === 390 },
      );
      const page = await context.newPage();
      const errors = [],
        escaped = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/admin")) escaped.push(request.url());
      });
      await page.goto(`${base}/demo/command-center/${scenario}/contact-imports`, {
        waitUntil: "networkidle",
      });
      await page.waitForFunction((id) => window.__accelerateAdminDemoRuntime === id, scenario);
      const source = page.getByTestId("contact-import-source");
      await source.fill("Keep this source");
      await page.getByLabel("Upload contacts file").setInputFiles({
        name: "broken.csv",
        mimeType: "text/csv",
        buffer: Buffer.from([0xc3, 0x28]),
      });
      await page
        .getByRole("alert")
        .getByText(/could not be read as UTF-8/)
        .waitFor();
      assert.equal(await source.inputValue(), "Keep this source");
      await page.getByLabel("Upload contacts file").setInputFiles({
        name: "valid.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("José 王"),
      });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="contact-import-source"]').value === "José 王",
      );
      await page.getByTestId("contact-import-analyze").click();
      await page.getByRole("button", { name: /^2\s*Unnamed contact/ }).click();
      const original = page.getByTestId("contact-import-original");
      assert.equal(await original.getAttribute("open"), "");
      await original.getByText("José 王", { exact: true }).waitFor();
      assert.ok((await original.innerText()).includes("Original <script>text</script>"));
      assert.equal(await page.locator(".admin-main script").count(), 0);
      await page.getByLabel("Full name", { exact: true }).fill("José 王");
      await page.getByLabel("Email", { exact: true }).fill("person2@fictional.example");
      await page.getByRole("button", { name: /^Include row 2:/ }).focus();
      await page.keyboard.press("Space");
      assert.equal(await page.getByTestId("contact-import-approve").isDisabled(), true);
      const save = page.getByRole("button", { name: "Save", exact: true });
      await save.click();
      assert.equal(await page.getByLabel("Full name", { exact: true }).isDisabled(), true);
      await page.waitForFunction(() =>
        window.importQa.writes.some((body) => body.action === "save_review"),
      );
      await page.waitForFunction(
        () => document.querySelector('[data-testid="contact-import-approve"]').disabled === false,
      );
      const edits = await page.evaluate(() =>
        window.importQa.writes.find((body) => body.action === "save_review"),
      );
      assert.equal(edits.rows.length, 3);
      assert.equal(edits.rows[1].data.fullName, "José 王");
      assert.equal(edits.rows[1].included, true);
      await page.getByTestId("contact-import-approve").click();
      await page.getByRole("button", { name: "Keep reviewing", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.locator('[role="dialog"]').waitFor({ state: "detached" });
      assert.deepEqual(
        await page.evaluate(() => window.importQa.writes.map((body) => body.action)),
        ["analyze", "save_review"],
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2),
        false,
      );
      await page.screenshot({ path: `${out}/${scenario}-${width}.png`, fullPage: true });
      await page.getByRole("button", { name: "Start over", exact: true }).click();
      const readsBefore = await page.evaluate(() => window.importQa.reads);
      await page.getByRole("link", { name: "All contacts", exact: true }).click();
      await page.getByRole("link", { name: "List import", exact: true }).click();
      await page.getByTestId("contact-import-source").waitFor();
      assert.equal(
        await page.evaluate(() => window.importQa.reads),
        readsBefore,
        "route revisit should reuse fresh import history",
      );
      if (scenario === scenarios[0] && width === 1440) {
        await page.evaluate(() => {
          window.importQa.count = 500;
        });
        await source.fill("500 fictional rows");
        await page.getByTestId("contact-import-analyze").click();
        await page.getByRole("button", { name: /^50\s*Person 50/ }).waitFor();
        const animationMs = await page.evaluate(() => window.importQa.entrance);
        const firstRowDomMs = await page.evaluate(() => window.importQa.firstRowDomMs);
        assert.ok(
          animationMs <= 460,
          `500-row review first-page entrance ${animationMs}ms; DOM ready ${firstRowDomMs}ms`,
        );
        const visited = [];
        for (let pageIndex = 0; pageIndex < 10; pageIndex++) {
          visited.push(
            ...(await page
              .locator("[data-contact-import-row]")
              .evaluateAll((nodes) => nodes.map((node) => Number(node.dataset.contactImportRow)))),
          );
          if (pageIndex < 9) {
            const next = page.getByRole("button", { name: "Next page", exact: true });
            await next.focus();
            await page.keyboard.press("Enter");
            await page
              .getByRole("status")
              .filter({ hasText: `Showing ${(pageIndex + 1) * 50 + 1}-` })
              .waitFor();
          }
        }
        assert.deepEqual(
          visited,
          Array.from({ length: 500 }, (_, index) => index),
        );
        await page.getByRole("button", { name: /^500\s*Person 500/ }).click();
        await page.getByRole("button", { name: /^Exclude row 500:/ }).click();
        await page.getByText("Unsaved changes", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await page.getByText("Review saved", { exact: true }).waitFor();
        await page.waitForFunction(() =>
          window.importQa.writes.some(
            (body) => body.action === "save_review" && body.rows.length === 500,
          ),
        );
        const largeSave = await page.evaluate(() =>
          window.importQa.writes.findLast((body) => body.action === "save_review"),
        );
        assert.equal(largeSave.rows.length, 500);
        assert.equal(largeSave.rows[499].included, false);
        assert.equal(typeof largeSave.expectedRevision, "string");
        await page.screenshot({ path: `${out}/${scenario}-${width}-500-rows.png`, fullPage: true });
        results.push({ scenario, width, animationMs, rows: 500 });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(escaped, []);
      results.push({ scenario, width, status: "passed" });
      await context.close();
    }
  writeFileSync(`${out}/results.json`, JSON.stringify({ status: "passed", results }, null, 2));
  console.log(
    "PASS: six scenarios, desktop/mobile, light/dark, reduced motion, strict UTF-8, source-backed correction, keyboard inclusion, edit locking, approval cancellation, cached history, bounded 500-row review with every source row and zero escaped writes.",
  );
} finally {
  await browser.close();
}
