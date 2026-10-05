import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3048";
const output = process.env.QA_WEBSITE_AI_OUTPUT || "/tmp/accelerate-website-ai-recovery";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
let activePage;
try {
  for (const width of [1440, 390]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion,
      });
      await context.addInitScript(() => {
        window.__studio = { mode: "late", calls: [], completed: [], aborted: 0 };
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
              if (url.pathname === "/api/admin/site/website/suggest" && init?.method === "POST") {
                const state = window.__studio,
                  body = JSON.parse(init.body),
                  mode = state.mode;
                state.calls.push(body);
                init.signal?.addEventListener("abort", () => state.aborted++, { once: true });
                // Deliberately ignore abort here to prove the UI also rejects late replies.
                await new Promise((resolve) => setTimeout(resolve, mode === "late" ? 2500 : 150));
                const page = structuredClone(body.page);
                if (mode === "fail")
                  return new Response(JSON.stringify({ error: "Controlled suggestion failure" }), {
                    status: 503,
                  });
                if (mode === "layout")
                  page.content.document.root[0].styles = {
                    ...page.content.document.root[0].styles,
                    background: "surfaceDark",
                  };
                else {
                  const title =
                    mode === "late" ? "Canceled late suggestion" : "Fresh AI suggestion";
                  page.metadata.title = title;
                  page.content.document.metadata.title = title;
                  page.content.document.root[0].children[0].props.heading = title;
                }
                state.completed.push(mode);
                return new Response(
                  JSON.stringify({
                    page,
                    summary:
                      mode === "layout"
                        ? "A darker introduction with the same copy."
                        : "A clearer page introduction.",
                  }),
                  { headers: { "content-type": "application/json" } },
                );
              }
              return current(input, init);
            };
          },
        });
      });
      const page = await context.newPage(),
        errors = [],
        escaped = [];
      activePage = page;
      page.setDefaultTimeout(20000);
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route("**/api/**", async (route) => {
        escaped.push(route.request().url());
        await route.abort();
      });
      await page.goto(`${base}/demo/command-center/northline-roofing/site/website`);
      await page.getByText("Bundled website loaded.", { exact: false }).waitFor();
      const pageSelect = page.getByRole("combobox", { name: /^Page\b/ });
      const originalId = await pageSelect.inputValue();
      await page.getByRole("button", { name: "Add page", exact: true }).click();
      const create = page.getByRole("dialog", { name: "Create a page" });
      await create.getByLabel("Page title", { exact: true }).fill("Bookkeeping advice");
      await create.getByLabel("Page address", { exact: true }).fill("/services/bookkeeping");
      await create.getByLabel("Page title", { exact: true }).fill("Bookkeeping service");
      assert.equal(
        await create.getByLabel("Page address", { exact: true }).inputValue(),
        "/services/bookkeeping",
      );
      await create.getByRole("button", { name: "Create draft page", exact: true }).click();
      await page.getByRole("textbox", { name: "Page URL", exact: true }).waitFor();
      assert.equal(
        await page.getByRole("textbox", { name: "Page URL", exact: true }).inputValue(),
        "/services/bookkeeping",
      );
      const selectedId = await pageSelect.inputValue();
      assert.notEqual(selectedId, originalId);
      const ask = page
        .getByRole("button", { name: "Add page", exact: true })
        .locator("..")
        .getByRole("button", { name: "Ask AI", exact: true });
      await ask.click();
      const ai = page.getByRole("dialog", { name: "Edit with AI", exact: true });
      const instruction = ai.getByRole("textbox", { name: /^What would you like to change/ });
      await instruction.fill("Improve the introduction without inventing facts.");
      await ai.getByRole("button", { name: "Prepare suggestion", exact: true }).click();
      const cancel = ai.getByRole("button", { name: "Cancel suggestion", exact: true });
      await cancel.focus();
      await page.keyboard.press("Enter");
      await ai
        .getByText("Suggestion canceled. Your draft is unchanged.", { exact: true })
        .waitFor();
      assert.equal(
        await instruction.inputValue(),
        "Improve the introduction without inventing facts.",
      );
      assert.equal(await page.evaluate(() => window.__studio.aborted), 1);
      await page.evaluate(() => {
        window.__studio.mode = "fresh";
      });
      await ai.getByRole("button", { name: "Prepare suggestion", exact: true }).click();
      const review = ai.getByRole("region", { name: "AI suggestion review" });
      await review.waitFor();
      await page.waitForFunction(() => window.__studio.completed.includes("late"));
      assert.equal(await ai.getByText("Canceled late suggestion", { exact: true }).count(), 0);
      const showPreview = ai.getByRole("button", { name: "Preview suggestion", exact: true });
      await showPreview.focus();
      await page.keyboard.press("Enter");
      const candidate = ai.frameLocator('iframe[title="Live website preview"]');
      await candidate.getByRole("heading", { name: "Fresh AI suggestion", exact: true }).waitFor();
      for (const [label, pixels] of [
        ["Phone", 390],
        ["Tablet", 768],
        ["Desktop", 1440],
      ]) {
        await ai.getByRole("button", { name: label, exact: true }).click();
        assert(
          await candidate.locator("body").evaluate(
            (_, expected) =>
              new Promise((resolve) => {
                let attempts = 0;
                const check = () => {
                  if (innerWidth === expected) resolve(true);
                  else if (++attempts >= 250) resolve(false);
                  else setTimeout(check, 20);
                };
                check();
              }),
            pixels,
          ),
          `${label} preview must use its actual viewport width`,
        );
      }
      await review.evaluate((element) => element.scrollIntoView({ block: "start" }));
      assert.equal(
        await ai.locator("iframe").evaluate((element) => getComputedStyle(element).visibility),
        "visible",
        "dialog previews must remain visible",
      );
      assert.equal(
        await page
          .locator(".admin-route-frame iframe")
          .first()
          .evaluate((element) => getComputedStyle(element).visibility),
        "hidden",
        "background previews remain hidden behind dialogs",
      );
      await page.screenshot({ path: `${output}/suggestion-preview-${width}-${reducedMotion}.png` });
      await ai.getByRole("button", { name: "Close AI editor", exact: true }).click();
      await ai.waitFor({ state: "hidden" });
      assert.equal(
        await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
        "Bookkeeping service",
        "previewing cannot apply the candidate",
      );
      await pageSelect.selectOption(originalId);
      await ask.click();
      assert.equal(await instruction.inputValue(), "", "AI tools are scoped to the selected page");
      assert.equal(await ai.getByRole("region", { name: "AI suggestion review" }).count(), 0);
      await ai.getByRole("button", { name: "Close AI editor", exact: true }).click();
      await pageSelect.selectOption(selectedId);
      await ask.click();
      await instruction.fill("Improve this introduction.");
      await ai.getByRole("button", { name: "Prepare suggestion", exact: true }).click();
      await review.waitFor();
      await ai.getByRole("button", { name: "Close AI editor", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Title", exact: true })
        .fill("Manual title after review");
      await ask.click();
      await ai
        .getByText(
          "This page changed after the suggestion. Prepare a fresh suggestion to preserve your edits.",
          { exact: true },
        )
        .waitFor();
      assert(await ai.getByRole("button", { name: "Apply to draft", exact: true }).isDisabled());
      await page.evaluate(() => {
        window.__studio.mode = "fail";
      });
      await ai.getByRole("button", { name: "Prepare suggestion", exact: true }).click();
      await ai.getByText("Controlled suggestion failure", { exact: true }).waitFor();
      await ai.getByRole("button", { name: "Close AI editor", exact: true }).click();
      await ai.waitFor({ state: "hidden" });
      assert.equal(
        await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
        "Manual title after review",
      );
      await ask.click();
      await page.evaluate(() => {
        window.__studio.mode = "late";
      });
      await ai.getByRole("button", { name: "Prepare suggestion", exact: true }).click();
      await ai.getByRole("button", { name: "Cancel suggestion", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await ai.waitFor({ state: "hidden" });
      assert.equal(await page.evaluate(() => window.__studio.aborted), 2);
      await ask.click();
      await page.evaluate(() => {
        window.__studio.mode = "layout";
      });
      await ai.getByRole("combobox", { name: /^Scope\b/ }).selectOption("generate");
      await ai.getByRole("button", { name: "Prepare suggestion", exact: true }).click();
      await ai
        .getByText(
          "The text is unchanged. Use Preview suggestion to inspect layout and appearance.",
          { exact: true },
        )
        .waitFor();
      await ai.getByRole("button", { name: "Preview suggestion", exact: true }).click();
      await candidate.getByRole("heading", { name: "Bookkeeping service", exact: true }).waitFor();
      await ai.getByRole("button", { name: "Apply to draft", exact: true }).click();
      await ai.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Save draft", exact: true }).click();
      await page.getByText("Private revision 1 saved.", { exact: false }).waitFor();
      const snapshot = await page.evaluate(async (id) => {
        const { website } = await (await fetch("/api/admin/site/website")).json();
        if (website.publishedRevisionId !== null) throw new Error("a draft save cannot publish");
        const document = structuredClone(website.draft.document);
        const edited = document.pages.find((item) => item.id === id);
        const source = edited.content.document.root[0];
        edited.content.document.root = Array.from({ length: 40 }, (_, index) => ({
          ...source,
          id: `limit-${index}`,
          children: source.children.map((child, at) => ({ ...child, id: `limit-${index}-${at}` })),
        }));
        return JSON.stringify(document);
      }, selectedId);
      await page.getByLabel("Import website snapshot", { exact: true }).setInputFiles({
        name: "website.json",
        mimeType: "application/json",
        buffer: Buffer.from(snapshot),
      });
      await page.getByText("Imported into local edits.", { exact: false }).waitFor();
      await pageSelect.selectOption(selectedId);
      await page.getByLabel("Section template", { exact: true }).selectOption("hero");
      await page.getByText("40 of 40 sections", { exact: true }).waitFor();
      assert(await page.getByRole("button", { name: "Add section", exact: true }).isDisabled());
      await page.locator("summary").first().click();
      await page.getByRole("button", { name: "Remove section", exact: true }).first().click();
      await page.getByText("39 of 40 sections", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Add section", exact: true }).click();
      await page.getByText("40 of 40 sections", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Save draft", exact: true }).click();
      await page.getByText("Private revision 2 saved.", { exact: false }).waitFor();
      const draftFrame = page.locator('.admin-route-frame iframe[title="Live website preview"]');
      assert.equal(
        await draftFrame.evaluate((element) => getComputedStyle(element).visibility),
        "visible",
        "closing the dialog restores the draft preview",
      );
      await page
        .frameLocator('.admin-route-frame iframe[title="Live website preview"]')
        .getByRole("heading", { name: "Bookkeeping service", exact: true })
        .first()
        .waitFor();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${output}/saved-builder-${width}-${reducedMotion}.png` });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      assert.deepEqual(errors, []);
      assert.deepEqual(
        escaped,
        [],
        "fictional browser recovery must not reach protected/provider APIs",
      );
      results.push({
        width,
        reducedMotion,
        status: "passed",
        customAddress: true,
        cancellationAndLateReply: true,
        escapeWhilePreparing: true,
        pageIsolation: true,
        responsiveCandidatePreview: true,
        dialogPreviewVisible: true,
        staleSuggestion: true,
        providerFailureAndRetry: true,
        layoutOnlyReview: true,
        sectionLimitAndSave: true,
        keyboard: true,
        protectedRequests: 0,
      });
      await context.close();
    }
  }
  await writeFile(`${output}/receipt.json`, JSON.stringify({ status: "passed", results }, null, 2));
  console.log(
    "Website AI: four desktop/phone and normal/reduced-motion contexts passed custom addresses, cancellation, late replies, page isolation, responsive preview, stale/failure recovery, layout review and bounded saving.",
  );
} catch (error) {
  await activePage?.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  await writeFile(
    `${output}/receipt.json`,
    JSON.stringify({ status: "failed", results, error: error.message }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
