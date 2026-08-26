import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3010";
const output = "/tmp/accelerate-public-motion";
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];
const routes = ["/", "/services", "/industries", "/learn", "/work", "/work/work-shelter", "/command-center", "/contact"];
const smokeRoutes = [
  "/", "/about", "/blog", "/changelog", "/command-center", "/command-center/demo", "/contact",
  "/industries", "/industries/auto-dealers", "/industries/home-services", "/industries/insurance-agencies",
  "/industries/law-firms", "/industries/manufacturing", "/industries/medical-dental", "/industries/nonprofits",
  "/industries/professional-services", "/industries/real-estate", "/industries/startups", "/learn", "/packages",
  "/partners", "/plan-builder", "/privacy", "/resources", "/results", "/roofing", "/services", "/style-guide",
  "/terms", "/work", "/work/work-shelter", "/work/healthcare-real-estate", "/work/superdebate", "/work/sparkblox",
  "/work/thrive-protocol", "/work/green-goods", "/work/northern-trust", "/results/sparkblox",
  "/results/farrell-roofing", "/results/montoya-capital",
];

async function inspectInitial(page, route, label) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  if (!response || response.status() >= 400) failures.push(`${label} ${route}: HTTP ${response?.status() ?? "no response"}`);
  const initial = await page.evaluate(() => {
    const main = document.querySelector("main");
    const entry = document.querySelector("[data-route-entry]");
    return {
      mainOpacity: main ? Number.parseFloat(getComputedStyle(main).opacity) : 0,
      entryOpacity: entry ? Number.parseFloat(getComputedStyle(entry).opacity) : 1,
      visibleText: main?.innerText.trim().length ?? 0,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  if (initial.mainOpacity < 0.9 || initial.entryOpacity < 0.9) failures.push(`${label} ${route}: prerendered route began hidden (${initial.mainOpacity}/${initial.entryOpacity})`);
  if (initial.visibleText < 20) failures.push(`${label} ${route}: main content was not present at DOMContentLoaded`);
  if (initial.overflow) failures.push(`${label} ${route}: horizontal overflow`);
}

async function inspectRoute(page, route, label, scrollDelay) {
  await inspectInitial(page, route, label);

  await page.evaluate(async (delayMs) => {
    const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    let previousHeight = 0;
    for (let pass = 0; pass < 4; pass += 1) {
      const targetHeight = document.body.scrollHeight;
      for (let y = pass === 0 ? 0 : window.scrollY; y < targetHeight; y += Math.max(220, Math.floor(window.innerHeight * 0.55))) {
        window.scrollTo(0, y);
        await pause(delayMs);
      }
      window.scrollTo(0, document.body.scrollHeight);
      await pause(250);
      const currentHeight = document.body.scrollHeight;
      const atBottom = window.scrollY + window.innerHeight >= currentHeight - 2;
      if (atBottom && currentHeight === previousHeight) break;
      previousHeight = currentHeight;
    }
    await pause(300);
  }, scrollDelay);
  await page.waitForFunction(() => ![...document.querySelectorAll(".rv.rv-ready:not(.in), .item-rv.rv-ready:not(.in), .section-reveal.rv-ready:not(.in)")].some((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top < innerHeight + 40 && rect.bottom > -40 && Number.parseFloat(getComputedStyle(node).opacity) < 0.9;
  }), null, { timeout: 2_000 }).catch(() => null);
  const stranded = await page.locator(".rv.rv-ready:not(.in), .item-rv.rv-ready:not(.in), .section-reveal.rv-ready:not(.in)").evaluateAll((nodes) => nodes.filter((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top < innerHeight + 40 && rect.bottom > -40 && Number.parseFloat(getComputedStyle(node).opacity) < 0.9;
  }).length);
  if (stranded) failures.push(`${label} ${route}: ${stranded} reveal elements remained stranded after traversal`);
}

async function captureRevealEntry(page, selector) {
  await page.waitForFunction((target) => document.querySelector(`${target}.work-reveal-ready:not(.in), ${target}.rv-ready:not(.in)`), selector);
  const handle = await page.locator(`${selector}.work-reveal-ready:not(.in), ${selector}.rv-ready:not(.in)`).first().elementHandle();
  if (!handle) return null;
  for (let step = 0; step < 240 && !(await handle.evaluate((node) => node.classList.contains("in"))); step += 1) {
    await page.evaluate(() => window.scrollBy(0, 12));
    await page.waitForTimeout(16);
  }
  return handle.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, ratio: rect.top / innerHeight, height: innerHeight, role: node.getAttribute("data-motion-role") };
  });
}

