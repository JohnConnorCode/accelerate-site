import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const arg = (name, fallback) => {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};

const base = process.env.PLAYWRIGHT_BASE_URL || arg("base", "http://localhost:3010");
const output = arg("output", "/tmp/accelerate-public-navigation-profile");
const profile = arg("profile", "/tmp/accelerate-public-navigation-browser-profile");
const iterations = Number.parseInt(arg("iterations", "12"), 10);
const cpuRate = Number.parseInt(arg("cpu-rate", "4"), 10);
const observeOnly = process.argv.includes("--observe-only");

if (!Number.isFinite(iterations) || iterations < 4)
  throw new Error("--iterations must be at least 4");
if (!Number.isFinite(cpuRate) || cpuRate < 1) throw new Error("--cpu-rate must be at least 1");
await mkdir(output, { recursive: true });

const routes = [
  { href: "/services", label: "Services" },
  { href: "/command-center", label: "Command Center" },
  { href: "/work", label: "Work" },
  { href: "/learn", label: "Learn" },
];

const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] || 0;
};

async function runProfile(
  label,
  userDataDir,
  reducedMotion = "no-preference",
  runIterations = iterations,
) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 390, height: 844 },
    reducedMotion,
  });
  const page = context.pages()[0] || (await context.newPage());
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });

  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("net::ERR_FAILED"))
      errors.push(message.text());
  });

  await page.addInitScript(() => {
    window.__acceleratePublicNavigationQa = { longTasks: [] };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__acceleratePublicNavigationQa.longTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
        });
      }
    }).observe({ type: "longtask", buffered: true });
  });

  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.getByRole("button", { name: "Open navigation menu" }).waitFor();
  const trigger = page.getByRole("button", { name: "Open navigation menu" });
  await trigger.evaluate((node) => node.click());
  await page.waitForTimeout(32);
  await page
    .getByRole("button", { name: "Close navigation menu" })
    .evaluate((node) => node.click());
  await page.waitForTimeout(32);
  await trigger.evaluate((node) => node.click());
  await page.waitForTimeout(32);
  await page
    .getByRole("button", { name: "Close navigation menu" })
    .evaluate((node) => node.click());
  await page.waitForFunction(
    () => document.querySelector(".mobile-nav-overlay")?.getAttribute("data-open") === "false",
  );
  await page.waitForTimeout(reducedMotion === "reduce" ? 0 : 180);
  const rapidToggleSettled = await page
    .locator(".mobile-nav-overlay")
    .evaluate(
      (node) =>
        node.getAttribute("data-open") === "false" &&
        getComputedStyle(node).visibility === "hidden" &&
        getComputedStyle(node).opacity === "0",
    );
  const steps = [];

  for (let index = 0; index < runIterations; index += 1) {
    const expected = routes[index % routes.length];
    const openedAt = await trigger.evaluate((node) => {
      const at = performance.now();
      node.click();
      return at;
    });
    await page.getByRole("navigation", { name: "Mobile" }).waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const nav = document.querySelector('[aria-label="Mobile"]');
      if (!nav) return false;
      const overlay = nav.parentElement;
      return Number.parseFloat(getComputedStyle(overlay).opacity) >= 0.95;
    });
    const openSettledAt = await page.evaluate(() => performance.now());
    const beforeRoute = await page.evaluate(() => ({
      longTaskCount: window.__acceleratePublicNavigationQa.longTasks.length,
      activeAnimations: document
        .getAnimations()
        .filter((animation) => animation.playState === "running").length,
      animationOwners: document
        .getAnimations()
        .filter((animation) => animation.playState === "running")
        .slice(0, 80)
        .map((animation) => ({
          name: animation instanceof CSSAnimation ? animation.animationName : "web-animation",
          target:
            animation.effect?.target instanceof Element
              ? `${animation.effect.target.tagName.toLowerCase()}.${String(
                  animation.effect.target.className || "",
                )
                  .replace(/\s+/g, ".")
                  .slice(0, 120)}`
              : "unknown",
        })),
    }));

    const link = page
      .getByRole("navigation", { name: "Mobile" })
      .locator(`a[href="${expected.href}"]`)
      .first();
    const routeClickedAt = await link.evaluate((node) => {
      const at = performance.now();
      node.click();
      return at;
    });
    await page.waitForURL((url) => url.pathname === expected.href, {
      waitUntil: "commit",
      timeout: 15_000,
    });
    await page.waitForFunction(
      (href) =>
        document.querySelector("[data-route-entry]")?.getAttribute("data-route-entry") === href,
      expected.href,
    );
    const routeCommittedAt = await page.evaluate(() => performance.now());
    await page.waitForTimeout(420);
    const afterRoute = await page.evaluate(() => {
      const nav = document.querySelector('[aria-label="Mobile"]');
      const route = document.querySelector("[data-route-entry]");
      return {
        pathname: location.pathname,
        mobileNavVisible: Boolean(
          nav && getComputedStyle(nav.parentElement).visibility !== "hidden",
        ),
        activeAnimations: document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
        longTasks: window.__acceleratePublicNavigationQa.longTasks,
        routeFilter: route ? getComputedStyle(route).filter : "missing",
        routeOpacity: route ? Number.parseFloat(getComputedStyle(route).opacity) : 0,
        routeHeadingOutline: (() => {
          const heading = route?.querySelector("h1, [data-route-heading]");
          if (!heading) return "missing";
          const style = getComputedStyle(heading);
          return `${style.outlineStyle} ${style.outlineWidth}`;
        })(),
      };
    });
    steps.push({
      index: index + 1,
      destination: expected.href,
      drawerOpenMs: openSettledAt - openedAt,
      routeCommitMs: routeCommittedAt - routeClickedAt,
      activeAnimationsAtOpen: beforeRoute.activeAnimations,
      animationOwnersAtOpen: beforeRoute.animationOwners,
      newLongTasks: afterRoute.longTasks.slice(beforeRoute.longTaskCount),
      ...afterRoute,
    });
  }

  const summary = {
    label,
    base,
    cpuRate,
    reducedMotion,
    iterations: runIterations,
    rapidToggleSettled,
    drawerOpenP95Ms: percentile(
      steps.map((step) => step.drawerOpenMs),
      0.95,
    ),
    routeCommitP95Ms: percentile(
      steps.map((step) => step.routeCommitMs),
      0.95,
    ),
    routeCommitMaxMs: Math.max(...steps.map((step) => step.routeCommitMs)),
    longTasks: steps.flatMap((step) => step.newLongTasks).length,
    longestTaskMs: Math.max(
      0,
      ...steps.flatMap((step) => step.newLongTasks).map((task) => task.duration),
    ),
    errors,
  };
  await writeFile(
    join(output, `${label}.json`),
    `${JSON.stringify({ summary, steps }, null, 2)}\n`,
  );
  await page.screenshot({ path: join(output, `${label}.png`), fullPage: false });
  await context.close();
  return { summary, steps };
}

