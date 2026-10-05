import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3046";
const output = process.env.QA_PROPOSAL_OUTPUT || "/tmp/accelerate-proposal-editor-recovery";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion,
      });
      await context.addInitScript(() => {
        window.__edit = {
          rows: null,
          mode: "fail",
          failRead: false,
          clipboardFailure: true,
          writes: [],
          copied: [],
        };
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (value) => {
              if (window.__edit.clipboardFailure) throw new Error("Controlled clipboard rejection");
              window.__edit.copied.push(value);
            },
          },
        });
        let handler = window.fetch;
        Object.defineProperty(window, "fetch", {
          configurable: true,
          set: (value) => {
            handler = value;
          },
          get: () => {
            const current = handler;
            return async (input, init) => {
              const url = new URL(
                input instanceof Request ? input.url : String(input),
                location.href,
              );
              const json = (body, status = 200) =>
                new Response(JSON.stringify(body), {
                  status,
                  headers: { "content-type": "application/json" },
                });
              if (url.pathname === "/api/admin/proposals" && window.__edit.rows) {
                const state = window.__edit;
                if (init?.method === "PATCH") {
                  const patch = JSON.parse(init.body);
                  state.writes.push(patch);
                  const mode = state.mode;
                  await new Promise((resolve) => setTimeout(resolve, 800));
                  if (mode === "fail")
                    return json({ error: "Proposal save temporarily unavailable" }, 503);
                  const row = state.rows.find((item) => item.id === patch.id);
                  const saved = { ...row, ...patch };
                  if (mode === "revise") {
                    row.status = "superseded";
                    saved.id = "de100000-0000-4000-8000-000000009999";
                    saved.status = "draft";
                    saved.share_token = "fictional-revised-draft";
                    state.rows.push(saved);
                  } else Object.assign(row, saved);
                  return json({ proposal: saved });
                }
                if (!init?.method || init.method === "GET") {
                  const id = url.searchParams.get("id");
                  if (id)
                    return json({ proposal: state.rows.find((item) => item.id === id) || null });
                  if (state.failRead)
                    return json({ error: "Proposal list temporarily unavailable" }, 503);
                  const status = url.searchParams.get("status");
                  const rows = state.rows.filter(
                    (item) => !status || status === "all" || item.status === status,
                  );
                  return json({
                    proposals: rows,
                    totalMonthly: rows.reduce((sum, row) => sum + row.total_monthly, 0),
                    totalOneTime: rows.reduce((sum, row) => sum + row.total_one_time, 0),
                  });
                }
              }
              return current(input, init);
            };
          },
        });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = [],
        escaped = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route("**/api/**", async (route) => {
        escaped.push(route.request().url());
        await route.abort();
      });
      await page.goto(`${base}/demo/command-center/northline-roofing/proposals`);
      await page.getByRole("heading", { name: "Proposals", exact: true }).waitFor();
      const rows = await page.evaluate(async () => {
        const { proposals } = await (await fetch("/api/admin/proposals")).json();
        window.__edit.rows = proposals;
        return proposals;
      });
      const first = rows[0],
        draft = rows.find((row) => row.status === "draft");
      assert(first && draft && first.id !== draft.id);
      async function open(row, expectedTitle = row.title) {
        await page.keyboard.press("ControlOrMeta+k");
        const input = page.getByRole("combobox", { name: "Search workspace" });
        await input.fill(row.title);
        const option = page
          .getByRole("group", { name: "Proposals", exact: true })
          .getByRole("option")
          .filter({ has: page.getByText(row.title, { exact: true }) })
          .first();
        await option.waitFor();
        for (
          let step = 0;
          step < 40 && (await option.getAttribute("aria-selected")) !== "true";
          step++
        )
          await input.press("ArrowDown");
        assert.equal(await option.getAttribute("aria-selected"), "true");
        await input.press("Enter");
        await page.waitForURL((url) => url.searchParams.get("proposal") === row.id);
        await page.getByRole("heading", { name: expectedTitle, exact: true }).waitFor();
      }
      const title = page.getByLabel("Proposal Title", { exact: true });
      await open(first);
      await title.fill("Unsaved text belonging to the first proposal");
      await open(draft);
      assert.equal(
        await title.inputValue(),
        draft.title,
        "a second record must not inherit the first draft",
      );
      assert.equal(
        await page.getByLabel("Monthly Value ($)", { exact: true }).inputValue(),
        String(draft.total_monthly),
      );
      const link = page.getByRole("textbox", { name: "Proposal share link", exact: true });
      const shareUrl = await link.inputValue();
      await page.getByRole("button", { name: "Copy", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page
        .getByText("Copy failed. The link is selected so you can copy it manually.", {
          exact: true,
        })
        .waitFor();
      assert.equal(await page.getByText("Link copied", { exact: true }).count(), 0);
      assert(
        await link.evaluate(
          (element) =>
            document.activeElement === element &&
            element.selectionStart === 0 &&
            element.selectionEnd === element.value.length,
        ),
      );
      await page.evaluate(() => {
        window.__edit.clipboardFailure = false;
      });
      await page.getByRole("button", { name: "Copy", exact: true }).click();
      await page.getByText("Link copied", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__edit.copied[0]), shareUrl);
      const edited = `${draft.title} revised scope`;
      await title.fill(edited);
      await page.getByRole("button", { name: "Save", exact: true }).focus();
      await page.keyboard.press("Enter");
      assert(await page.getByRole("button", { name: "Saving...", exact: true }).isDisabled());
      assert(await page.getByRole("button", { name: "Mark Sent", exact: true }).isDisabled());
      await page.getByText("Proposal save temporarily unavailable", { exact: true }).waitFor();
      assert.equal(await page.getByText(/^Proposal saved:/).count(), 0);
      assert.equal(await title.inputValue(), edited, "failed save preserves the draft");
      await page
        .getByText("Copy failed. The link is selected so you can copy it manually.", {
          exact: true,
        })
        .locator("..")
        .getByRole("button", { name: "Dismiss", exact: true })
        .click();
      await page
        .getByText("Link copied", { exact: true })
        .locator("..")
        .getByRole("button", { name: "Dismiss", exact: true })
        .click();
      await page.screenshot({ path: `${output}/save-failure-${width}-${reducedMotion}.png` });
      await page.evaluate(() => {
        window.__edit.mode = "save";
        window.__edit.failRead = true;
      });
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByText(`Proposal saved: ${edited}`, { exact: true }).waitFor();
      await page
        .getByText(
          "The proposal list couldn’t refresh. Your changes are saved; reload the page to refresh the list.",
          { exact: true },
        )
        .waitFor();
      assert.equal(await title.inputValue(), edited);
      assert.equal(
        await page.evaluate(
          () => window.__edit.rows.find((row) => row.id === window.__edit.writes.at(-1).id).title,
        ),
        edited,
      );
      await open(first);
      await open(draft, edited);
      assert.equal(
        await title.inputValue(),
        edited,
        "reopening a confirmed save must retain the saved fields",
      );
      await page.evaluate(() => {
        window.__edit.failRead = false;
      });
      await page.getByRole("button", { name: "Mark Sent", exact: true }).click();
      await page.getByText(`Proposal marked as sent: ${edited}`, { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Mark Sent", exact: true })
        .waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "Dismiss", exact: true })
        .first()
        .waitFor({ state: "hidden" });
      await page.evaluate(() => {
        window.__edit.mode = "revise";
      });
      const revisedTitle = `${draft.title} new draft version`;
      await title.fill(revisedTitle);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const successorId = "de100000-0000-4000-8000-000000009999";
      await page.waitForURL((url) => url.searchParams.get("proposal") === successorId);
      await page.getByRole("heading", { name: revisedTitle, exact: true }).waitFor();
      assert.equal(await title.inputValue(), revisedTitle);
      assert((await link.inputValue()).endsWith("/proposal/fictional-revised-draft"));
      await page.getByText(`Proposal saved: ${revisedTitle}`, { exact: true }).waitFor();
      await page.getByRole("button", { name: "Dismiss", exact: true }).click();
      await page
        .getByText(`Proposal saved: ${revisedTitle}`, { exact: true })
        .waitFor({ state: "hidden" });
      await page.screenshot({
        path: `${output}/revised-draft-${width}-${reducedMotion}.png`,
        fullPage: true,
      });
      await page.evaluate(() => {
        window.__edit.mode = "save";
      });
      await title.fill("Late save belonging to the revised draft");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await open(first);
      await page
        .getByText("Proposal saved: Late save belonging to the revised draft", { exact: true })
        .waitFor();
      assert.equal(new URL(page.url()).searchParams.get("proposal"), first.id);
      assert.equal(
        await title.inputValue(),
        first.title,
        "late receipts cannot replace a different open record",
      );
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      assert.deepEqual(errors, []);
      assert.deepEqual(
        escaped,
        [],
        "controlled proposal proof must not send protected/provider requests",
      );
      results.push({
        width,
        reducedMotion,
        status: "passed",
        recordIsolation: true,
        retainedDraft: true,
        saveFailureAndRetry: true,
        refreshWarning: true,
        reopenAfterReadFailure: true,
        successor: true,
        lateSave: true,
        clipboardFailureAndSuccess: true,
        keyboard: true,
        protectedRequests: 0,
      });
      await context.close();
    }
  }
  await writeFile(`${output}/receipt.json`, JSON.stringify({ status: "passed", results }, null, 2));
  console.log(
    "Proposal editor: desktop/phone, normal/reduced motion, identity, write/read/clipboard recovery and successor/late receipts passed.",
  );
} finally {
  await browser.close();
}
