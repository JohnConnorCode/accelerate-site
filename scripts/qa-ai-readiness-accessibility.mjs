import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { calculateReadiness, publicPreview, readinessQuestions } from "../src/lib/ai-readiness.ts";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const answers = Object.fromEntries(
  readinessQuestions.map((question) => [question.id, question.options[0]?.value ?? "unknown"]),
);
const report = calculateReadiness(answers, {
  businessType: "professional services",
  teamSize: "2_to_5",
  priority: "save_time",
  bottleneck: "admin",
});
const preview = publicPreview(report);
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route("**/api/analytics/events", (route) =>
      route.fulfill({ status: 204, body: "" }),
    );
    await page.route("**/api/ai-readiness", async (route) => {
      const request = route.request().postDataJSON();
      await route.fulfill({
        json:
          request.action === "unlock"
            ? { sessionToken: "controlled-ai-readiness-session-token", report, persisted: false }
            : {
                sessionToken: "controlled-ai-readiness-session-token",
                preview,
                persisted: false,
              },
      });
    });

    const response = await page.goto(`${base}/ai-readiness`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${width}px assessment route loads`);
    if (process.env.AI_READINESS_QA_SCREENSHOTS === "1") {
      await page.screenshot({ path: `/tmp/ai-readiness-${width}-intro.png` });
    }
    const intro = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(intro.violations, [], `${width}px intro has no axe violations`);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    const motion = await page.evaluate(() => {
      const pageRoot = document.querySelector('[data-testid="ai-readiness-page"]');
      const orbit = document.querySelector('[data-readiness-visual] [class*="orbitRing"]');
      return {
        atmosphere: pageRoot ? getComputedStyle(pageRoot, "::after").animationName : "missing",
        orbit: orbit ? getComputedStyle(orbit).animationName : "missing",
      };
    });
    assert.match(motion.atmosphere, /readiness-atmosphere/, `${width}px background animates`);
    assert.match(motion.orbit, /readiness-orbit/, `${width}px signal map animates`);
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.getByRole("button", { name: /Start your assessment/ }).click();
    await page.waitForFunction(() =>
      document.activeElement?.textContent?.includes("Start with your context"),
    );
    assert.match(
      await page.evaluate(() => document.activeElement?.textContent ?? ""),
      /Start with your context/,
      "profile heading receives focus",
    );
    await page.getByLabel(/What kind of business do you run/).fill("professional services");
    await page.getByRole("button", { name: /Continue/ }).click();

    const firstQuestion = readinessQuestions[0];
    assert.ok(firstQuestion);
    const firstOptionLabel = firstQuestion.options[0]?.label;
    assert.ok(firstOptionLabel);
    const firstOption = page.getByRole("button", {
      name: firstOptionLabel,
      exact: true,
    });
    await firstOption.click();
    await page.getByRole("button", { name: /^Next/ }).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (prompt) =>
        document.activeElement?.tagName === "H1" &&
        document.activeElement.textContent?.trim() === prompt,
      readinessQuestions[1]?.prompt,
    );
    const transitionLayout = await page.evaluate(() => {
      const journey = document.querySelector(
        '[role="progressbar"][aria-label="Assessment journey progress"]',
      );
      const phase = document.querySelector('[data-testid="ai-readiness-phase"]');
      return {
        journeyBottom: journey?.getBoundingClientRect().bottom ?? 0,
        phaseTop: phase?.getBoundingClientRect().top ?? 0,
      };
    });
    assert.ok(
      transitionLayout.phaseTop >= transitionLayout.journeyBottom,
      `${width}px incoming question clears sticky journey progress`,
    );
    assert.equal(
      (await page.evaluate(() => document.activeElement?.textContent ?? "")).trim(),
      readinessQuestions[1]?.prompt,
      "forward navigation focuses the new question heading",
    );

    await page.getByRole("button", { name: /^Back/ }).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (prompt) =>
        document.activeElement?.tagName === "H1" &&
        document.activeElement.textContent?.trim() === prompt,
      firstQuestion.prompt,
    );
    assert.equal(
      (await page.evaluate(() => document.activeElement?.textContent ?? "")).trim(),
      firstQuestion.prompt,
      "back navigation focuses the prior question heading",
    );

    const progress = page.getByRole("progressbar", {
      name: /Assessment progress: question 1 of/i,
    });
    assert.match(await progress.getAttribute("aria-label"), /question 1 of/i);
    assert.ok(Number(await progress.getAttribute("aria-valuenow")) > 0);
    const progressAxe = await new AxeBuilder({ page })
      .withRules(["aria-progressbar-name"])
      .analyze();
    assert.deepEqual(progressAxe.violations, [], `${width}px progress has an accessible name`);

    for (let index = 0; index < readinessQuestions.length; index++) {
      const current = readinessQuestions[index];
      assert.ok(current);
      const optionLabel = current.options[0]?.label;
      assert.ok(optionLabel);
      await page.getByRole("button", { name: optionLabel, exact: true }).click();
      if (index === readinessQuestions.length - 1) {
        await page.getByRole("button", { name: /See my preview/ }).focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(
          () =>
            document.activeElement?.tagName === "H1" &&
            document.activeElement.textContent?.trim() === "Your AI readiness preview",
        );
      } else {
        await page.getByRole("button", { name: /^Next/ }).focus();
        await page.keyboard.press("Enter");
        const nextPrompt = readinessQuestions[index + 1]?.prompt;
        await page.waitForFunction(
          (prompt) =>
            document.activeElement?.tagName === "H1" &&
            document.activeElement.textContent?.trim() === prompt,
          nextPrompt,
        );
      }
    }

    await page.getByText(preview.summary).waitFor();
    if (process.env.AI_READINESS_QA_SCREENSHOTS === "1") {
      await page.screenshot({ path: `/tmp/ai-readiness-${width}-preview.png` });
    }
    const previewAxe = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(previewAxe.violations, [], `${width}px preview has no axe violations`);

    await page.getByRole("button", { name: /Unlock full action plan/ }).click();
    await page.getByLabel("Your name").fill("Controlled QA contact");
    await page.getByLabel("Work email").fill("qa@example.test");
    await page.getByLabel("Business name").fill("Controlled QA business");
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /Show my report/ }).click();
    await page.waitForFunction(
      () =>
        document.activeElement?.tagName === "H1" &&
        document.activeElement.textContent?.trim() === "Your next useful move is clearer now.",
    );
    const reportAxe = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(reportAxe.violations, [], `${width}px report has no axe violations`);
    if (process.env.AI_READINESS_QA_SCREENSHOTS === "1") {
      await page.screenshot({ path: `/tmp/ai-readiness-${width}-report.png` });
    }

    const dimensions = await page.evaluate(() => ({
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(dimensions.documentWidth, dimensions.width, `${width}px page has no overflow`);
    assert.deepEqual(errors, [], `${width}px flow has no browser errors`);
    results.push({ width, questionCount: readinessQuestions.length, dimensions });
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ result: "passed", viewports: results }, null, 2));
