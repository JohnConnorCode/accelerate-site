import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream, writeFileSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const port = process.env.ADMIN_CORE_PORT || "3058";
const base = `http://localhost:${port}`;
const out = process.env.QA_OUTPUT || "/tmp/admin-core-qa";
mkdirSync(out, { recursive: true });

const allRoutes = [
  "today",
  "contacts",
  "clients",
  "leads",
  "pipeline",
  "proposals",
  "work",
  "content",
  "features",
  "analytics",
  "revenue",
  "inbox",
  "activity",
  "conversations",
  "campaigns",
  "bookings",
  "integrations",
  "contact-imports",
  "settings",
  "branding",
  "plugins",
  "tenants",
  "setup",
  "recovery",
  "invoicing",
  "collections",
  "ai",
  "radar",
  "learning",
  "blueprints",
  "emails",
  "subscribers",
  "partners",
  "chat-leads",
  "website-grades",
  "resources",
  "email-sequences",
  "client-onboarding",
  "identity-review",
  "meeting-commitments",
  "ai-operations",
  "example-inventory",
  "site",
  "site/website",
];
// Each worker releases its compiler before the next group. The parent resource
// gate owns the whole process group, including Next and Chromium.
if (
  !process.argv.includes("--worker") &&
  !process.argv.includes("--smoke") &&
  !process.env.QA_ROUTES
) {
  const combined = [];
  for (let offset = 0; offset < allRoutes.length; offset += 6) {
    const output = `${out}/batch-${offset / 6}`;
    const child = spawn(process.execPath, ["scripts/qa-admin-core.mjs", "--worker"], {
      stdio: "inherit",
      env: {
        ...process.env,
        QA_ROUTES: allRoutes.slice(offset, offset + 6).join(","),
        QA_OUTPUT: output,
        QA_SKIP_PREVIEW: offset + 6 < allRoutes.length ? "1" : "0",
      },
    });
    const code = await new Promise((resolve) => child.once("exit", resolve));
    if (code !== 0) process.exit(code || 1);
    combined.push(...JSON.parse(readFileSync(`${output}/results.json`, "utf8")).results);
  }
  writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ status: "passed", results: combined }, null, 2),
  );
  console.log(`PASS complete core route matrix: ${combined.length} route/viewport checks`);
  process.exit(0);
}
const log = createWriteStream(`${out}/server.log`);
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--webpack", "-p", port],
  { stdio: ["ignore", "pipe", "pipe"] },
);
server.stdout.pipe(log);
server.stderr.pipe(log);
let browser;
const results = [];
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Dev server did not become ready")), 60000);
    server.stdout.on("data", (d) => {
      if (d.toString().includes("Ready in")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}`));
    });
  });
  browser = await chromium.launch({ headless: true });
  const smoke = process.argv.includes("--smoke");
  const scenario = "hearthline-realty";
  const themes = JSON.parse(readFileSync("src/lib/admin/themes.json", "utf8"));
  const routes = process.env.QA_ROUTES
    ? process.env.QA_ROUTES.split(",")
    : smoke
      ? ["today", "contacts", "settings"]
      : allRoutes;
  for (const width of smoke ? [1440, 390] : [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      ({ scenario }) => {
        try {
          sessionStorage.setItem(`accelerate:admin-demo:${scenario}:appearance:v1`, "light");
          localStorage.setItem(`accelerate:demo-theme:${scenario}`, "light");
        } catch {
          /* Sandboxed email previews intentionally cannot use storage. */
        }
      },
      { scenario },
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const route of routes) {
      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await page.goto(`${base}/demo/command-center/${scenario}/${route}`, {
            waitUntil: "networkidle",
            timeout: 90000,
          });
          break;
        } catch (error) {
          if (!String(error).includes("ERR_CONNECTION_REFUSED") || attempt === 2) throw error;
          // Next dev restarts its compiler near its memory threshold. Wait for
          // that owned server, without retrying application or assertion failures.
          console.log("Waiting for Next development compiler restart");
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      assert(response?.ok(), `${route}: ${response?.status()}`);
      await page.locator(".admin-shell").waitFor({ timeout: 30000 });
      await page.waitForFunction((id) => window.__accelerateAdminDemoRuntime === id, scenario, {
        timeout: 30000,
      });
      await page.locator("h1").first().waitFor();
      const geometry = await page.evaluate(() => {
        const main = document.querySelector(".admin-main");
        const stage = document.querySelector("[data-admin-composition]");
        const panels = [
          ...document.querySelectorAll(".admin-modules > *, .admin-split > *, .admin-grid > *"),
        ].map((el) => {
          const r = el.getBoundingClientRect();
          return { width: r.width, left: r.left, right: r.right };
        });
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
          composition: stage?.getAttribute("data-admin-composition"),
          panels,
        };
      });
      assert(geometry.overflow <= 2, `${route} document overflow ${geometry.overflow}`);
      assert(geometry.mainOverflow <= 2, `${route} main overflow ${geometry.mainOverflow}`);
      assert(geometry.composition, `${route} missing composition`);
      assert.equal(errors.length, 0, errors.join("\n"));
      results.push({ route, width, ...geometry });
      if (
        [
          "today",
          "contacts",
          "settings",
          "pipeline",
          "conversations",
          "invoicing",
          "proposals",
          "site/website",
        ].includes(route)
      )
        await page.screenshot({
          path: `${out}/${route.replaceAll("/", "-")}-${width}.png`,
          fullPage: true,
        });
      if (route === "site/website") {
        const save = page.getByRole("button", { name: "Save draft", exact: true });
        const tools = page.getByRole("button", { name: "Website tools", exact: true });
        const background = (element) => getComputedStyle(element).backgroundColor;
        assert.notEqual(await save.evaluate(background), await tools.evaluate(background));
        const pages = page.getByRole("button", {
          name: width >= 1280 ? "Pages" : "Edit content",
          exact: true,
        });
        const identity = page.getByRole("button", {
          name: width >= 1280 ? "Identity" : "Preview page",
          exact: true,
        });
        assert.notEqual(await pages.evaluate(background), await identity.evaluate(background));
      }
      console.log(`PASS ${route} ${width}`);
      if (process.env.QA_DETAILS === "1" && ["clients", "contacts"].includes(route)) {
        if (route === "contacts") {
          await page.locator(".admin-record-row").first().click();
          await page.getByRole("dialog").waitFor();
        }
        const href = await page.locator(`a[href*="/${route}/"]`).first().getAttribute("href");
        assert(href, `${route} exposes a detail destination`);
        const detail = await page.goto(new URL(href, base).href, { waitUntil: "networkidle" });
        assert(detail.ok(), `${route} detail loads`);
        await page.locator("h1").first().waitFor();
        assert(
          !/not found/i.test(await page.locator("h1").first().textContent()),
          "Fictional record is present",
        );
        assert(
          await page.evaluate(() => {
            const main = document.querySelector(".admin-main");
            return main.scrollWidth <= main.clientWidth + 2;
          }),
          `${route} detail overflow`,
        );
        await page.addStyleTag({ content: "nextjs-portal { display:none !important; }" });
        await page.screenshot({ path: `${out}/${route}-detail-${width}.png`, fullPage: true });
        results.push({ route: `${route}/detail`, width, composition: "workspace" });
      }
    }
    await context.close();
  }
  if (process.env.QA_SKIP_PREVIEW !== "1") {
    const identities = {};
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.goto(`${base}/dev/admin-design`, { waitUntil: "networkidle", timeout: 90000 });
    await page.screenshot({ path: `${out}/core-preview.png`, fullPage: true });
    const split = page.getByTestId("preview-split");
    await page.getByRole("button", { name: "Hide supporting panel" }).click();
    const widths = await split.evaluate((el) => ({
      parent: el.clientWidth,
      child: el.firstElementChild.getBoundingClientRect().width,
    }));
    assert(Math.abs(widths.parent - widths.child) < 2, "Lone panel must reclaim the full row");
    await page.getByRole("button", { name: "Show supporting panel" }).click();
    await page.getByRole("radio", { name: "Compact", exact: true }).check();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("html").getAttribute("data-admin-density"), "compact");
    await page.getByRole("radio", { name: "Comfortable", exact: true }).check();
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.activeElement?.textContent?.includes("New project"),
      undefined,
      { timeout: 3000 },
    );
    if (!smoke) {
      for (const viewport of [390, 768, 1440, 1920])
        for (const theme of themes)
          for (const density of ["Comfortable", "Compact"]) {
            await page.setViewportSize({ width: viewport, height: 1000 });
            await page.getByLabel("Preview appearance").selectOption(theme.id);
            await page.getByRole("radio", { name: density, exact: true }).check();
            // Capture the chosen identity after its short control transitions settle.
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(350);
            const size = await page
              .getByRole("button", { name: "New project" })
              .evaluate((el) => el.getBoundingClientRect().height);
            assert(size >= 40, "Accessible control size");
            assert(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
              "Preview must not overflow",
            );
            if (viewport === 1440) {
              if (density === "Comfortable")
                identities[theme.id] = await page.evaluate(() => {
                  const title = getComputedStyle(document.querySelector("h1"));
                  const surface = getComputedStyle(document.querySelector(".admin-surface"));
                  const button = getComputedStyle(document.querySelector(".admin-button--primary"));
                  return {
                    font: title.fontFamily,
                    titleWeight: title.fontWeight,
                    surfaceRadius: surface.borderRadius,
                    surfaceShadow: surface.boxShadow,
                    controlRadius: button.borderRadius,
                    surfaceFill: surface.backgroundColor,
                  };
                });
              if (!(await page.evaluate(() => Boolean(window.axe))))
                await page.addScriptTag({ path: require.resolve("axe-core") });
              const audit = await page.evaluate(async () =>
                window.axe.run(document.querySelector(".admin-shell"), {
                  runOnly: { type: "rule", values: ["color-contrast", "label", "button-name"] },
                }),
              );
              writeFileSync(
                `${out}/accessibility-${theme.id}-${density}.json`,
                JSON.stringify(audit.violations, null, 2),
              );
              assert.equal(
                audit.violations.length,
                0,
                `${theme.id} ${density}: ${audit.violations.map((v) => v.id).join(", ")}`,
              );
            }
            await page.screenshot({
              path: `${out}/preview-${theme.id}-${density}-${viewport}.png`,
              fullPage: true,
            });
          }
    }
    if (!smoke) {
      writeFileSync(`${out}/theme-identities.json`, JSON.stringify(identities, null, 2));
      for (const property of ["font", "surfaceRadius", "surfaceShadow", "controlRadius"])
        assert.notEqual(
          identities.material[property],
          identities.mac[property],
          `Material/macOS ${property}`,
        );
      const workspace = await context.newPage();
      await workspace.goto(`${base}/demo/command-center/hearthline-realty/today`, {
        waitUntil: "networkidle",
      });
      for (const theme of themes) {
        await workspace.setViewportSize({ width: 1440, height: 1000 });
        await workspace.getByRole("button", { name: /^Appearance:/ }).click();
        await workspace.getByRole("radio", { name: new RegExp(`^${theme.label}`) }).click();
        await workspace.waitForFunction(
          (id) => document.documentElement.dataset.theme === id,
          theme.id,
        );
        for (const width of [1440, 390]) {
          await workspace.setViewportSize({ width, height: 1000 });
          assert(
            await workspace.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
          );
          await workspace.waitForTimeout(350);
          await workspace.screenshot({
            path: `${out}/workspace-${theme.id}-${width}.png`,
            fullPage: true,
          });
        }
      }
      await workspace.setViewportSize({ width: 1440, height: 1000 });
      await workspace.getByRole("button", { name: /^Appearance:/ }).click();
      const picker = workspace.getByRole("dialog", { name: "Choose admin appearance" });
      await picker.getByRole("radio", { checked: true }).focus();
      await workspace.keyboard.press("Home");
      assert.equal(
        await picker.getByRole("radio", { checked: true }).getAttribute("tabindex"),
        "0",
      );
      await workspace.keyboard.press("ArrowRight");
      await workspace.waitForFunction(() => document.documentElement.dataset.theme === "dark");
      await workspace.screenshot({ path: `${out}/appearance-picker.png`, fullPage: true });
      await workspace.keyboard.press("Escape");
      assert(
        (await workspace.locator(":focus").getAttribute("aria-label"))?.startsWith("Appearance:"),
      );
      await workspace.close();
    }
    const second = await context.newPage();
    await second.goto(`${base}/dev/admin-design`, { waitUntil: "networkidle" });
    await page.getByRole("radio", { name: "Comfortable", exact: true }).check();
    await second.waitForFunction(
      () => document.documentElement.dataset.adminDensity === "comfortable",
    );
    await page.getByRole("radio", { name: "Compact", exact: true }).check();
    await second.waitForFunction(() => document.documentElement.dataset.adminDensity === "compact");
    await context.close();
    const restricted = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await restricted.addInitScript(() => {
      const get = Storage.prototype.getItem,
        set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) {
        if (key === "accelerate:admin:density:v1") throw new Error("Storage unavailable");
        return get.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (key === "accelerate:admin:density:v1") throw new Error("Storage unavailable");
        return set.call(this, key, value);
      };
    });
    const restrictedPage = await restricted.newPage();
    await restrictedPage.goto(`${base}/dev/admin-design`, { waitUntil: "networkidle" });
    assert.equal(
      await restrictedPage
        .locator(".admin-shell")
        .evaluate((el) => getComputedStyle(el).getPropertyValue("--admin-motion-fast").trim()),
      "0ms",
    );
    await restrictedPage.getByRole("radio", { name: "Compact", exact: true }).check();
    assert.equal(
      await restrictedPage.locator("html").getAttribute("data-admin-density"),
      "compact",
    );
    await restrictedPage.getByRole("button", { name: "Show empty state" }).click();
    await restrictedPage.getByText("You’re all caught up").waitFor();
    await restrictedPage.reload({ waitUntil: "networkidle" });
    assert.equal(await restrictedPage.locator("html").getAttribute("data-admin-density"), null);
    await restricted.close();
  }
  writeFileSync(`${out}/results.json`, JSON.stringify({ status: "passed", results }, null, 2));
} finally {
  await browser?.close();
  try {
    server.kill("SIGTERM");
  } catch {}
  log.end();
}