for (const config of [
  { label: "mobile", viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" },
  { label: "reduced", viewport: { width: 430, height: 932 }, reducedMotion: "reduce" },
  { label: "desktop", viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" },
]) {
  const context = await browser.newContext({ viewport: config.viewport, reducedMotion: config.reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    if (["/api/event", "/js/script.js"].includes(url.pathname)) return;
    errors.push(`${response.status()} ${url.pathname}`);
  });
  for (const route of smokeRoutes) await inspectInitial(page, route, config.label);
  for (const route of routes) await inspectRoute(page, route, config.label, config.label === "desktop" ? 120 : 24);

  await page.goto(`${baseUrl}/work`, { waitUntil: "domcontentloaded" });
  if (config.reducedMotion === "no-preference") {
    const headingAnimation = await page.locator(".word-mask-word > span").first().evaluate((node) => getComputedStyle(node).animationName);
    if (!headingAnimation.includes("word-mask-entry")) failures.push(`${config.label}: heading entrance animation is not active`);
    const indexHeroSequence = await page.locator(".work-hero-enter").evaluateAll((nodes) => nodes.map((node) => ({ name: getComputedStyle(node).animationName, delay: getComputedStyle(node).animationDelay })));
    if (indexHeroSequence.length < 4 || new Set(indexHeroSequence.map((item) => item.delay)).size !== indexHeroSequence.length || indexHeroSequence.some((item) => !item.name.includes("work-hero-in"))) failures.push(`${config.label}: Work hero items are not individually staggered`);
    const cardEntry = await captureRevealEntry(page, '[data-motion-role="card"]');
    if (!cardEntry || cardEntry.ratio > 0.8) failures.push(`${config.label}: Work card entered too early at ${cardEntry ? Math.round(cardEntry.ratio * 100) : "unknown"}% of viewport height`);
    const cardStagger = await page.locator('[data-motion-role="card"].in [data-work-stagger]').first().locator("xpath=..").locator("[data-work-stagger]").evaluateAll((nodes) => nodes.map((node) => ({ name: getComputedStyle(node).animationName, delay: getComputedStyle(node).animationDelay })));
    if (cardStagger.length < 5 || new Set(cardStagger.map((item) => item.delay)).size < 5 || cardStagger.some((item) => !item.name.includes("work-reveal-in"))) failures.push(`${config.label}: Work card does not use five visible stagger steps`);
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${output}/${config.label}-work-card-entry.png`, fullPage: false });
    const pendingLocator = page.locator(".work-reveal.work-reveal-ready:not(.in)").first();
    const pending = await pendingLocator.count() ? await pendingLocator.elementHandle() : null;
    if (pending) {
      for (let attempt = 0; attempt < 20 && await pending.evaluate((node) => node.getAttribute("data-reveal-state")) !== "visible"; attempt += 1) {
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(140);
      }
      await page.waitForTimeout(100);
      const revealFacts = await pending.evaluate((node) => {
        const role = node.getAttribute("data-motion-role");
        const animatedNode = role === "group" ? node.firstElementChild : role === "card" ? node.querySelector("[data-work-stagger]") : node;
        return { state: node.getAttribute("data-reveal-state"), animation: animatedNode ? getComputedStyle(animatedNode).animationName : "none" };
      });
      if (revealFacts.state !== "visible" || !revealFacts.animation.startsWith("work-")) failures.push(`${config.label}: below-fold Work content did not animate at viewport entry`);
    } else failures.push(`${config.label}: no below-fold reveal remained armed for viewport entry`);
  }
  const firstCard = page.locator('[data-work-card="work-shelter"] a').first();
  await firstCard.click();
  await page.waitForURL("**/work/work-shelter");
  const linkedRouteFacts = await page.locator("[data-route-entry]").evaluate((node) => ({ opacity: Number.parseFloat(getComputedStyle(node).opacity), animation: getComputedStyle(node).animationName }));
  if (linkedRouteFacts.opacity < 0.9) failures.push(`${config.label}: client-side Work navigation produced a hidden incoming route`);
  if (config.reducedMotion === "no-preference" && !linkedRouteFacts.animation.includes("route-entry-in")) failures.push(`${config.label}: client-side route entrance animation is not active`);
  if (config.reducedMotion === "no-preference") {
    const heroSequence = await page.locator(".work-hero-enter, .work-hero-meta > *").evaluateAll((nodes) => nodes.map((node) => ({ name: getComputedStyle(node).animationName, delay: Number.parseFloat(getComputedStyle(node).animationDelay) })));
    const orderedDelays = [...heroSequence].map((item) => item.delay).sort((a, b) => a - b);
    if (heroSequence.length < 8 || heroSequence.some((item) => !item.name.includes("work-hero-in")) || new Set(orderedDelays).size < 5) failures.push(`${config.label}: case hero is not split into a coherent stagger sequence`);
    const mediaEntry = await captureRevealEntry(page, '[data-motion-role="media"]');
    if (!mediaEntry || mediaEntry.ratio > 0.8) failures.push(`${config.label}: case media entered too early at ${mediaEntry ? Math.round(mediaEntry.ratio * 100) : "unknown"}% of viewport height`);
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${output}/${config.label}-case-media-entry.png`, fullPage: false });
  }
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.goForward({ waitUntil: "domcontentloaded" });
  if (await page.locator("[data-route-entry]").evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity)) < 0.9) failures.push(`${config.label}: back-forward navigation produced hidden content`);

  if (config.reducedMotion === "no-preference") {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(50);
    const homeEntry = await captureRevealEntry(page, ".rv");
    if (!homeEntry || homeEntry.ratio > 0.8) failures.push(`${config.label}: homepage content entered too early at ${homeEntry ? Math.round(homeEntry.ratio * 100) : "unknown"}% of viewport height`);
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${output}/${config.label}-home-entry.png`, fullPage: false });
  }

  if (config.label === "mobile") {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.scrollTo(0, 240));
    const bubble = page.getByRole("button", { name: "Open chat" });
    await bubble.waitFor();
    await bubble.click();
    const close = page.getByRole("button", { name: "Close chat" });
    await close.waitFor();
    await page.waitForTimeout(500);
    const chatFacts = await page.evaluate(() => {
      const root = document.querySelector(".chat-widget-root.is-open");
      const header = document.querySelector(".site-header");
      const closeButton = document.querySelector("[data-chat-close]");
      const rect = closeButton?.getBoundingClientRect();
      return {
        chatZ: root ? Number.parseInt(getComputedStyle(root).zIndex || "0", 10) : 0,
        headerZ: header ? Number.parseInt(getComputedStyle(header).zIndex || "0", 10) : 0,
        closeVisible: Boolean(rect && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight && rect.width >= 44 && rect.height >= 44),
        bodyLocked: document.body.style.overflow === "hidden",
        closeFocused: document.activeElement === closeButton,
      };
    });
    if (chatFacts.chatZ <= chatFacts.headerZ) failures.push("mobile chat does not stack above the site header");
    if (!chatFacts.closeVisible) failures.push("mobile chat close control is not fully visible and touch sized");
    if (!chatFacts.bodyLocked) failures.push("mobile chat did not lock background scrolling");
    if (!chatFacts.closeFocused) failures.push("mobile chat did not focus its close control");
    if (!(await page.getByRole("dialog", { name: "Accelerate AI" }).count())) failures.push("mobile chat is missing named modal dialog semantics");
    if (!(await page.locator("main[inert][aria-hidden='true']").count())) failures.push("mobile chat did not isolate background content");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    if (!(await close.evaluate((node) => document.activeElement === node))) failures.push("mobile chat focus escaped its keyboard loop");
    const chatA11y = await new AxeBuilder({ page }).include(".chat-panel").withTags(["wcag2a", "wcag2aa"]).analyze();
    const seriousChatViolations = chatA11y.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    if (seriousChatViolations.length) failures.push(`mobile chat accessibility: ${seriousChatViolations.map((violation) => violation.id).join(", ")}`);
    await page.screenshot({ path: `${output}/mobile-chat-open.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    if (await page.evaluate(() => document.body.style.overflow === "hidden")) failures.push("mobile chat did not restore body scrolling after close");
    if (!(await page.getByRole("button", { name: "Open chat" }).evaluate((node) => document.activeElement === node))) {
      failures.push("mobile chat did not return focus to its trigger after close");
    }
    await page.goto(`${baseUrl}/work`, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: `${output}/mobile-work.png`, fullPage: false });
  }
  if (config.label === "desktop") await page.screenshot({ path: `${output}/desktop-work-shelter.png`, fullPage: false });
  if (config.label === "reduced") {
    const animated = await page.evaluate(() => [...document.querySelectorAll("[data-motion-role], [data-route-entry]")].filter((node) => getComputedStyle(node).animationName !== "none" && Number.parseFloat(getComputedStyle(node).animationDuration) > 0).length);
    if (animated) failures.push(`reduced: ${animated} nonessential motion elements remained animated`);
  }
  if (errors.length) failures.push(`${config.label}: runtime errors: ${errors.join(" | ")}`);
  await context.close();
}

