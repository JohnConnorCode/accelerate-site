import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3010";
const routes = ["/work", "/work/work-shelter", "/work/healthcare-real-estate", "/work/superdebate", "/work/sparkblox", "/work/thrive-protocol", "/work/green-goods"];
const output = "/tmp/accelerate-work-portfolio-qa";
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];
const viewports = [
  { name: "desktop", width: 1440, height: 900, colorScheme: "light", reducedMotion: "no-preference" },
  { name: "tablet", width: 834, height: 1112, colorScheme: "light", reducedMotion: "reduce" },
  { name: "mobile", width: 430, height: 932, colorScheme: "dark", reducedMotion: "no-preference" },
  { name: "mobile-small", width: 390, height: 844, colorScheme: "dark", reducedMotion: "reduce" },
];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: viewport.colorScheme, reducedMotion: viewport.reducedMotion });
  await context.addInitScript((theme) => window.localStorage.setItem("theme", theme), viewport.colorScheme);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  for (const route of routes) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1100);
    if (!response || response.status() >= 400) failures.push(`${viewport.name} ${route}: HTTP ${response?.status() ?? "no response"}`);

    const pageFacts = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      h1Count: document.querySelectorAll("h1").length,
      missingImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
      hiddenReveals: [...document.querySelectorAll("[data-work-reveal]")].filter((node) => Number.parseFloat(getComputedStyle(node).opacity) < 0.99).length,
      workRevealCount: document.querySelectorAll("[data-work-reveal]").length,
      canonicalRevealCount: document.querySelectorAll("[data-work-reveal].work-reveal.rv").length,
      mediaCount: document.querySelectorAll("main figure").length,
      mediaRevealCount: [...document.querySelectorAll("main figure")].filter((node) => node.closest("[data-work-media-reveal].work-reveal, [data-motion-role='card'].work-reveal")).length,
      sharedHeadingCount: document.querySelectorAll("h1.reveal-self").length,
    }));
    if (pageFacts.overflow) failures.push(`${viewport.name} ${route}: horizontal overflow`);
    if (pageFacts.h1Count !== 1) failures.push(`${viewport.name} ${route}: expected one h1, found ${pageFacts.h1Count}`);
    if (pageFacts.missingImages.length) failures.push(`${viewport.name} ${route}: broken images ${pageFacts.missingImages.join(", ")}`);
    if (!pageFacts.workRevealCount) failures.push(`${viewport.name} ${route}: portfolio motion hooks are missing`);
    if (pageFacts.canonicalRevealCount !== pageFacts.workRevealCount) failures.push(`${viewport.name} ${route}: portfolio reveals are not using the shared Work motion primitive`);
    if (pageFacts.mediaRevealCount !== pageFacts.mediaCount) failures.push(`${viewport.name} ${route}: ${pageFacts.mediaCount - pageFacts.mediaRevealCount} portfolio media items lack Work motion coverage`);
    if (pageFacts.sharedHeadingCount !== 1) failures.push(`${viewport.name} ${route}: expected one shared word-mask hero heading, found ${pageFacts.sharedHeadingCount}`);
    if (viewport.reducedMotion === "reduce" && pageFacts.hiddenReveals) failures.push(`${viewport.name} ${route}: ${pageFacts.hiddenReveals} reduced-motion reveals remained hidden`);
    if (viewport.reducedMotion === "no-preference" && ["/work", "/work/work-shelter"].includes(route)) {
      const pendingReveal = page.locator("html.motion-ready .work-reveal:not(.in)").first();
      if (!(await pendingReveal.count())) failures.push(`${viewport.name} ${route}: no below-fold Work entrance remained armed`);
      else {
        const pendingElement = await pendingReveal.elementHandle();
        for (let attempt = 0; attempt < 20 && await pendingElement?.evaluate((node) => node.getAttribute("data-reveal-state")) !== "visible"; attempt += 1) {
          await page.mouse.wheel(0, 500);
          await page.waitForTimeout(140);
        }
        const entry = await pendingElement?.evaluate((node) => {
          const role = node.getAttribute("data-motion-role");
          const animationTarget = role === "group" ? node.firstElementChild : role === "card" ? node.querySelector("[data-work-stagger]") : node;
          return { state: node.getAttribute("data-reveal-state"), animation: animationTarget ? getComputedStyle(animationTarget).animationName : "none" };
        }) ?? { state: "missing", animation: "none" };
        if (entry.state !== "visible" || !entry.animation.startsWith("work-")) failures.push(`${viewport.name} ${route}: Work entrance did not trigger at viewport entry (${entry.state}/${entry.animation})`);
      }
    }
    const undersizedTargets = await page.locator("main a, main button").evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { label: (node.textContent || node.getAttribute("aria-label") || node.tagName).trim().slice(0, 40), width: rect.width, height: rect.height };
    }).filter((target) => target.width < 40 || target.height < 40));
    if (undersizedTargets.length) failures.push(`${viewport.name} ${route}: undersized targets ${JSON.stringify(undersizedTargets)}`);
    if (route === "/work/green-goods") {
      const contextGraphic = page.locator('img[src*="project-context"]');
      if (await contextGraphic.count() !== 1) failures.push(`${viewport.name} ${route}: Green Goods context graphic is missing`);
      else if (await contextGraphic.evaluate((image) => getComputedStyle(image).objectFit) !== "contain") failures.push(`${viewport.name} ${route}: Green Goods context graphic is cropped instead of contained`);
    }
    if (route === "/work/work-shelter") {
      const suppliedScreens = ["customer-site-hero", "catalog-experience", "brand-partners", "quote-flow-overview", "command-center-dashboard", "orders-workspace", "products-inventory", "campaign-admin-help"];
      for (const screen of suppliedScreens) if (await page.locator(`img[src*="${screen}"]`).count() !== 1) failures.push(`${viewport.name} ${route}: supplied screen ${screen} is missing or duplicated`);
      if (await page.locator('img[src*="quote-flow-detail"]').count()) failures.push(`${viewport.name} ${route}: redundant quote-flow detail is still rendered`);
    }
    if (route === "/work/superdebate") {
      const suppliedScreens = ["admin-dashboard", "admin-events", "admin-roadmap", "admin-email"];
      for (const screen of suppliedScreens) if (await page.locator(`img[src*="${screen}"]`).count() !== 1) failures.push(`${viewport.name} ${route}: supplied command-center screen ${screen} is missing or duplicated`);
      if (await page.getByText("SuperDebate command center", { exact: true }).count() !== 1) failures.push(`${viewport.name} ${route}: command-center labeling is missing`);
    }

    if (route !== "/work") {
      const repeatedMedia = await page.locator("main [data-case-gallery] [data-case-media]").evaluateAll((nodes) => {
        const keys = nodes.map((node) => node.getAttribute("data-case-media")).filter(Boolean);
        return [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))];
      });
      if (repeatedMedia.length) failures.push(`${viewport.name} ${route}: repeated case media ${repeatedMedia.join(", ")}`);

      const ratioMismatches = await page.locator('main [data-case-gallery] [data-media-kind="image"][data-media-fit="contain"][data-media-compact="false"]').evaluateAll((nodes) => nodes.flatMap((node) => {
        const frame = node.getBoundingClientRect();
        const ratioNode = node.querySelector("[data-media-width][data-media-height]");
        if (!ratioNode || frame.width < 1 || frame.height < 1) return [];
        const sourceRatio = Number(ratioNode.getAttribute("data-media-width")) / Number(ratioNode.getAttribute("data-media-height"));
        const frameRatio = frame.width / frame.height;
        return Math.abs(sourceRatio - frameRatio) / sourceRatio > 0.035 ? [{ sourceRatio, frameRatio }] : [];
      }));
      if (ratioMismatches.length) failures.push(`${viewport.name} ${route}: ${ratioMismatches.length} contained images have letterboxing-prone aspect ratios`);

      const eligibleMedia = page.locator('main [data-case-gallery] [data-case-media]:not([data-case-media="video"])');
      const openButtons = page.locator('main [data-case-gallery] button[aria-label^="Open "]');
      if (await openButtons.count() !== await eligibleMedia.count()) failures.push(`${viewport.name} ${route}: not every case image or diagram is lightbox-enabled`);

      const firstTrigger = openButtons.first();
      if (await firstTrigger.count()) {
        await firstTrigger.scrollIntoViewIfNeeded();
        await firstTrigger.focus();
        await firstTrigger.press("Enter");
        const lightbox = page.locator("[data-media-lightbox]");
        if (await lightbox.count() !== 1) failures.push(`${viewport.name} ${route}: lightbox did not open`);
        if (await page.evaluate(() => document.body.style.overflow) !== "hidden") failures.push(`${viewport.name} ${route}: lightbox did not lock background scroll`);
        if (viewport.name === "desktop" && route === "/work/superdebate") await page.screenshot({ path: `${output}/desktop-superdebate-lightbox.png` });
        if (viewport.name === "mobile-small" && route === "/work/work-shelter") await page.screenshot({ path: `${output}/mobile-work-shelter-lightbox.png` });
        await page.keyboard.press("Escape");
        await lightbox.waitFor({ state: "detached" });
        const focusReturned = await firstTrigger.evaluate((node) => document.activeElement === node);
        if (!focusReturned) failures.push(`${viewport.name} ${route}: lightbox did not return focus to its trigger`);
      }

      const galleries = page.locator("main [data-case-gallery]");
      for (let galleryIndex = 0; galleryIndex < await galleries.count(); galleryIndex += 1) {
        const triggers = galleries.nth(galleryIndex).locator('button[aria-label^="Open "]');
        if (await triggers.count() < 2) continue;
        await triggers.first().scrollIntoViewIfNeeded();
        await triggers.first().click();
        const activeMedia = page.locator("[data-media-lightbox-active]");
        try {
          await activeMedia.waitFor({ state: "visible", timeout: 5_000 });
        } catch {
          failures.push(`${viewport.name} ${route}: section lightbox did not reopen for navigation`);
          break;
        }
        const activeBefore = await activeMedia.getAttribute("data-media-lightbox-active");
        await page.getByRole("button", { name: "Next image" }).click();
        const activeAfter = await page.locator("[data-media-lightbox-active]").getAttribute("data-media-lightbox-active");
        if (!activeBefore || activeBefore === activeAfter) failures.push(`${viewport.name} ${route}: section lightbox navigation did not advance`);
        await page.getByRole("button", { name: "Close image viewer" }).click();
        break;
      }
    }

    if (viewport.name !== "tablet") {
      await page.evaluate(async () => {
        const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
        for (let y = 0; y < document.body.scrollHeight; y += 260) {
          window.scrollTo(0, y);
          await sleep(110);
        }
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(800);
      });
      const missingAfterScroll = await page.evaluate(() => [...document.images].filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src));
      if (missingAfterScroll.length) failures.push(`${viewport.name} ${route}: broken images after scroll ${missingAfterScroll.join(", ")}`);
      const hiddenAfterScroll = await page.evaluate(() => [...document.querySelectorAll("[data-work-reveal], [data-work-media-reveal], [data-diagram-node]")].filter((node) => Number.parseFloat(getComputedStyle(node).opacity) < 0.99).length);
      if (hiddenAfterScroll) failures.push(`${viewport.name} ${route}: ${hiddenAfterScroll} motion elements remained hidden after traversal`);
      if (viewport.reducedMotion === "no-preference") {
        const unanimatedWork = await page.evaluate(() => [...document.querySelectorAll("[data-work-reveal], [data-work-media-reveal]")].filter((node) => {
          if (!node.classList.contains("in") || node.getAttribute("data-reveal-state") !== "visible") return true;
          const role = node.getAttribute("data-motion-role");
          const animationTarget = role === "group" ? node.firstElementChild : role === "card" ? node.querySelector("[data-work-stagger]") : node;
          return !animationTarget || !getComputedStyle(animationTarget).animationName.startsWith("work-");
        }).length);
        if (unanimatedWork) failures.push(`${viewport.name} ${route}: ${unanimatedWork} Work elements completed without a Work entrance animation`);
      }
      const name = route === "/work" ? "index" : route.split("/").at(-1);
      await page.screenshot({ path: `${output}/${viewport.name}-${name}.png`, fullPage: true });
    }

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const materialViolations = axe.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    if (materialViolations.length) failures.push(`${viewport.name} ${route}: axe ${materialViolations.map((violation) => `${violation.id} (${violation.nodes.length})`).join(", ")}`);
  }

  await page.goto(`${baseUrl}/work`, { waitUntil: "domcontentloaded" });
  const cardOrder = await page.locator("[data-work-card]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-work-card")));
  const expectedOrder = ["work-shelter", "superdebate", "healthcare-real-estate", "sparkblox", "thrive-protocol", "green-goods"];
  if (JSON.stringify(cardOrder) !== JSON.stringify(expectedOrder)) failures.push(`${viewport.name}: incorrect public card order ${cardOrder.join(", ")}`);
  const flagshipOrder = await page.locator('[data-work-tier="flagship"] [data-work-card]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-work-card")));
  if (JSON.stringify(flagshipOrder) !== JSON.stringify(["work-shelter", "superdebate"])) failures.push(`${viewport.name}: WORK+SHELTER and SuperDebate are not the dedicated flagships`);
  const imageCards = await page.locator('[data-work-card] [data-media-kind="image"]').count();
  const parallaxCovers = await page.locator('[data-work-card] [data-media-parallax]').count();
  if (parallaxCovers !== imageCards) failures.push(`${viewport.name}: expected ${imageCards} parallax image covers, found ${parallaxCovers}`);
  if (viewport.reducedMotion === "reduce") {
    const movingLayers = await page.locator('[data-work-card] [data-media-parallax-layer]').evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).transform !== "none").length);
    if (movingLayers) failures.push(`${viewport.name}: ${movingLayers} media parallax layers remained active under reduced motion`);
  }
  if (viewport.name === "desktop") {
    const widths = await page.locator('[data-work-tier="flagship"] [data-work-card]').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width)));
    if (widths.length !== 2 || Math.abs(widths[0] - widths[1]) < 80) failures.push(`desktop: flagship grid is not visibly asymmetric (${widths.join(", ")})`);
  }
  if (await page.locator('[data-work-card="work-shelter"] img[src*="customer-site-hero"]').count() !== 1) failures.push(`${viewport.name}: WORK+SHELTER card is not using the customer-experience cover`);
  if (await page.locator('[data-work-card="superdebate"] img[src*="online-product"]').count() !== 1) failures.push(`${viewport.name}: SuperDebate card is not using the supplied product screen`);
  if (await page.locator('[data-work-card="thrive-protocol"] img[src*="xion"]').count()) failures.push(`${viewport.name}: Thrive card still uses XION imagery`);
  if (await page.getByText("Northern Trust", { exact: true }).count()) failures.push(`${viewport.name}: archived Northern Trust case appeared on /work`);
  const imagePreloads = await page.locator('link[rel="preload"][as="image"]').count();
  if (imagePreloads > 1) failures.push(`${viewport.name}: /work preloaded ${imagePreloads} images; expected at most one`);
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
  if (focusedTag === "BODY" || !focusedTag) failures.push(`${viewport.name}: keyboard navigation did not reach an interactive element`);
  if (consoleErrors.length) failures.push(`${viewport.name}: console/page errors: ${consoleErrors.join(" | ")}`);
  await context.close();
}

const distinctContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const distinctPage = await distinctContext.newPage();
const worlds = new Set();
const accents = new Set();
for (const route of routes.slice(1)) {
  await distinctPage.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  const facts = await distinctPage.locator("[data-case-world]").evaluate((node) => ({ world: node.getAttribute("data-case-world"), accent: node.getAttribute("data-case-accent") }));
  worlds.add(facts.world);
  accents.add(facts.accent);
}
if (worlds.size !== routes.length - 1) failures.push(`public case art direction is not distinct: ${[...worlds].join(", ")}`);
if (accents.size < 5) failures.push(`public case accent system is too repetitive: ${[...accents].join(", ")}`);
await distinctContext.close();

const videoContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const videoPage = await videoContext.newPage();
const thirdPartyVideoRequests = [];
videoPage.on("request", (request) => {
  if (/youtube|googlevideo/i.test(request.url())) thirdPartyVideoRequests.push(request.url());
});
await videoPage.goto(`${baseUrl}/work/northern-trust`, { waitUntil: "networkidle" });
const archiveRobots = await videoPage.locator('meta[name="robots"]').getAttribute("content");
if (!archiveRobots?.includes("noindex") || !archiveRobots.includes("follow")) failures.push("Northern Trust archive metadata must be noindex, follow");
if (await videoPage.locator('[data-work-visibility="archived"]').count() !== 1) failures.push("Northern Trust must render with archive visibility");
if (await videoPage.getByText("Portfolio archive", { exact: true }).count() !== 1) failures.push("Northern Trust archive note is missing");
if (thirdPartyVideoRequests.length) failures.push("Northern Trust requested YouTube before interaction");
const playButton = videoPage.getByRole("button", { name: /Play Northern Trust homepage scroll motion experiment/i });
await playButton.focus();
await playButton.press("Enter");
await videoPage.waitForSelector('iframe[src*="youtube-nocookie.com"]');
if (await videoPage.locator('iframe[src*="youtube-nocookie.com"]').count() !== 1) failures.push("Northern Trust did not load exactly one selected motion study");
await videoContext.close();

const redirectContext = await browser.newContext();
const redirectPage = await redirectContext.newPage();
const sitemapResponse = await redirectPage.goto(`${baseUrl}/sitemap.xml`, { waitUntil: "networkidle" });
const sitemapText = await sitemapResponse?.text();
if (sitemapText?.includes("/work/northern-trust")) failures.push("Northern Trust archive appeared in the public sitemap");
await redirectPage.goto(`${baseUrl}/results/sparkblox`, { waitUntil: "networkidle" });
if (redirectPage.url() !== `${baseUrl}/work/sparkblox`) failures.push("legacy Sparkblox redirect is not truthful");
await redirectContext.close();
await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({ publicRoutes: routes.length, archivedRoutes: 1, viewports: viewports.length, motionModes: ["normal", "reduced"], themes: ["light", "dark"], accessibility: "axe wcag2a/wcag2aa", screenshots: output, result: "passed" }, null, 2));
