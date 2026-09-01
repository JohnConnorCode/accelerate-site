import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = process.env.QA_OUTPUT || "/tmp/accelerate-admin-layout-continuity";
const scenario = "hearthline-realty";
const routes = [
  "analytics",
  "bookings",
  "recovery",
  "revenue",
  "pipeline",
  "features",
  "integrations",
  "emails",
  "website-grades",
  "conversations",
  "inbox",
  "activity",
  "campaigns",
];
const screenshotRoutes = new Set(["analytics", "bookings", "recovery", "revenue"]);
const appearances = ["signal", "light", "dark"];
const viewports = [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];

for (const appearance of appearances) {
  for (const [viewportLabel, viewport] of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript(
      ({ key, value }) => {
        try {
          sessionStorage.setItem(key, value);
        } catch {
          /* sandboxed preview frame */
        }
      },
      {
        key: `accelerate:admin-demo:${scenario}:appearance:v1`,
        value: appearance,
      },
    );
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error")
        runtimeErrors.push(`console: ${message.text().split("\n")[0]}`);
    });
    page.on("pageerror", (error) => runtimeErrors.push(`page: ${error.message.split("\n")[0]}`));

    for (const route of routes) {
      const url = `${base}/demo/command-center/${scenario}/${route}`;
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      if (!response || response.status() >= 500)
        failures.push(
          `${appearance} ${viewportLabel} ${route}: HTTP ${response?.status() ?? "none"}`,
        );
      await page.locator(".admin-shell").waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForFunction(
        (expected) => window.__accelerateAdminDemoRuntime === expected,
        scenario,
        { timeout: 30_000 },
      );
      await page
        .locator('[data-admin-async-state="ready"], [data-admin-async-state="refreshing"]')
        .first()
        .waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForFunction(
        (expected) => document.documentElement.dataset.theme === expected,
        appearance,
        { timeout: 30_000 },
      );

      const state = await page.evaluate(() => {
        const stacks = [...document.querySelectorAll(".admin-content-stack")];
        const stackStates = stacks.map((stack) => {
          const children = [...stack.children].filter((child) => {
            const rect = child.getBoundingClientRect();
            const style = getComputedStyle(child);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              style.position !== "absolute" &&
              style.position !== "fixed"
            );
          });
          const gaps = children.slice(1).map((child, index) => {
            const previous = children[index].getBoundingClientRect();
            const current = child.getBoundingClientRect();
            return Math.round((current.top - previous.bottom) * 10) / 10;
          });
          return {
            display: getComputedStyle(stack).display,
            computedGap: Number.parseFloat(getComputedStyle(stack).rowGap),
            childCount: children.length,
            gaps,
          };
        });
        return {
          theme: document.documentElement.dataset.theme,
          documentOverflow: document.documentElement.scrollWidth - innerWidth,
          stackStates,
          bookingSubtitle: document.querySelector(".admin-page-header p")?.textContent || "",
        };
      });

      if (!state.stackStates.length)
        failures.push(`${appearance} ${viewportLabel} ${route}: shared content stack is missing`);
      for (const [index, stack] of state.stackStates.entries()) {
        if (stack.display !== "grid" || stack.computedGap < 16)
          failures.push(
            `${appearance} ${viewportLabel} ${route}: stack ${index} has ${stack.display} / ${stack.computedGap}px rhythm`,
          );
        if (stack.gaps.some((gap) => gap < 16))
          failures.push(
            `${appearance} ${viewportLabel} ${route}: stack ${index} sibling gap collapsed (${stack.gaps.join(", ")}px)`,
          );
      }
      if (state.documentOverflow > 2)
        failures.push(
          `${appearance} ${viewportLabel} ${route}: document overflows by ${state.documentOverflow}px`,
        );
      if (route === "bookings" && /roof/i.test(state.bookingSubtitle))
        failures.push(
          `${appearance} ${viewportLabel} bookings: tenant-specific roofing copy leaked into Hearthline`,
        );
      if (runtimeErrors.length)
        failures.push(
          `${appearance} ${viewportLabel} ${route}: ${runtimeErrors.splice(0).join("; ")}`,
        );

      if (appearance === "signal" && screenshotRoutes.has(route))
        await page.screenshot({ path: `${output}/${route}-${viewportLabel}.png`, fullPage: true });
    }
    await context.close();
  }
}

await browser.close();
if (failures.length) throw new Error(`Admin layout continuity failures:\n${failures.join("\n")}`);
console.log(
  `Admin layout continuity passed for ${routes.length} routes, ${appearances.length} appearances, and ${viewports.length} viewports. Screenshots: ${output}`,
);
