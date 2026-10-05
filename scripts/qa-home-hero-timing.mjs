import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-home-hero-timing";
await mkdir(output, { recursive: true });
const failures = [];
const results = [];
const browser = await chromium.launch({ headless: true });
const fail = (condition, message) => {
  if (!condition) failures.push(message);
};
const screenshot = (page, label) => page.screenshot({ path: `${output}/${label}.png` });

try {
  for (const [label, width, height, theme] of [
    ["desktop", 1440, 900, "light"],
    ["desktop-dark", 1440, 900, "dark"],
    ["small-desktop", 1024, 900, "light"],
    ["tablet", 820, 1180, "light"],
    ["mobile", 390, 844, "light"],
    ["mobile-dark", 390, 844, "dark"],
    ["short-mobile", 390, 667, "light"],
    ["narrow-mobile", 320, 667, "light"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 1000,
      colorScheme: theme,
    });
    await context.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(`${label}: ${message.text()}`);
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    const opening = await page.evaluate(() => {
      const hero = document.querySelector(".home-hero");
      const heading = hero.querySelector("h1");
      const booking = hero.querySelector(".home-hero-cta").getBoundingClientRect();
      return {
        heading: heading.textContent.replace(/\s+/g, " ").trim(),
        support: hero.querySelector(".home-hero-support").textContent,
        aboveFold: booking.bottom <= innerHeight,
        headerGap:
          heading.getBoundingClientRect().top -
          document.querySelector(".site-header").getBoundingClientRect().bottom,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        buttons: hero.querySelectorAll("button, [role=tab], input[type=range]").length,
        canvases: hero.querySelectorAll("canvas").length,
      };
    });
    fail(
      opening.heading.includes("AI, built around") && opening.heading.includes("your business."),
      `${label}: headline is incomplete`,
    );
    fail(
      /make more money.*save more time/.test(opening.support),
      `${label}: offer omits the outcomes`,
    );
    fail(
      opening.aboveFold && opening.headerGap >= 20 && !opening.overflow,
      `${label}: booking, header clearance or containment failed`,
    );
    fail(
      !opening.buttons && !opening.canvases,
      `${label}: old selector or graphics dependency remains`,
    );
    await page.waitForFunction(() => document.querySelector(".home-hero").classList.contains("in"));

    // Seek the real CSS animations to inspect rendered opening and intermediate frames.
    if (label === "desktop" || label === "mobile") {
      await page.evaluate(() => {
        window.__heroAnimations = document
          .querySelector(".home-hero")
          .getAnimations({ subtree: true });
        window.__heroAnimations.forEach((animation) => animation.pause());
      });
      const frames = [];
      for (const time of [0, 600, 1000, 1700, 3200]) {
        await page.evaluate(
          (time) =>
            window.__heroAnimations.forEach((animation) => {
              animation.currentTime = time;
            }),
          time,
        );
        const frame = await page.evaluate(() => ({
          words: [...document.querySelectorAll(".home-hero-word")].map((word) => ({
            opacity: Number(getComputedStyle(word).opacity),
            y: new DOMMatrix(getComputedStyle(word).transform).m42,
            mask: getComputedStyle(word.parentElement).clipPath,
          })),
          action: Number(getComputedStyle(document.querySelector(".home-hero-actions")).opacity),
          artwork: Number(getComputedStyle(document.querySelector(".home-hero-artwork")).opacity),
        }));
        frames.push({ time, ...frame });
        if (time === 0)
          fail(
            frame.words.every((word) => word.opacity === 0) && frame.action === 0,
            `${label}: entrance opening is exposed`,
          );
        if (time === 1000)
          fail(
            frame.words.some((word) => word.opacity > 0 && word.opacity < 1),
            `${label}: headline has no perceptible transition`,
          );
        if (time === 3200)
          fail(
            frame.words.every(
              (word) => word.opacity === 1 && Math.abs(word.y) < 0.1 && word.mask !== "none",
            ) &&
              frame.action === 1 &&
              frame.artwork === 1,
            `${label}: entrance does not finish`,
          );
        await screenshot(page, `${label}-frame-${time}`);
      }
      await page.evaluate(() => window.__heroAnimations.forEach((animation) => animation.finish()));
      results.push({ label, frames });
    }
    await page.waitForTimeout(3300);
    const artwork = page.locator(".home-hero-artwork");
    const print = page.locator(
      width <= 640 ? ".home-hero-print-mobile" : ".home-hero-print-desktop",
    );
    fail(await print.isVisible(), `${label}: responsive artwork is missing`);
    const printed = await print.textContent();
    fail(
      /INQUIRY.*INBOX.*CRM.*FOLLOW-UP.*HANDOFF/s.test(printed),
      `${label}: artwork has no concrete connected workflow`,
    );
    const geometry = await print.evaluate((svg) => {
      const bounds = svg.closest("figure").getBoundingClientRect();
      return [...svg.querySelectorAll("text")].every((text) => {
        const rect = text.getBoundingClientRect();
        return (
          rect.x >= bounds.x - 1 &&
          rect.right <= bounds.right + 1 &&
          rect.y >= bounds.y - 1 &&
          rect.bottom <= bounds.bottom + 1
        );
      });
    });
    fail(geometry, `${label}: artwork typography is clipped`);
    await screenshot(page, `${label}-settled`);
    await artwork.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const visible = width <= 640 ? ".home-hero-print-mobile" : ".home-hero-print-desktop";
    const mark = page.locator(`${visible} .home-hero-print-mark`);
    const before = await mark.evaluate((node) => getComputedStyle(node).transform);
    const bounds = await artwork.boundingBox();
    if (width >= 1000) {
      const initial = await print.screenshot();
      await page.mouse.move(bounds.x + bounds.width * 0.9, bounds.y + bounds.height * 0.25);
      await page.waitForTimeout(90);
      const middle = await mark.evaluate((node) => getComputedStyle(node).transform);
      await page.waitForTimeout(900);
      const end = await mark.evaluate((node) => getComputedStyle(node).transform);
      fail(
        before !== middle && middle !== end && before !== end,
        `${label}: interaction lacks an intermediate transition`,
      );
      fail(
        !initial.equals(await print.screenshot()),
        `${label}: pointer changes no artwork pixels`,
      );
      await page.mouse.move(5, 5);
      await page.waitForTimeout(1000);
    } else {
      await page.touchscreen.tap(bounds.x + bounds.width * 0.85, bounds.y + bounds.height * 0.3);
      await page.waitForTimeout(150);
      fail(
        before !== (await mark.evaluate((node) => getComputedStyle(node).transform)),
        `${label}: touch produces no response`,
      );
      await page.waitForTimeout(1600);
    }
    const settled = await mark.evaluate((node) => getComputedStyle(node).transform);
    await page.waitForTimeout(300);
    fail(
      settled === (await mark.evaluate((node) => getComputedStyle(node).transform)),
      `${label}: artwork continues moving at rest`,
    );
    const cta = page.locator(".home-hero-cta");
    await cta.focus();
    const focus = await cta.evaluate((node) => {
      const style = getComputedStyle(node.parentElement);
      return (
        document.activeElement === node && style.opacity === "1" && style.pointerEvents !== "none"
      );
    });
    fail(focus, `${label}: booking focus is concealed`);
    if (label === "mobile") {
      await page.keyboard.press("Enter");
      await page.waitForURL("**/contact");
      await page.goBack();
      await page.waitForURL(base + "/");
      fail(await cta.isVisible(), "History restoration conceals booking");
      await page.getByRole("link", { name: "Services", exact: true }).first().click();
      await page.waitForURL("**/services");
      await page
        .getByRole("link", { name: /Accelerate.*home/i })
        .first()
        .click();
      await page.waitForURL(base + "/");
      await page.waitForTimeout(3300);
      fail(await cta.isVisible(), "Forward navigation conceals booking");
    }
    results.push({ label, opening, geometry, focus });
    await context.close();
  }

  for (const [label, options, delay] of [
    [
      "mobile-reduced",
      { reducedMotion: "reduce", viewport: { width: 390, height: 844 }, hasTouch: true },
      0,
    ],
    ["desktop-no-js", { javaScriptEnabled: false, viewport: { width: 1440, height: 900 } }, 0],
    ["mobile-delayed-js", { viewport: { width: 390, height: 844 } }, 1500],
    ["desktop-late-js", { viewport: { width: 1440, height: 900 } }, 5000],
    ["mobile-failed-js", { viewport: { width: 390, height: 844 } }, -1],
  ]) {
    const context = await browser.newContext(options);
    if (delay)
      await context.route("**/_next/static/**/*.js*", async (route) => {
        if (delay < 0) await route.abort();
        else {
          await new Promise((resolve) => setTimeout(resolve, delay));
          await route.continue();
        }
      });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(delay > 0 ? 3500 : delay < 0 ? 4500 : 300);
    const staticState = await page.evaluate(() => ({
      readable: [
        ...document.querySelectorAll(".home-hero-word, .home-hero-support, .home-hero-actions"),
      ].every((node) => getComputedStyle(node).opacity === "1"),
      graphic: [...document.querySelectorAll(".home-hero-print")].some(
        (node) =>
          getComputedStyle(node).display !== "none" && node.querySelectorAll("text").length === 4,
      ),
      running: document
        .querySelector(".home-hero")
        .getAnimations({ subtree: true })
        .some((animation) => animation.playState === "running"),
    }));
    fail(
      staticState.readable && staticState.graphic && !staticState.running,
      `${label}: fallback is incomplete or keeps animating`,
    );
    if (label === "mobile-reduced") {
      const print = page.locator(".home-hero-print-mobile");
      const frame = await print.screenshot();
      const bounds = await print.boundingBox();
      await page.touchscreen.tap(bounds.x + bounds.width * 0.85, bounds.y + bounds.height * 0.3);
      await page.waitForTimeout(400);
      fail(frame.equals(await print.screenshot()), "Reduced motion changes artwork pixels");
    }
    await screenshot(page, label);
    results.push({ label, ...staticState });
    await context.close();
  }
} finally {
  await browser.close();
}

const safari = await webkit.launch({ headless: true });
try {
  for (const [label, width, height] of [
    ["webkit-desktop", 1440, 900],
    ["webkit-mobile", 390, 844],
  ]) {
    const page = await safari.newPage({ viewport: { width, height } });
    page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3300);
    fail(await page.locator(".home-hero-cta").isVisible(), `${label}: booking is unavailable`);
    fail(
      await page
        .locator(width <= 640 ? ".home-hero-print-mobile" : ".home-hero-print-desktop")
        .isVisible(),
      `${label}: vector artwork is unavailable`,
    );
    await screenshot(page, `${label}-settled`);
    await page.close();
  }
} finally {
  await safari.close();
}
await writeFile(
  `${output}/results.json`,
  JSON.stringify({ result: failures.length ? "failed" : "passed", results, failures }, null, 2),
);
if (failures.length) {
  console.error(JSON.stringify({ result: "failed", failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", screenshots: output }));
