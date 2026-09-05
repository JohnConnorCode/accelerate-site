import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

// Use the same host the local Next request resolves against so first-party
// analytics' same-origin guard is exercised instead of producing false 403s.
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-public-motion";
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];
const routes = [
  "/",
  "/services",
  "/industries",
  "/learn",
  "/work",
  "/work/work-shelter",
  "/command-center",
  "/contact",
];
const smokeRoutes = [
  "/",
  "/about",
  "/blog",
  "/changelog",
  "/roadmap",
  "/command-center",
  "/command-center/demo",
  "/contact",
  "/industries",
  "/industries/auto-dealers",
  "/industries/home-services",
  "/industries/insurance-agencies",
  "/industries/law-firms",
  "/industries/manufacturing",
  "/industries/medical-dental",
  "/industries/nonprofits",
  "/industries/professional-services",
  "/industries/real-estate",
  "/industries/startups",
  "/learn",
  "/packages",
  "/partners",
  "/plan-builder",
  "/privacy",
  "/resources",
  "/results",
  "/roofing",
  "/services",
  "/style-guide",
  "/terms",
  "/work",
  "/work/work-shelter",
  "/work/healthcare-real-estate",
  "/work/superdebate",
  "/work/sparkblox",
  "/work/thrive-protocol",
  "/work/green-goods",
  "/work/northern-trust",
  "/results/sparkblox",
  "/results/farrell-roofing",
  "/results/montoya-capital",
];

async function inspectInitial(page, route, label) {
  let response = null;
  try {
    response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  } catch (error) {
    // Next can intentionally abort the source request when a legacy route
    // redirects during the client bootstrap. The committed destination is the
    // visual state under test, so only surface an abort that did not settle.
    if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) throw error;
    await page.waitForLoadState("domcontentloaded");
  }
  if (response && response.status() >= 400)
    failures.push(`${label} ${route}: HTTP ${response.status()}`);
  const readInitial = () =>
    page.evaluate(() => {
      const main = document.querySelector("main");
      const entry = document.querySelector("[data-route-entry]");
      return {
        mainOpacity: main ? Number.parseFloat(getComputedStyle(main).opacity) : 0,
        entryOpacity: entry ? Number.parseFloat(getComputedStyle(entry).opacity) : 1,
        visibleText: main?.innerText.trim().length ?? 0,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
  // Next can replace the document immediately after DOMContentLoaded when a
  // cached route bootstrap arrives. This is a test-harness race, not a visual
  // state, so retry the read against the committed document once.
  let initial;
  try {
    initial = await readInitial();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Execution context was destroyed"))
      throw error;
    await page.waitForLoadState("domcontentloaded");
    initial = await readInitial();
  }
  if (initial.mainOpacity < 0.9 || initial.entryOpacity < 0.9)
    failures.push(
      `${label} ${route}: prerendered route began hidden (${initial.mainOpacity}/${initial.entryOpacity})`,
    );
  if (initial.visibleText < 20)
    failures.push(`${label} ${route}: main content was not present at DOMContentLoaded`);
  if (initial.overflow) failures.push(`${label} ${route}: horizontal overflow`);
}

async function inspectRoute(page, route, label, scrollDelay) {
  await inspectInitial(page, route, label);

  await page.evaluate(async (delayMs) => {
    const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    let previousHeight = 0;
    for (let pass = 0; pass < 4; pass += 1) {
      const targetHeight = document.body.scrollHeight;
      for (
        let y = pass === 0 ? 0 : window.scrollY;
        y < targetHeight;
        y += Math.max(220, Math.floor(window.innerHeight * 0.55))
      ) {
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
  const pendingSelector =
    ".motion-ready .rv:not(.in), .motion-ready .item-rv:not(.in), .motion-ready .section-reveal:not(.in) > [class*='page-shell'] > *";
  await page
    .waitForFunction(
      (selector) =>
        ![...document.querySelectorAll(selector)].some((node) => {
          const rect = node.getBoundingClientRect();
          return (
            rect.top < innerHeight + 40 &&
            rect.bottom > -40 &&
            Number.parseFloat(getComputedStyle(node).opacity) < 0.9
          );
        }),
      pendingSelector,
      { timeout: 2_000 },
    )
    .catch(() => null);
  const stranded = await page.locator(pendingSelector).evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.top < innerHeight + 40 &&
          rect.bottom > -40 &&
          Number.parseFloat(getComputedStyle(node).opacity) < 0.9
        );
      }).length,
  );
  if (stranded)
    failures.push(
      `${label} ${route}: ${stranded} reveal elements remained stranded after traversal`,
    );
}

async function captureRevealEntry(page, selector) {
  await page.waitForFunction(
    (target) => document.querySelector(`${target}:not(.in)[data-reveal-state="pending"]`),
    selector,
  );
  const handle = await page
    .locator(`${selector}:not(.in)[data-reveal-state="pending"]`)
    .first()
    .elementHandle();
  if (!handle) return null;
  const maxSteps = await page.evaluate(
    () => Math.ceil(document.documentElement.scrollHeight / 12) + 100,
  );
  for (
    let step = 0;
    step < maxSteps && !(await handle.evaluate((node) => node.classList.contains("in")));
    step += 1
  ) {
    await page.evaluate(() => window.scrollBy(0, 12));
    await page.waitForTimeout(16);
  }
  if (!(await handle.evaluate((node) => node.classList.contains("in")))) return null;
  return handle.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      top: rect.top,
      ratio: rect.top / innerHeight,
      height: innerHeight,
      role: node.getAttribute("data-motion-role"),
    };
  });
}

