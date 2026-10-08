/* eslint no-undef: "error" */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

// Deterministic fictional streams exercise the shared chat, never a live model.
export async function verifyAIReading({ browser, base, output }) {
  const results = [];
  for (const mode of ["page", "panel"]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({
        viewport: mode === "page" ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
        reducedMotion,
      });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(
          `${base}/demo/command-center/superdebate/${mode === "page" ? "ai" : "today"}`,
          { timeout: 120000 },
        );
        if (mode === "panel")
          await page.evaluate(() => window.dispatchEvent(new Event("admin:open-ai")));
        const root =
          mode === "panel"
            ? page.getByRole("dialog", { name: "Ask AI", exact: true })
            : page.locator(".admin-main");
        const input = root.getByRole("textbox", { name: "Ask the business", exact: true });
        await input.waitFor();
        await page.screenshot({ path: `${output}/ai-reading-empty-${mode}-${reducedMotion}.png` });
        await page.evaluate(() => {
          const original = window.fetch;
          const encoder = new TextEncoder();
          window.__aiReadingRequests = 0;
          window.__aiReadingAnswer = "";
          window.__aiReadingEmit = (text, final = false) => {
            window.__aiReadingAnswer += text;
            const event = final
              ? {
                  type: "final",
                  messageId: `answer-${window.__aiReadingRequests}`,
                  runId: null,
                  text: window.__aiReadingAnswer,
                }
              : { type: "assistant_delta", delta: text };
            window.__aiReadingController.enqueue(
              encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
            );
            if (final) window.__aiReadingController.close();
          };
          window.fetch = async (input, init) => {
            const url = typeof input === "string" ? input : input.url || String(input);
            if (url.includes("/api/admin/revenue-os/ai/stream")) {
              window.__aiReadingRequests++;
              window.__aiReadingAnswer = "";
              return new Response(
                new ReadableStream({
                  start(controller) {
                    window.__aiReadingController = controller;
                    window.__aiReadingEmit(
                      Array.from(
                        { length: 35 },
                        (_, index) =>
                          `Record ${index + 1}: Review the customer history and verify the next promised step before replying.`,
                      ).join("\n\n"),
                    );
                  },
                }),
                { headers: { "content-type": "text/event-stream" } },
              );
            }
            if (url.includes("/api/admin/revenue-os/ai/conversations")) {
              const payload = url.includes("/reading-history")
                ? {
                    messages: [
                      {
                        id: "history-user",
                        role: "user",
                        content: "Review the earlier work",
                        runId: null,
                      },
                      {
                        id: "history-answer",
                        role: "assistant",
                        content: Array.from(
                          { length: 40 },
                          (_, index) => `Saved record ${index + 1}: A retained answer to inspect.`,
                        ).join("\n\n"),
                        runId: null,
                      },
                    ],
                  }
                : { conversations: [{ id: "reading-history", title: "Saved reading review" }] };
              return Response.json(payload);
            }
            return original(input, init);
          };
        });
        await input.fill("Review the fictional records");
        await input.press("Enter");
        const log = root.getByRole("log", { name: "AI conversation", exact: true });
        await log.getByText(/Record 35:/).waitFor();
        const bottom = () =>
          log.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop < 2);
        await page.waitForFunction(() => {
          const node = [...document.querySelectorAll('[role="log"]')].find(
            (node) => node.getClientRects().length,
          );
          return (
            node &&
            node.scrollHeight > node.clientHeight &&
            node.scrollHeight - node.clientHeight - node.scrollTop < 2
          );
        });
        await log.evaluate((node) => {
          node.scrollTop = 80;
        });
        const jump = root.getByRole("button", { name: "Jump to latest", exact: true });
        await jump.waitFor();
        const before = await log.evaluate((node) => node.scrollTop);
        await page.evaluate(() =>
          window.__aiReadingEmit(
            "\n\nNew streamed detail: The customer needs a confirmed next step.",
          ),
        );
        await log.getByText(/New streamed detail:/).waitFor();
        assert.ok(
          Math.abs((await log.evaluate((node) => node.scrollTop)) - before) <= 1,
          "Streaming preserves the reader's position",
        );
        await page.screenshot({ path: `${output}/ai-reading-paused-${mode}-${reducedMotion}.png` });
        await jump.focus();
        await jump.press("Enter");
        await jump.waitFor({ state: "hidden" });
        assert.ok(await bottom(), "Keyboard jump returns to latest");
        assert.ok(
          await log.evaluate((node) => node === document.activeElement),
          "Jump keeps keyboard focus in the conversation",
        );
        await page.evaluate(() =>
          window.__aiReadingEmit(
            "\n\nAnother streamed detail: Continue checking the retained evidence.",
          ),
        );
        await log.getByText(/Another streamed detail:/).waitFor();
        await page.waitForFunction(() => {
          const node = [...document.querySelectorAll('[role="log"]')].find(
            (node) => node.getClientRects().length,
          );
          return node.scrollHeight - node.clientHeight - node.scrollTop < 2;
        });
        await page.evaluate(() => window.__aiReadingEmit("", true));
        await root.getByRole("button", { name: "Send AI command" }).waitFor();
        await input.fill("First line");
        const singleHeight = await input.evaluate((node) => node.getBoundingClientRect().height);
        await input.press("Shift+Enter");
        await input.press("Shift+Enter");
        await input.press("Shift+Enter");
        await input.press("Shift+Enter");
        await input.press("Shift+Enter");
        await page.waitForFunction(
          () =>
            document
              .querySelector('textarea[aria-label="Ask the business"]')
              ?.getBoundingClientRect().height > 80,
        );
        const multilineHeight = await input.evaluate((node) => node.getBoundingClientRect().height);
        assert.ok(
          multilineHeight > singleHeight && multilineHeight <= 128,
          "Multiline input grows within its cap",
        );
        await input.evaluate((node) =>
          node.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }),
          ),
        );
        await input.evaluate((node) =>
          node.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true }),
          ),
        );
        assert.equal(
          await page.evaluate(() => window.__aiReadingRequests),
          1,
          "Composition and Shift+Enter do not send unfinished text",
        );
        await page.screenshot({
          path: `${output}/ai-reading-composer-${mode}-${reducedMotion}.png`,
        });
        await log.evaluate((node) => {
          node.scrollTop = 40;
        });
        await jump.waitFor();
        await input.fill("My next question");
        await input.press("Enter");
        await page.waitForFunction(() => window.__aiReadingRequests === 2);
        await jump.waitFor({ state: "hidden" });
        await page.waitForFunction(() => {
          const node = [...document.querySelectorAll('[role="log"]')].find(
            (node) => node.getClientRects().length,
          );
          return node.scrollHeight - node.clientHeight - node.scrollTop < 2;
        });
        await page.evaluate(() => window.__aiReadingEmit("", true));
        await root.getByRole("button", { name: "Send AI command" }).waitFor();
        await log.evaluate((node) => {
          node.scrollTop = 40;
        });
        await jump.waitFor();
        if (mode === "panel")
          await root
            .getByRole("combobox", { name: "AI conversation" })
            .selectOption("reading-history");
        else await root.getByRole("button", { name: "Saved reading review", exact: true }).click();
        await log.getByText(/Saved record 40:/).waitFor();
        await jump.waitFor({ state: "hidden" });
        await page.waitForFunction(() => {
          const node = [...document.querySelectorAll('[role="log"]')].find(
            (node) => node.getClientRects().length,
          );
          return node.scrollHeight - node.clientHeight - node.scrollTop < 2;
        });
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          "Chat fits the viewport",
        );
        assert.deepEqual(errors, []);
        results.push({
          mode,
          reducedMotion,
          result: "passed",
          checks: [
            "stream follows latest",
            "reading position retained",
            "keyboard jump",
            "multiline growth",
            "IME composition",
            "new question resumes",
            "history resumes",
            "viewport",
            "console",
          ],
        });
        await writeFile(`${output}/ai-reading.json`, JSON.stringify(results, null, 2));
      } finally {
        await context.close();
      }
    }
  }
  return results;
}