const delayed = await browser.newContext({ viewport: { width: 390, height: 844 } });
const delayedPage = await delayed.newPage();
await delayedPage.route("**/_next/static/chunks/*.js", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  await route.continue();
});
const delayedNavigation = delayedPage.goto(`${baseUrl}/work/work-shelter`, { waitUntil: "load" });
await delayedPage.waitForSelector("main");
const delayedInitial = await delayedPage.evaluate(() => ({
  text: document.querySelector("main")?.textContent?.trim().length ?? 0,
  hidden: [...document.querySelectorAll("[data-work-reveal], [data-work-media-reveal], [data-route-entry]")].filter((node) => Number.parseFloat(getComputedStyle(node).opacity) < 0.9).length,
}));
if (delayedInitial.text < 100 || delayedInitial.hidden) failures.push(`delayed hydration hid public content (${delayedInitial.text} chars, ${delayedInitial.hidden} hidden nodes)`);
await delayedNavigation;
await delayed.close();

const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
const noJsPage = await noJs.newPage();
await noJsPage.goto(`${baseUrl}/work/work-shelter`, { waitUntil: "domcontentloaded" });
const noJsFacts = await noJsPage.evaluate(() => ({
  text: document.querySelector("main")?.textContent?.trim().length ?? 0,
  hidden: [...document.querySelectorAll("[data-work-reveal], [data-work-media-reveal], [data-route-entry]")].filter((node) => Number.parseFloat(getComputedStyle(node).opacity) < 0.9).length,
}));
if (noJsFacts.text < 100 || noJsFacts.hidden) failures.push(`no-JavaScript Work page was not fail-open (${noJsFacts.text} chars, ${noJsFacts.hidden} hidden nodes)`);
await noJs.close();
await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({ smokeRoutes: smokeRoutes.length, traversalRoutes: routes.length, viewports: 3, delayedHydration: true, noJavaScript: true, chatMobile: true, accessibility: "axe wcag2a/wcag2aa", animationContracts: ["heading", "below-fold", "route"], screenshots: output, result: "passed" }, null, 2));