async function captureFramerRevealEntry(page, selector) {
  const candidates = page.locator(selector);
  const index = await candidates.evaluateAll((nodes) =>
    nodes.findIndex((node) => node.getBoundingClientRect().top > innerHeight + 40),
  );
  const element = index >= 0 ? await candidates.nth(index).elementHandle() : null;
  if (!element) return null;
  const maxSteps = await page.evaluate(
    () => Math.ceil(document.documentElement.scrollHeight / 12) + 100,
  );
  for (let step = 0; step < maxSteps; step += 1) {
    const visible = await element.evaluate(
      (node) => Number.parseFloat(getComputedStyle(node).opacity) >= 0.9,
    );
    if (visible) break;
    await page.evaluate(() => window.scrollBy(0, 12));
    await page.waitForTimeout(16);
  }
  const visible = await element.evaluate(
    (node) => Number.parseFloat(getComputedStyle(node).opacity) >= 0.9,
  );
  if (!visible) return null;
  return element.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, ratio: rect.top / innerHeight, height: innerHeight };
  });
}

async function togglePublicTheme(page, target) {
  // The document theme is set by a prepaint script, before React has attached
  // the mobile-menu handler or mounted ThemeToggle. Wait for the shared
  // hydration signal so this test performs a real user interaction.
  await page.waitForFunction(() => document.documentElement.dataset.motionHydrated === "true");
  const accessibleName = `Switch to ${target} mode`;
  let toggle = page.locator(`button[aria-label="${accessibleName}"]:visible`).first();
  if (!(await toggle.count())) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    toggle = page.locator(`button[aria-label="${accessibleName}"]:visible`).first();
    await toggle.waitFor();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Close navigation menu" }).click();
  } else {
    // Exercise the accessible button contract without allowing Next's
    // development-only indicator portal to intercept pointer coordinates.
    await toggle.focus();
    await page.keyboard.press("Enter");
  }
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, target);
}