// Scoped Services page checks: desktop/mobile layout, every quick-nav and
// footer anchor resolves to a real element, keyboard focus reaches the
// quick-nav rail, and reduced motion settles without a stray long task.
const servicesAnchors = ["start", "how", "build", "platform", "stack", "work", "shapes"];
const servicesFooterAnchors = ["strategy", "automation", "sales", "reporting", "build", "work"];
// Legacy /content/services.ts catalog hrefs (rendered on /work case studies,
// search results and services JSON-LD) that must keep resolving to a real
// element on the rebuilt page.
const servicesLegacyCatalogAnchors = [
  "strategy",
  "automation",
  "sales",
  "engagement",
  "content",
  "reporting",
];

async function runServicesProfile(label, viewport, reducedMotion = "no-preference") {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("net::ERR_FAILED"))
      errors.push(message.text());
  });

  await page.addInitScript(() => {
    window.__accelerateServicesQa = { longTasks: [] };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__accelerateServicesQa.longTasks.push(entry.duration);
      }
    }).observe({ type: "longtask", buffered: true });
  });

  await page.goto(`${base}/services`, { waitUntil: "networkidle", timeout: 30_000 });

  const missingAnchors = await page.evaluate((ids) => {
    return ids.filter((id) => !document.getElementById(id));
  }, [...new Set([...servicesAnchors, ...servicesFooterAnchors, ...servicesLegacyCatalogAnchors])]);

  await page.getByRole("navigation", { name: "Services page sections" }).waitFor();
  const quickNavLink = page.locator('.services-subnav-link[href="#build"]');
  await quickNavLink.evaluate((node) => node.click());
  await page.waitForTimeout(reducedMotion === "reduce" ? 0 : 260);
  const buildInView = await page.evaluate(() => {
    const node = document.getElementById("build");
    if (!node) return false;
    const rect = node.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });

  await page.keyboard.press("Tab");
  let reachedQuickNav = false;
  for (let i = 0; i < 40 && !reachedQuickNav; i += 1) {
    reachedQuickNav = await page.evaluate(() =>
      document.activeElement?.classList.contains("services-subnav-link"),
    );
    if (reachedQuickNav) break;
    await page.keyboard.press("Tab");
  }
  const focusOutline = reachedQuickNav
    ? await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return `${style.outlineStyle} ${style.outlineWidth}`;
      })
    : "unreached";

  await page.waitForTimeout(reducedMotion === "reduce" ? 0 : 200);
  const longTasks = await page.evaluate(() => window.__accelerateServicesQa.longTasks);
  const longestTaskMs = Math.max(0, ...longTasks);

  await page.screenshot({ path: join(output, `services-${label}.png`), fullPage: true });
  await context.close();
  await browser.close();

  return {
    label,
    reducedMotion,
    errors,
    missingAnchors,
    buildInView,
    reachedQuickNav,
    focusOutline,
    longestTaskMs,
  };
}

