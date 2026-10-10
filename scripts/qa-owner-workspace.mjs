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
  assert.equal(
    await page.evaluate(() => {
      const main = document.querySelector(".admin-main");
      return (
        document.documentElement.scrollWidth > innerWidth + 1 ||
        main.scrollWidth > main.clientWidth + 1
      );
    }),
    false,
    "The current workspace must fit the viewport without horizontal overflow",
  );
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
      await stable(page);
      const panel = page.locator(".admin-help-panel");
      assert.equal(await panel.getAttribute("inert"), "");
      assert.equal(await how.getAttribute("aria-controls"), await panel.getAttribute("id"));
      await how.focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("dialog", { name: "How Today works", exact: true })
        .getByText(/Saved result:/)
        .waitFor();
      assert.equal(await panel.evaluate((node) => node === document.activeElement), true);
      await page.keyboard.press("Tab");
      const closeHelp = panel.getByRole("button", { name: "Close help", exact: true });
      assert.equal(await closeHelp.evaluate((node) => node === document.activeElement), true);
      await page.keyboard.press("Shift+Tab");
      await page.waitForFunction(() => document.activeElement?.matches(".admin-help-trigger"));
      assert.equal(await how.getAttribute("aria-expanded"), "false");
      await how.click();
      const guide = panel.getByRole("link", { name: "Read the guide", exact: true });
      await guide.waitFor();
      await panel.evaluate(async (node) => {
        await Promise.all(node.getAnimations().map((animation) => animation.finished));
      });
      const bounds = await panel.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1);
      assert.ok(bounds.y + bounds.height <= 1001, "Help must fit the viewport");
      for (const control of [guide, closeHelp]) {
        const hitArea = await control.boundingBox();
        assert.ok(hitArea.height >= 40 && hitArea.width >= 40, "Help controls need usable targets");
      }
      const beforeHover = await guide.boundingBox();
      await guide.hover();
      assert.deepEqual(
        await guide.boundingBox(),
        beforeHover,
        "Hover must not shift the guide link",
      );
      await page.screenshot({ path: `${output}/help-open-${width}.png` });
      const closing = await page.evaluate(async () => {
        const panel = document.querySelector(".admin-help-panel");
        document.querySelector(".admin-help-close").click();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const animations = panel.getAnimations();
        for (const animation of animations) {
          animation.pause();
          animation.currentTime = animation.effect.getComputedTiming().endTime / 2;
        }
        return {
          mounted: panel.isConnected,
          inert: panel.inert,
          duration: getComputedStyle(panel).transitionDuration,
          opacity: Number(getComputedStyle(panel).opacity),
        };
      });
      assert.equal(closing.mounted, true, "Help must remain mounted during exit");
      assert.equal(closing.inert, true, "Closing help must stop accepting interaction immediately");
      if (width === 390) {
        assert.equal(closing.duration, "0s", "Reduced motion must skip the transition");
        assert.equal(closing.opacity, 0);
      } else {
        assert.ok(
          closing.opacity > 0 && closing.opacity < 1,
          "Normal-motion help must interpolate its exit",
        );
        await page.screenshot({ path: `${output}/help-exit-${width}.png` });
      }
      // Reverse the paused intermediate frame in the same browser task.
      await page.evaluate(() => {
        document
          .querySelector(".admin-help-panel")
          .getAnimations()
          .forEach((animation) => animation.play());
        document.querySelector(".admin-help-trigger").click();
      });
      await guide.waitFor();
      assert.equal(await panel.getAttribute("inert"), null);
      await guide.focus();
      await page.keyboard.press("Tab");
      await page.waitForFunction(() => document.activeElement?.matches(".admin-help-trigger"));
      assert.equal(await how.getAttribute("aria-expanded"), "false");
      await how.click();
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.activeElement?.matches(".admin-help-trigger"));
      assert.equal(await how.evaluate((element) => element === document.activeElement), true);
      await page.setViewportSize({ width, height: 480 });
      await how.click();
      await guide.waitFor();
      await panel.evaluate(async (node) => {
        await Promise.all(node.getAnimations().map((animation) => animation.finished));
      });
      const shortBounds = await panel.boundingBox();
      assert.ok(
        shortBounds.y >= 0 && shortBounds.y + shortBounds.height <= 481,
        "Help must remain usable on a short screen",
      );
      await page.screenshot({ path: `${output}/help-short-${width}.png` });
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(() => document.activeElement?.matches(".admin-help-trigger"));
      assert.equal(await how.getAttribute("aria-expanded"), "false");
      const workflows = page
        .locator("details")
        .filter({ has: page.getByText("Start a business workflow", { exact: true }) });
      await workflows.locator("summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await workflows.getByRole("link", { name: "Guide and setup", exact: true }).count(),
        6,
      );
      assert.equal(
        await workflows.getByRole("link", { name: "Open workspace", exact: true }).count(),
        6,
      );
      await workflows.locator("summary").click();
      await workflows.locator("summary").evaluate((element) => element.blur());
      await stable(page);
      await page.screenshot({ path: `${output}/today-${width}.png` });
      if (width === 1440) {
        assert.equal(
          await page
            .locator("[data-nav-section] > div > a > span.flex-1")
            .evaluateAll((labels) =>
              labels.every((label) => label.scrollWidth <= label.clientWidth + 1),
            ),
          true,
          "Sidebar group labels must remain fully readable",
        );
        // Screenshot annotations are capture-only DOM labels, never product UI.
        await page.evaluate(() => {
          for (const [selector, text] of [
            ["[data-page-start-hint]", "1"],
            ['[data-today-module="brief"]', "2"],
            ["details:has(summary)", "3"],
          ]) {
            const target = document.querySelector(selector);
            if (!target) continue;
            const rect = target.getBoundingClientRect();
            const label = document.createElement("span");
            label.dataset.captureAnnotation = "true";
            label.textContent = text;
            Object.assign(label.style, {
              position: "fixed",
              top: `${rect.top + 4}px`,
              left: `${rect.left - 29}px`,
              background: "#1f4135",
              color: "white",
              width: "22px",
              height: "22px",
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              font: "600 12px system-ui",
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
        await page.getByRole("link", { name: "Daily work", exact: true }).waitFor();
        await page.getByRole("button", { name: /Expand sidebar/ }).click();
      }
      const salesSources = page.locator('[data-business-review="sales"] a');
      assert.ok(
        (await salesSources.count()) > 1,
        "Sales must offer a source record as well as its workspace",
      );
      const recordHref = new URL(await salesSources.last().getAttribute("href"), page.url());
      await salesSources.last().click();
      await page.waitForURL(
        (url) => url.pathname === recordHref.pathname && url.search === recordHref.search,
      );
      await page
        .locator(".admin-main h1")
        .filter({ hasText: /^(?!Today$).+/ })
        .waitFor();
      await page.goBack();
      await ready(page, "northline-roofing");
      await page.locator('[data-today-module="brief"]').waitFor();
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
      assert.equal(await askFinding.count(), 1, "A sourced finding must offer contextual AI");
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
      await page
        .getByRole("button", { name: /Lena Walsh/ })
        .first()
        .click();
      const reply = page.getByPlaceholder("Write a reply, then review the recipient and message.");
      await reply.waitFor();
      const text =
        "Thanks for the details. We can inspect the roof this week; I’ll confirm the next available appointment.";
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
      await page
        .getByRole("button", { name: /Lena Walsh/ })
        .first()
        .click();
      await page.getByText(text, { exact: true }).first().waitFor();
      await stable(page);
      await page.screenshot({ path: `${output}/inquiry-${width}.png` });
      await page.getByText(text, { exact: true }).first().scrollIntoViewIfNeeded();
      await stable(page);
      await page.screenshot({ path: `${output}/inquiry-result-${width}.png` });
      console.log(`Inquiry ${width}: failed send retained draft, confirmed result survived reload`);

      // Start client work from a won engagement through its native approval and exact task.
      await goto("ledgerstone-advisory", "client-onboarding");
      await page.getByRole("combobox", { name: "Won opportunity" }).selectOption({ index: 1 });
      const taskTitle = "Confirm Castillo’s year-end kickoff";
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
      await page
        .getByText("Recorded task results", { exact: true })
        .first()
        .evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await stable(page);
      assert.equal(
        await page
          .getByText("Recorded task results", { exact: true })
          .first()
          .evaluate((element) => getComputedStyle(element.closest(".admin-surface")).transform),
        "none",
        "The settled result surface must release its temporary entrance transform",
      );
      assert.ok(
        !["both", "forwards"].includes(
          await page
            .getByText("Recorded task results", { exact: true })
            .first()
            .evaluate(
              (element) => getComputedStyle(element.closest(".admin-surface")).animationFillMode,
            ),
        ),
        "The completed entrance must not retain a paint layer over the recorded results",
      );
      writeFileSync(
        `${output}/onboarding-result-${width}.json`,
        JSON.stringify(
          await page
            .getByText("Recorded task results", { exact: true })
            .first()
            .evaluate((element) => {
              const ancestors = [];
              for (let current = element; current; current = current.parentElement) {
                const style = getComputedStyle(current);
                const rect = current.getBoundingClientRect();
                ancestors.push({
                  tag: current.tagName,
                  className: current.className,
                  top: rect.top,
                  bottom: rect.bottom,
                  opacity: style.opacity,
                  visibility: style.visibility,
                  transform: style.transform,
                });
              }
              return ancestors;
            }),
          null,
          2,
        ),
      );
      await page.screenshot({ path: `${output}/onboarding-result-${width}.png` });
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
      await goto("superdebate", "invoicing?view=create");
      await page.getByRole("button", { name: "Use sample invoice", exact: true }).click();
      await failNext(page, "/api/admin/plugins/workflow");
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
      await page.locator(`[data-action-id="${actionId}"]`).scrollIntoViewIfNeeded();
      await stable(page);
      await page.screenshot({ path: `${output}/invoice-result-${width}.png` });
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