for (const config of [
  { label: "mobile", viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" },
  { label: "reduced", viewport: { width: 430, height: 932 }, reducedMotion: "reduce" },
  { label: "desktop", viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" },
]) {
  const context = await browser.newContext({
    viewport: config.viewport,
    reducedMotion: config.reducedMotion,
  });
  let page = await context.newPage();
  const errors = [];
  const observeRuntime = (target) => {
    target.on("pageerror", (error) => errors.push(error.message));
    target.on("response", (response) => {
      if (response.status() < 400) return;
      const url = new URL(response.url());
      if (["/api/event", "/js/script.js"].includes(url.pathname)) return;
      errors.push(`${response.status()} ${url.pathname}`);
    });
  };
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    if (["/api/event", "/js/script.js"].includes(url.pathname)) return;
    errors.push(`${response.status()} ${url.pathname}`);
  });
  for (const route of smokeRoutes) await inspectInitial(page, route, config.label);
  // The prerender smoke pass deliberately replaces documents at
  // DOMContentLoaded before React must hydrate them. Start functional QA from
  // a clean document so an intentionally aborted hydration is not mistaken
  // for a route defect.
  await page.close();
  page = await context.newPage();
  observeRuntime(page);
  for (const route of routes)
    await inspectRoute(page, route, config.label, config.label === "desktop" ? 120 : 24);

  await page.goto(`${baseUrl}/work`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
  const lightCanvas = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    bg: getComputedStyle(document.body).backgroundColor,
  }));
  await togglePublicTheme(page, "dark");
  const darkCanvas = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    bg: getComputedStyle(document.body).backgroundColor,
    stored: localStorage.getItem("theme"),
  }));
  if (
    lightCanvas.theme !== "light" ||
    darkCanvas.theme !== "dark" ||
    darkCanvas.stored !== "dark" ||
    lightCanvas.bg === darkCanvas.bg
  )
    failures.push(
      `${config.label}: shared public theme toggle did not persist a real Work-page inversion`,
    );
  const workRadii = await page
    .locator("[data-work-card] [data-media-surface]")
    .evaluateAll((nodes) =>
      nodes.map((node) => Number.parseFloat(getComputedStyle(node).borderTopLeftRadius)),
    );
  if (!workRadii.length || workRadii.some((radius) => radius < 12))
    failures.push(`${config.label}: Work media does not use the shared rounded treatment`);
  await page.goto(`${baseUrl}/services`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await page.goto(`${baseUrl}/work`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await togglePublicTheme(page, "light");
  if (config.reducedMotion === "no-preference") {
    const headingAnimation = await page
      .locator(".word-mask-word > span")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName);
    if (!headingAnimation.includes("word-mask-entry"))
      failures.push(`${config.label}: heading entrance animation is not active`);
    const indexHeroSequence = await page.locator(".work-hero-enter").evaluateAll((nodes) =>
      nodes.map((node) => ({
        name: getComputedStyle(node).animationName,
        delay: getComputedStyle(node).animationDelay,
      })),
    );
    if (
      indexHeroSequence.length < 4 ||
      new Set(indexHeroSequence.map((item) => item.delay)).size !== indexHeroSequence.length ||
      indexHeroSequence.some((item) => !item.name.includes("work-hero-in"))
    )
      failures.push(`${config.label}: Work hero items are not individually staggered`);
    const cardEntry = await captureRevealEntry(page, '[data-motion-role="card"]');
    if (!cardEntry || cardEntry.ratio > 0.8)
      failures.push(
        `${config.label}: Work card entered too early at ${cardEntry ? Math.round(cardEntry.ratio * 100) : "unknown"}% of viewport height`,
      );
    const cardStagger = await page
      .locator('[data-motion-role="card"].in [data-work-stagger]')
      .first()
      .locator("xpath=..")
      .locator("[data-work-stagger]")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          name: getComputedStyle(node).animationName,
          delay: getComputedStyle(node).animationDelay,
        })),
      );
    if (
      cardStagger.length < 5 ||
      new Set(cardStagger.map((item) => item.delay)).size < 5 ||
      cardStagger.some((item) => !item.name.includes("work-reveal-in"))
    )
      failures.push(`${config.label}: Work card does not use five visible stagger steps`);
    await page.waitForTimeout(180);
    await page.screenshot({
      path: `${output}/${config.label}-work-card-entry.png`,
      fullPage: false,
    });
    const pendingLocator = page
      .locator("html.motion-ready .work-reveal:not(.in)[data-reveal-state='pending']")
      .first();
    const pending = (await pendingLocator.count()) ? await pendingLocator.elementHandle() : null;
    if (pending) {
      for (
        let attempt = 0;
        attempt < 20 &&
        (await pending.evaluate((node) => node.getAttribute("data-reveal-state"))) !== "visible";
        attempt += 1
      ) {
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(140);
      }
      await page.waitForTimeout(100);
      const revealFacts = await pending.evaluate((node) => {
        const role = node.getAttribute("data-motion-role");
        const animatedNode =
          role === "group"
            ? node.firstElementChild
            : role === "card"
              ? node.querySelector("[data-work-stagger]")
              : node;
        return {
          state: node.getAttribute("data-reveal-state"),
          animation: animatedNode ? getComputedStyle(animatedNode).animationName : "none",
        };
      });
      if (revealFacts.state !== "visible" || !revealFacts.animation.startsWith("work-"))
        failures.push(`${config.label}: below-fold Work content did not animate at viewport entry`);
    } else failures.push(`${config.label}: no below-fold reveal remained armed for viewport entry`);
  }

  await page.goto(`${baseUrl}/industries/law-firms`, { waitUntil: "domcontentloaded" });
  if (config.reducedMotion === "no-preference") {
    const industryHeading = await captureRevealEntry(page, ".word-mask-heading");
    if (!industryHeading || industryHeading.ratio > 0.8)
      failures.push(
        `${config.label}: below-fold industry heading did not reveal at viewport entry`,
      );
    await page.goto(`${baseUrl}/industries/law-firms`, { waitUntil: "domcontentloaded" });
    const industryReveal = await captureFramerRevealEntry(
      page,
      ".reveal-self:not(.word-mask-heading)",
    );
    if (!industryReveal || industryReveal.ratio > 0.8)
      failures.push(`${config.label}: industry content did not use the shared viewport reveal`);
  }
  await page.goto(`${baseUrl}/work`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.motionHydrated === "true");
  const firstCard = page.locator('[data-work-card="work-shelter"] a').first();
  await firstCard.click({ noWaitAfter: true });
  await page.waitForURL("**/work/work-shelter");
  const linkedRoute = page.locator("[data-route-entry]");
  const linkedRouteFrames = [];
  for (const wait of [0, 80, 300]) {
    if (wait) await page.waitForTimeout(wait);
    linkedRouteFrames.push(
      await linkedRoute.evaluate((node) => ({
        opacity: Number.parseFloat(getComputedStyle(node).opacity),
        animation: getComputedStyle(node).animationName,
        filter: getComputedStyle(node).filter,
      })),
    );
  }
  if (linkedRouteFrames.at(-1).opacity < 0.99)
    failures.push(`${config.label}: client-side Work navigation did not settle visibly`);
  if (config.reducedMotion === "no-preference") {
    const signatures = new Set(
      linkedRouteFrames.map((frame) => `${frame.opacity.toFixed(3)}:${frame.filter}`),
    );
    if (
      !linkedRouteFrames.some((frame) => frame.animation.includes("route-entry-in")) ||
      signatures.size < 2
    )
      failures.push(
        `${config.label}: client-side route entrance did not interpolate through visible frames`,
      );
  }
  if (config.reducedMotion === "no-preference") {
    const heroSequence = await page
      .locator(".work-hero-enter, .work-hero-meta > *")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          name: getComputedStyle(node).animationName,
          delay: Number.parseFloat(getComputedStyle(node).animationDelay),
        })),
      );
    const orderedDelays = [...heroSequence].map((item) => item.delay).sort((a, b) => a - b);
    if (
      heroSequence.length < 8 ||
      heroSequence.some((item) => !item.name.includes("work-hero-in")) ||
      new Set(orderedDelays).size < 5
    )
      failures.push(`${config.label}: case hero is not split into a coherent stagger sequence`);
    const mediaEntry = await captureRevealEntry(page, '[data-motion-role="media"]');
    if (!mediaEntry || mediaEntry.ratio > 0.8)
      failures.push(
        `${config.label}: case media entered too early at ${mediaEntry ? Math.round(mediaEntry.ratio * 100) : "unknown"}% of viewport height`,
      );
    await page.waitForTimeout(180);
    await page.screenshot({
      path: `${output}/${config.label}-case-media-entry.png`,
      fullPage: false,
    });
  }
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.goForward({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(config.reducedMotion === "no-preference" ? 420 : 20);
  if (
    (await page
      .locator("[data-route-entry]")
      .evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity))) < 0.99
  )
    failures.push(`${config.label}: back-forward navigation did not settle visibly`);

  if (config.reducedMotion === "no-preference") {
    // Retire the animation-heavy Work document after its back/forward receipt
    // exercise. A fresh page prevents old scroll-linked observers from
    // competing with the homepage's first reveal measurement in long QA runs.
    await page.close();
    page = await context.newPage();
    observeRuntime(page);
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(50);
    const homeEntry = await captureRevealEntry(page, ".rv");
    if (!homeEntry || homeEntry.ratio > 0.8)
      failures.push(
        `${config.label}: homepage content entered too early at ${homeEntry ? Math.round(homeEntry.ratio * 100) : "unknown"}% of viewport height`,
      );
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${output}/${config.label}-home-entry.png`, fullPage: false });
    const parallaxLayer = page.locator("[data-work-card] [data-media-parallax-layer]").first();
    if (!(await parallaxLayer.count()))
      failures.push(`${config.label}: homepage Selected Work has no scroll-linked media depth`);
    else {
      await parallaxLayer.scrollIntoViewIfNeeded();
      await page.waitForTimeout(180);
      const before = await parallaxLayer.evaluate((node) => getComputedStyle(node).transform);
      await page.mouse.wheel(0, Math.round(config.viewport.height * 0.45));
      await page.waitForTimeout(320);
      const after = await parallaxLayer.evaluate((node) => getComputedStyle(node).transform);
      if (before === after)
        failures.push(`${config.label}: homepage media parallax did not respond to scroll`);
    }
  }

  if (config.label === "mobile") {
    for (let reload = 1; reload <= 3; reload += 1) {
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
      await page.locator(".hero.loaded").waitFor({ timeout: 4_000 });
      const opening = await page.evaluate(() => ({
        staticPhrase: getComputedStyle(document.querySelector(".hero-intelligent-static")).display,
        scramblePhrase: getComputedStyle(document.querySelector(".hero-intelligent-scramble"))
          .display,
        wordAnimations: [...document.querySelectorAll(".hero .word > span")].map(
          (node) => getComputedStyle(node).animationName,
        ),
      }));
      if (
        opening.staticPhrase !== "none" ||
        opening.scramblePhrase === "none" ||
        opening.wordAnimations.length !== 9 ||
        opening.wordAnimations.some((name) => !name.includes("word-blur-in"))
      )
        failures.push(`mobile reload ${reload}: hero did not begin its shared scramble cascade`);
      await page.waitForTimeout(7_400);
      const settledHero = await page.evaluate(() => {
        const words = document.querySelector(".hero .h1-word-row").getBoundingClientRect();
        const closing = document.querySelector(".hero-row-cta").getBoundingClientRect();
        const profit = document.querySelector(".hero-profit").getBoundingClientRect();
        const cta = document.querySelector(".hero-inline-cta").getBoundingClientRect();
        return {
          statementGap: closing.top - words.bottom,
          profitOffset: profit.top - closing.top,
          actionGap: cta.top - profit.bottom,
          profitOpacity: Number.parseFloat(
            getComputedStyle(document.querySelector(".hero-profit")).opacity,
          ),
          ctaOpacity: Number.parseFloat(
            getComputedStyle(document.querySelector(".hero-inline-cta")).opacity,
          ),
        };
      });
      if (
        settledHero.statementGap < 24 ||
        settledHero.statementGap > 42 ||
        Math.abs(settledHero.profitOffset) > 2
      )
        failures.push(
          `mobile reload ${reload}: Profit has an unbalanced headline gap (${settledHero.statementGap.toFixed(1)}px gap, ${settledHero.profitOffset.toFixed(1)}px offset)`,
        );
      if (settledHero.actionGap < 16 || settledHero.actionGap > 34)
        failures.push(
          `mobile reload ${reload}: CTA has an unbalanced Profit gap (${settledHero.actionGap.toFixed(1)}px)`,
        );
      if (settledHero.profitOpacity < 0.99 || settledHero.ctaOpacity < 0.99)
        failures.push(`mobile reload ${reload}: hero sequence did not settle visibly`);
    }
    // Router cache restores must create a new hero lifecycle rather than
    // inheriting a completed document-level animation.
    await page.goto(`${baseUrl}/services`, { waitUntil: "domcontentloaded" });
    await page.goBack();
    await page.waitForURL(baseUrl + "/");
    await page.locator(".hero.loaded").waitFor({ timeout: 4_000 });
    const restoredHero = await page.evaluate(() => ({
      loaded: document.querySelector(".hero")?.classList.contains("loaded"),
      profitTransitionDelay: getComputedStyle(document.querySelector(".hero-profit"))
        .transitionDelay,
      ctaTransitionDelay: getComputedStyle(document.querySelector(".hero-inline-cta"))
        .transitionDelay,
      profitOpacity: Number.parseFloat(
        getComputedStyle(document.querySelector(".hero-profit")).opacity,
      ),
      ctaOpacity: Number.parseFloat(
        getComputedStyle(document.querySelector(".hero-inline-cta")).opacity,
      ),
    }));
    if (
      !restoredHero.loaded ||
      !restoredHero.profitTransitionDelay.includes("4.7s") ||
      !restoredHero.ctaTransitionDelay.includes("6.1s") ||
      restoredHero.profitOpacity > 0.1 ||
      restoredHero.ctaOpacity > 0.1
    )
      failures.push(
        "mobile back navigation: hero did not restart the shared desktop-timed outcome and CTA sequence",
      );
    await page.waitForTimeout(7_400);
    const restoredVisibility = await page.evaluate(() => ({
      profit: Number.parseFloat(getComputedStyle(document.querySelector(".hero-profit")).opacity),
      cta: Number.parseFloat(getComputedStyle(document.querySelector(".hero-inline-cta")).opacity),
    }));
    if (restoredVisibility.profit < 0.99 || restoredVisibility.cta < 0.99)
      failures.push("mobile back navigation: hero did not settle visibly after replay");
    await page.screenshot({ path: `${output}/mobile-home-hero-settled.png`, fullPage: false });

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
        closeVisible: Boolean(
          rect &&
          rect.top >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight &&
          rect.width >= 44 &&
          rect.height >= 44,
        ),
        bodyLocked: document.body.style.overflow === "hidden",
        closeFocused: document.activeElement === closeButton,
      };
    });
    if (chatFacts.chatZ <= chatFacts.headerZ)
      failures.push("mobile chat does not stack above the site header");
    if (!chatFacts.closeVisible)
      failures.push("mobile chat close control is not fully visible and touch sized");
    if (!chatFacts.bodyLocked) failures.push("mobile chat did not lock background scrolling");
    if (!chatFacts.closeFocused) failures.push("mobile chat did not focus its close control");
    if (!(await page.getByRole("dialog", { name: "Accelerate AI" }).count()))
      failures.push("mobile chat is missing named modal dialog semantics");
    if (!(await page.locator("main[inert][aria-hidden='true']").count()))
      failures.push("mobile chat did not isolate background content");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    if (!(await close.evaluate((node) => document.activeElement === node)))
      failures.push("mobile chat focus escaped its keyboard loop");
    const chatA11y = await new AxeBuilder({ page })
      .include(".chat-panel")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const seriousChatViolations = chatA11y.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    if (seriousChatViolations.length)
      failures.push(
        `mobile chat accessibility: ${seriousChatViolations.map((violation) => violation.id).join(", ")}`,
      );
    await page.screenshot({ path: `${output}/mobile-chat-open.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    if (await page.evaluate(() => document.body.style.overflow === "hidden"))
      failures.push("mobile chat did not restore body scrolling after close");
    if (
      !(await page
        .getByRole("button", { name: "Open chat" })
        .evaluate((node) => document.activeElement === node))
    ) {
      failures.push("mobile chat did not return focus to its trigger after close");
    }
    await page.goto(`${baseUrl}/work`, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: `${output}/mobile-work.png`, fullPage: false });
  }
  if (config.label === "desktop")
    await page.screenshot({ path: `${output}/desktop-work-shelter.png`, fullPage: false });
  if (config.label === "reduced") {
    const animated = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-motion-role], [data-route-entry]")].filter(
          (node) =>
            getComputedStyle(node).animationName !== "none" &&
            Number.parseFloat(getComputedStyle(node).animationDuration) > 0,
        ).length,
    );
    if (animated)
      failures.push(`reduced: ${animated} nonessential motion elements remained animated`);
  }
  if (errors.length) failures.push(`${config.label}: runtime errors: ${errors.join(" | ")}`);
  await context.close();
}