const servicesDesktop = await runServicesProfile("desktop", { width: 1440, height: 900 });
const servicesMobile = await runServicesProfile("mobile", { width: 390, height: 844 });
const servicesReduced = await runServicesProfile(
  "reduced-motion",
  { width: 1440, height: 900 },
  "reduce",
);
const servicesFailures = [];
for (const result of [servicesDesktop, servicesMobile, servicesReduced]) {
  if (result.errors.length)
    servicesFailures.push(`services ${result.label}: runtime errors (${result.errors.join(" | ")})`);
  if (result.missingAnchors.length)
    servicesFailures.push(`services ${result.label}: missing anchor targets (${result.missingAnchors.join(", ")})`);
  if (!result.buildInView)
    servicesFailures.push(`services ${result.label}: #build quick-nav link did not scroll #build into view`);
  if (!result.reachedQuickNav)
    servicesFailures.push(`services ${result.label}: keyboard tab order never reached the quick-nav rail`);
  else if (result.focusOutline === "none 0px")
    servicesFailures.push(`services ${result.label}: quick-nav link has no visible focus outline`);
  const longTaskBudget = result.reducedMotion === "reduce" ? 300 : 200;
  if (result.longestTaskMs > longTaskBudget)
    servicesFailures.push(
      `services ${result.label}: ${result.longestTaskMs.toFixed(0)}ms long task exceeds ${longTaskBudget}ms`,
    );
}

const persistent = await runProfile("persistent", profile);
const fresh = await runProfile(
  "fresh",
  await mkdtemp(join(tmpdir(), "accelerate-public-navigation-fresh-")),
);
const reduced = await runProfile(
  "reduced",
  await mkdtemp(join(tmpdir(), "accelerate-public-navigation-reduced-")),
  "reduce",
  Math.min(iterations, 6),
);
const failures = [];

for (const result of [persistent, fresh, reduced]) {
  if (result.summary.errors.length)
    failures.push(`${result.summary.label}: runtime errors (${result.summary.errors.join(" | ")})`);
  if (!result.summary.rapidToggleSettled)
    failures.push(`${result.summary.label}: rapidly interrupted drawer did not settle closed`);
  for (const step of result.steps) {
    if (step.pathname !== step.destination)
      failures.push(`${result.summary.label} step ${step.index}: route mismatch`);
    if (step.mobileNavVisible)
      failures.push(
        `${result.summary.label} step ${step.index}: mobile navigation remained visible after commit`,
      );
    if (step.routeOpacity < 0.99)
      failures.push(
        `${result.summary.label} step ${step.index}: destination remained translucent (${step.routeOpacity})`,
      );
    if (step.routeFilter !== "none")
      failures.push(
        `${result.summary.label} step ${step.index}: destination retained full-route filter (${step.routeFilter})`,
      );
    if (!step.routeHeadingOutline.startsWith("none") && !step.routeHeadingOutline.endsWith("0px"))
      failures.push(
        `${result.summary.label} step ${step.index}: programmatic route focus drew a broken heading outline (${step.routeHeadingOutline})`,
      );
  }
  if (!observeOnly) {
    if (result.summary.drawerOpenP95Ms > 400)
      failures.push(
        `${result.summary.label}: drawer open p95 ${result.summary.drawerOpenP95Ms.toFixed(0)}ms exceeds 400ms at ${cpuRate}x CPU`,
      );
    if (result.summary.routeCommitP95Ms > 1_200)
      failures.push(
        `${result.summary.label}: route commit p95 ${result.summary.routeCommitP95Ms.toFixed(0)}ms exceeds 1200ms at ${cpuRate}x CPU`,
      );
    const longTaskBudget = result.summary.reducedMotion === "reduce" ? 300 : 200;
    if (result.summary.longestTaskMs > longTaskBudget)
      failures.push(
        `${result.summary.label}: ${result.summary.longestTaskMs.toFixed(0)}ms long task exceeds ${longTaskBudget}ms at ${cpuRate}x CPU`,
      );
  }
}

if (!observeOnly) {
  const allowed = Math.max(
    fresh.summary.routeCommitP95Ms * 1.25,
    fresh.summary.routeCommitP95Ms + 180,
  );
  if (persistent.summary.routeCommitP95Ms > allowed)
    failures.push(
      `persistent route commit p95 ${persistent.summary.routeCommitP95Ms.toFixed(0)}ms materially exceeds fresh ${fresh.summary.routeCommitP95Ms.toFixed(0)}ms`,
    );
}

const allFailures = [...failures, ...servicesFailures];

const report = {
  result: allFailures.length ? "failed" : "passed",
  persistent: persistent.summary,
  fresh: fresh.summary,
  reduced: reduced.summary,
  services: {
    desktop: servicesDesktop,
    mobile: servicesMobile,
    reducedMotion: servicesReduced,
  },
  failures: allFailures,
  artifacts: output,
};
await writeFile(join(output, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
if (allFailures.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
