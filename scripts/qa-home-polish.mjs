import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045";
const output = process.env.HOME_POLISH_OUTPUT || "/tmp/accelerate-home-polish";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    for (const colorScheme of ["light", "dark"]) {
      const label = `${width}-${colorScheme}`;
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        colorScheme,
        reducedMotion: "no-preference",
        hasTouch: width < 1000,
      });
      await context.addInitScript((theme) => localStorage.setItem("theme", theme), colorScheme);
      await context.addInitScript(() => {
        window.__homeSequenceEvents = [];
        document.addEventListener("animationstart", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.matches("[data-home-step]")) return;
          const owner = target.closest(".home-sequence");
          window.__homeSequenceEvents.push({
            owner: owner?.dataset.qaEntryId,
            step: Number(target.dataset.homeStep),
            time: performance.now(),
          });
        });
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto(base, { waitUntil: "networkidle" });
      await page.locator(".home-hero-cta").waitFor();
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        colorScheme,
      );
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const order = await page
        .locator("#selected-work, #systems, #trades, #how, #plan")
        .evaluateAll((sections) => sections.map((section) => section.id));
      assert.deepEqual(order, ["selected-work", "systems", "trades", "how", "plan"]);
      assert.equal(await page.locator("#selected-work [data-work-card]").count(), 1);
      assert.equal(await page.locator(".home-work-link").count(), 3);
      await page.screenshot({ path: `${output}/${label}-hero.png` });
      const entrances = [];
      if ((width === 1440 || width === 390) && colorScheme === "light") {
        const owners = page.locator(
          "main .home-sequence, main .rv[data-reveal-state], main .item-rv[data-reveal-state]",
        );
        const armed = await owners.evaluateAll((nodes) =>
          nodes.map((node) => ({
            state: node.dataset.revealState,
            top: node.getBoundingClientRect().top,
          })),
        );
        assert.ok(
          armed.some((entry) => entry.state === "pending" && entry.top > 1000),
          `${label}: below-fold content is not armed`,
        );
        for (let index = 0; index < (await owners.count()); index++) {
          const owner = owners.nth(index);
          const wasPending = (await owner.getAttribute("data-reveal-state")) === "pending";
          await owner.evaluate((node, id) => {
            node.dataset.qaEntryId = String(id);
            node.scrollIntoView({ block: "center", behavior: "instant" });
          }, index);
          await page.waitForFunction(
            (id) =>
              document.querySelector(`[data-qa-entry-id="${id}"]`)?.dataset.revealState ===
              "visible",
            index,
          );
          const isSequence = await owner.evaluate((node) =>
            node.classList.contains("home-sequence"),
          );
          if (isSequence && wasPending) {
            await owner.screenshot({ path: `${output}/${label}-entry-${index}.png` });
          }
          await page.waitForTimeout(1150);
          const receipt = await owner.evaluate((node) => {
            const targets = node.classList.contains("home-sequence")
              ? [...node.querySelectorAll("[data-home-step]")]
              : [node];
            return {
              sequence: node.classList.contains("home-sequence"),
              targets: targets.map((target) => ({
                step: Number(target.dataset.homeStep),
                opacity: getComputedStyle(target).opacity,
                transform: getComputedStyle(target).transform,
                animation: getComputedStyle(target).animationName,
                delay: parseFloat(getComputedStyle(target).animationDelay),
              })),
              events: window.__homeSequenceEvents
                .filter((event) => event.owner === node.dataset.qaEntryId)
                .sort((a, b) => a.step - b.step),
            };
          });
          assert.ok(
            receipt.targets.every(
              (target) =>
                target.opacity === "1" &&
                (target.transform === "none" || target.transform === "matrix(1, 0, 0, 1, 0, 0)"),
            ),
            `${label} entrance ${index}: content did not settle`,
          );
          if (receipt.sequence) {
            assert.ok(
              receipt.targets.every(
                (target) =>
                  target.animation === "home-content-enter" || target.animation === "line-in",
              ),
              `${label} entrance ${index}: missing entrance`,
            );
            const sorted = receipt.targets.toSorted((a, b) => a.step - b.step);
            assert.ok(
              sorted.slice(1).every((target, i) => target.delay - sorted[i].delay >= 0.1),
              `${label} entrance ${index}: no semantic stagger`,
            );
            if (wasPending)
              assert.ok(
                receipt.events.length === receipt.targets.length &&
                  receipt.events
                    .slice(1)
                    .every((event, i) => event.time - receipt.events[i].time >= 30),
                `${label} entrance ${index}: phases started together`,
              );
          }
          entrances.push({ index, wasPending, ...receipt });
        }
      }
      for (const selector of [
        "#selected-work",
        "#systems",
        "#trades",
        "#command-center",
        "#how",
        "#plan",
        "#who",
        "#faq",
        "#call",
      ]) {
        await page.locator(selector).evaluate((section) => section.scrollIntoView());
        await page.waitForTimeout(1150);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${label} ${selector}: horizontal overflow`,
        );
        await page.screenshot({ path: `${output}/${label}-${selector.slice(1)}.png` });
      }
      // A call already in view replaces the floating call bar and clears the
      // chat's mobile offset. Test both re-entry and disappearance on scroll.
      await page.locator("#selected-work").evaluate((section) => section.scrollIntoView());
      await page.waitForFunction(() => document.body.dataset.mcta === "on");
      await page
        .locator("#plan [data-booking-cta]")
        .evaluate((cta) => cta.scrollIntoView({ block: "center" }));
      await page.waitForFunction(() => !document.body.hasAttribute("data-mcta"));
      await page.waitForFunction(() => !document.querySelector("[data-dock]"));
      await page.locator("#selected-work").evaluate((section) => section.scrollIntoView());
      await page.waitForFunction(() => document.body.dataset.mcta === "on");
      const project = page.locator(".home-work-link").first();
      const href = await project.getAttribute("href");
      await project.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(`${base}${href}`);
      await page.goBack({ waitUntil: "networkidle" });
      await page.locator("#selected-work").waitFor();
      assert.deepEqual(errors, [], `${label}: runtime errors`);
      results.push({ width, colorScheme, order, entrances, status: "passed" });
      await context.close();
    }
  }
  writeFileSync(`${output}/results.json`, JSON.stringify({ status: "passed", results }, null, 2));
  console.log(
    `PASS homepage composition, booking clearance, keyboard and navigation: ${results.length} viewports`,
  );
} finally {
  await browser.close();
}