const firstFrame = await browser.newContext({ viewport: { width: 390, height: 844 } });
const firstFramePage = await firstFrame.newPage();
await firstFramePage.route("**/_next/static/chunks/*.js", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  await route.continue();
});
const firstFrameNavigation = firstFramePage.goto(`${baseUrl}/`, { waitUntil: "load" });
await firstFramePage.waitForSelector(".hero .eyebrow-anim");
const eyebrowInitial = await firstFramePage.locator(".hero .eyebrow-anim").evaluate((node) => ({
  motionReady: document.documentElement.classList.contains("motion-ready"),
  in: node.classList.contains("in"),
  opacity: Number.parseFloat(getComputedStyle(node).opacity),
}));
// The CSS-only hero sequence starts before hydration by design. Depending on
// the exact paint sampled after the server document arrives, the eyebrow may
// have begun its first few percent; it must still be visually concealed and
// must never wait fully visible for client JavaScript.
if (!eyebrowInitial.motionReady || eyebrowInitial.in || eyebrowInitial.opacity > 0.12) {
  failures.push(
    `home eyebrow did not begin in a stable pre-paint state (${JSON.stringify(eyebrowInitial)})`,
  );
}
await firstFrameNavigation;
await firstFramePage.waitForSelector(".hero .eyebrow-anim.in");
const eyebrowAnimated = await firstFramePage
  .locator(".hero .eyebrow-anim")
  .evaluate((node) => getComputedStyle(node).animationName);
