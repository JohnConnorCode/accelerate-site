import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3063";
const output = process.env.QA_OWNER_OUTPUT || "/tmp/accelerate-owner-workspace";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, timeout: 45000 });
const results = [];
async function ready(page, scenario) {
  await page.waitForFunction((id) => window.__accelerateAdminDemoRuntime === id, scenario);
  await page.locator(".admin-main h1").waitFor();
}
async function stable(page) {
  await page.locator("[data-admin-route-stage]").evaluate(async (root) => {
    await Promise.all(
      root
        .getAnimations({ subtree: true })
        .filter((animation) => Number.isFinite(animation.effect.getComputedTiming().endTime))
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}
async function failNext(page, path) {
  await page.evaluate((path) => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url, location.origin);
      if (url.pathname === path && init?.method === "POST") {
        window.fetch = original;
        return Response.json(
          { error: "Controlled workflow failure. Review and retry." },
          { status: 503 },
        );
      }
      return original(input, init);
    };
  }, path);
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [],
      escaped = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/admin")) escaped.push(request.url());
    });
    const goto = async (scenario, path) => {
      await page.goto(`${base}/demo/command-center/${scenario}/${path}`);
      await ready(page, scenario);
    };
    try {
      await goto("northline-roofing", "today");
      await page.locator('[data-business-review="sales"]').waitFor();
      assert.equal(await page.locator("[data-business-review]").count(), 4);
      await page.locator("[data-page-start-hint]").waitFor();
      const how = page.getByRole("button", { name: "How this works", exact: true });
      await how.focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("dialog", { name: "How Today works", exact: true })
        .getByText(/Saved result:/)
        .waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await how.evaluate((element) => element === document.activeElement), true);
      const walkthroughs = page
        .locator("details")
        .filter({ has: page.getByText("How do I get work done?", { exact: true }) });
      await walkthroughs.locator("summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await walkthroughs.getByRole("link", { name: "Read the walkthrough", exact: true }).count(),
        3,
      );
      await walkthroughs.locator("summary").click();
      await stable(page);
      await page.screenshot({ path: `${output}/today-${width}.png` });
      if (width === 1440) {
        // Screenshot annotations are capture-only DOM labels, never product UI.
        await page.evaluate(() => {
          for (const [selector, text] of [
            ["[data-page-start-hint]", "1 · First useful action"],
            ['[data-today-module="brief"]', "2 · Business findings and their sources"],
            ["details summary", "3 · Connected worked examples"],
          ]) {
            const target = document.querySelector(selector);
            if (!target) continue;
            const rect = target.getBoundingClientRect();
            const label = document.createElement("span");
            label.dataset.captureAnnotation = "true";
            label.textContent = text;
            Object.assign(label.style, {
              position: "fixed",
              top: `${Math.max(0, rect.top - 24)}px`,
              left: `${rect.left}px`,
              background: "#1f4135",
              color: "white",
              padding: "4px 8px",
              borderRadius: "5px",
              font: "600 11px system-ui",
              zIndex: "10000",
            });
            document.body.append(label);
          }
        });
        await page.screenshot({ path: `${output}/today-annotated.png` });
        await page
          .locator("[data-capture-annotation]")
          .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
        await page.getByRole("button", { name: /Collapse sidebar/ }).click();
        await page.getByRole("link", { name: "Business overview", exact: true }).waitFor();
        await page.getByRole("button", { name: /Expand sidebar/ }).click();
      }
      const source = page.locator('[data-business-review] a[href*="?task="]').first();
      if (await source.count()) {
        const sourceHref = await source.getAttribute("href");
        await source.click();
        await page.getByRole("dialog", { name: "Task details", exact: true }).waitFor();
        assert.equal(
          new URL(page.url()).searchParams.get("task"),
          new URL(sourceHref, base).searchParams.get("task"),
        );
        await page.goBack();
        await ready(page, "northline-roofing");
        await page.locator('[data-today-module="brief"]').waitFor();
      }
      const askFinding = page.locator("[data-business-review] button").first();
      if (await askFinding.count()) {
        await askFinding.click();
        const panel = page.getByRole("dialog", { name: "Ask AI", exact: true });
        const prompt = await panel
          .getByRole("textbox", { name: "Ask the business", exact: true })
          .inputValue();
        assert.ok(
          prompt.includes("Read ") &&
            prompt.includes("/admin/") &&
            prompt.includes("Check current source status"),
        );
        await panel.getByRole("button", { name: "Close AI panel", exact: true }).click();
      }
      console.log(
        `Owner review ${width}: context, keyboard, workflow discovery and source navigation passed`,
      );

      // Answer an inquiry using the real shared composer, with a retained failed draft.
      await goto("northline-roofing", "conversations");
      const reply = page.getByPlaceholder("Write a reply, then review the recipient and message.");
      await reply.waitFor();
      const text = `Owner workflow reply ${width}: We can review the inspection request and confirm the next available appointment.`;
      await reply.fill(text);
      await page.getByRole("button", { name: "Review & Send", exact: true }).click();
      await failNext(page, "/api/admin/revenue-os/conversations/reply");
      await page.getByRole("button", { name: "Confirm send", exact: true }).click();
      await page
        .getByText("Controlled workflow failure. Review and retry.", { exact: true })
        .first()
        .waitFor();
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      assert.equal(await reply.inputValue(), text);
      await page.getByRole("button", { name: "Review & Send", exact: true }).click();
      await page.getByRole("button", { name: "Confirm send", exact: true }).click();
      await reply.waitFor();
      assert.equal(await reply.inputValue(), "");
      await page.reload();
      await ready(page, "northline-roofing");
      await page.getByText(text, { exact: true }).first().waitFor();
      await stable(page);
      await page.screenshot({ path: `${output}/inquiry-${width}.png` });
      console.log(`Inquiry ${width}: failed send retained draft, confirmed result survived reload`);

      // Start client work from a won engagement through its native approval and exact task.
      await goto("ledgerstone-advisory", "client-onboarding");
      await page.getByRole("combobox", { name: "Won opportunity" }).selectOption({ index: 1 });
      const taskTitle = `Owner kickoff handoff ${width}`;
      await page.getByLabel("Task 1", { exact: true }).fill(taskTitle);
      await failNext(page, "/api/admin/plugins/workflow");
      await page.getByRole("button", { name: "Review workflow", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Controlled workflow failure" }).waitFor();
      assert.equal(await page.getByLabel("Task 1", { exact: true }).inputValue(), taskTitle);
      await page.getByRole("button", { name: "Review workflow", exact: true }).click();
      await page.getByRole("button", { name: "Request approval", exact: true }).click();
      await page
        .getByRole("button", { name: "Approve & create tasks", exact: true })
        .first()
        .click();
      await page.getByText("Recorded task results", { exact: true }).first().waitFor();
      await page.locator(".admin-main").evaluate((element) => {
        element.scrollTop = 0;
      });
      await stable(page);
      await page.screenshot({ path: `${output}/onboarding-${width}.png` });
      const tasks = await page.evaluate(
        async () => (await (await fetch("/api/admin/tasks?owner=team&status=all")).json()).tasks,
      );
      const created = tasks.find((task) => task.title === taskTitle);
      assert.ok(created?.id);
      await goto("ledgerstone-advisory", `work?task=${created.id}`);
      await page
        .getByRole("dialog", { name: "Task details", exact: true })
        .getByRole("textbox", { name: "Title", exact: true })
        .waitFor();
      await page.reload();
      await ready(page, "ledgerstone-advisory");
      assert.equal(
        await page
          .getByRole("dialog", { name: "Task details", exact: true })
          .getByRole("textbox", { name: "Title", exact: true })
          .inputValue(),
        taskTitle,
      );
      await goto("ledgerstone-advisory", "today");
      await page.locator('[data-business-review="delivery"]').waitFor();
      console.log(
        `Client handoff ${width}: preview failure retained input; task identity and reload passed`,
      );

      // Invoice preparation, creation and sending each have separate recorded outcomes.
      await goto("superdebate", "invoicing");
      await page.getByRole("button", { name: "Use sample invoice", exact: true }).click();
      await failNext(page, "/api/admin/invoicing");
      await page.getByRole("button", { name: "Prepare invoice", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Controlled workflow failure" }).waitFor();
      await page.getByRole("button", { name: "Prepare invoice", exact: true }).click();
      await page.locator(".admin-main").evaluate((element) => {
        element.scrollTop = 0;
      });
      await stable(page);
      await page.screenshot({ path: `${output}/invoice-prepared-${width}.png` });
      await page.getByRole("button", { name: "Request draft approval", exact: true }).click();
      const article = page
        .locator("article")
        .filter({ has: page.getByRole("button", { name: "Approve & create draft", exact: true }) })
        .first();
      const actionId = await article.getAttribute("data-action-id");
      assert.ok(actionId);
      await article.getByRole("button", { name: "Approve & create draft", exact: true }).click();
      const createdInvoice = page.locator(`[data-action-id="${actionId}"]`);
      await createdInvoice
        .getByRole("button", { name: "Request sending approval", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Approve & send invoice", exact: true })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Approve & send invoice", exact: true })
        .waitFor({ state: "detached" });
      await page.reload();
      await ready(page, "superdebate");
      await page.locator(`[data-action-id="${actionId}"]`).waitFor();
      const invoice = await page.evaluate(
        async (id) => await (await fetch(`/api/admin/invoicing?actionId=${id}`)).json(),
        actionId,
      );
      assert.ok(invoice?.invoiceId);
      assert.notEqual(invoice.status, "paid", "Sending cannot imply payment");
      await stable(page);
      await page.screenshot({ path: `${output}/invoice-${width}.png` });
      await goto("superdebate", "today");
      await page.locator('[data-business-review="money"]').waitFor();
      await page.getByRole("button", { name: "Refresh Today", exact: true }).click();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(escaped, []);
      results.push({
        width,
        inquiry: "confirmed and reloaded",
        onboarding: "created exact task and reloaded",
        invoice: "created and sent, payment separate",
        errors,
        escaped,
      });
    } catch (error) {
      await page
        .screenshot({ path: `${output}/failure-${width}.png`, fullPage: true })
        .catch(() => {});
      writeFileSync(
        `${output}/failure-${width}.json`,
        JSON.stringify(
          {
            url: page.url(),
            errors,
            escaped,
            error: String(error),
            body: await page.locator("body").innerText(),
          },
          null,
          2,
        ),
      );
      throw error;
    } finally {
      await context.close();
    }
  }
  writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "PASS: owner context and all three connected workflows, desktop and reduced-motion phone.",
  );
} finally {
  await browser.close();
}