if (!eyebrowAnimated.includes("rv-in"))
  failures.push(`home eyebrow did not use the shared blur entrance (${eyebrowAnimated})`);
await firstFramePage.waitForTimeout(160);
await firstFramePage.screenshot({
  path: `${output}/mobile-home-eyebrow-entry.png`,
  fullPage: false,
});
await firstFrame.close();

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
  motionReady: document.documentElement.classList.contains("motion-ready"),
  heroOpacity: Number.parseFloat(getComputedStyle(document.querySelector("main h1"))),
  pending: document.querySelectorAll(".work-reveal:not(.in)").length,
}));
if (
  delayedInitial.text < 100 ||
  !delayedInitial.motionReady ||
  delayedInitial.heroOpacity < 0.9 ||
  !delayedInitial.pending
) {
  failures.push(`delayed hydration was not stable (${JSON.stringify(delayedInitial)})`);
}
await delayedNavigation;
await delayed.close();

const noJs = await browser.newContext({
  javaScriptEnabled: false,
  viewport: { width: 390, height: 844 },
});
const noJsPage = await noJs.newPage();
await noJsPage.goto(`${baseUrl}/work/work-shelter`, { waitUntil: "domcontentloaded" });
const noJsFacts = await noJsPage.evaluate(() => ({
  text: document.querySelector("main")?.textContent?.trim().length ?? 0,
  hidden: [
    ...document.querySelectorAll(
      "[data-work-reveal], [data-work-media-reveal], [data-route-entry]",
    ),
  ].filter((node) => Number.parseFloat(getComputedStyle(node).opacity) < 0.9).length,
}));
if (noJsFacts.text < 100 || noJsFacts.hidden)
  failures.push(
    `no-JavaScript Work page was not fail-open (${noJsFacts.text} chars, ${noJsFacts.hidden} hidden nodes)`,
  );
await noJs.close();
await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      smokeRoutes: smokeRoutes.length,
      traversalRoutes: routes.length,
      viewports: 3,
      delayedHydration: true,
      noJavaScript: true,
      chatMobile: true,
      accessibility: "axe wcag2a/wcag2aa",
      animationContracts: ["heading", "below-fold", "route"],
      screenshots: output,
      result: "passed",
    },
    null,
    2,
  ),
);
