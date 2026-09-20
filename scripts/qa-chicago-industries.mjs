import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";

const output = process.env.QA_OUTPUT ?? "/tmp/accelerate-chicago-qa";
const port = 3028;
const base = `http://localhost:${port}`;
mkdirSync(output, { recursive: true });
const verticals = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      'import("./src/content/verticals.ts").then(module => console.log(JSON.stringify((module.default || module).verticals)))',
    ],
    { encoding: "utf8" },
  ),
);
const newIndustries = verticals.filter((vertical) =>
  [
    "restaurants-catering",
    "retail-ecommerce",
    "salons-spas",
    "fitness-studios",
    "pet-services",
    "auto-repair",
    "property-management",
    "cleaning-companies",
    "staffing-recruiting",
    "events-venues",
  ].includes(vertical.slug),
);
const articles = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      'console.log(JSON.stringify(require("./src/lib/mdx.ts").getAllArticles().map(article => article.frontmatter)))',
    ],
    { encoding: "utf8" },
  ),
);
const recipes = readdirSync("src/content/docs/recipes")
  .filter((name) => name.endsWith(".mdx") && name !== "overview.mdx")
  .map((name) => `/docs/recipes/${name.replace(/\.mdx$/, "")}`);
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", String(port)],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "";
server.stdout.on("data", (data) => (serverLog += data));
server.stderr.on("data", (data) => (serverLog += data));
const checks = [];
let browser;
async function visit(page, route) {
  const response = await page.goto(base + route, { waitUntil: "networkidle", timeout: 60000 });
  assert(response?.ok(), `${route}: HTTP ${response?.status()}`);
  assert.equal(await page.locator("main h1").count(), 1, `${route}: one page heading`);
  assert(await page.locator("main h1").isVisible());
  assert(await page.locator('link[rel="canonical"]').getAttribute("href"), `${route}: canonical`);
}
async function inspect(page, route, width, theme) {
  await visit(page, route);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  }
  await page.evaluate(async () => {
    const images = [...document.images].filter(
      (image) => image.getClientRects().length && !image.closest('[aria-hidden="true"]'),
    );
    await Promise.race([
      Promise.all(images.map((image) => image.decode())),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Image decoding timed out")), 15000),
      ),
    ]);
  });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    `${route}: overflow at ${width}`,
  );
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => !document.querySelector("[data-dock]"));
  assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
  const name = route.replace(/^\//, "").replaceAll("/", "-");
  await page.screenshot({ path: `${output}/${name}-${width}-${theme}.png`, fullPage: true });
  const timing = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    return {
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
      resourceCount: performance.getEntriesByType("resource").length,
    };
  });
  checks.push({ route, width, theme, status: "passed", localTiming: timing });
}
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try {
      if ((await fetch(`${base}/robots.txt`)).ok) break;
    } catch {
      /* server starting */
    }
    if (attempt === 59) throw new Error("Server startup timed out");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch();
  for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      // Credential-free QA isolates the database-backed analytics endpoint.
      await context.route("**/api/analytics/events", (route) => route.fulfill({ status: 204 }));
      await context.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      const routes = [
        "/chicago",
        "/industries",
        "/industries/home-services",
        "/docs/recipes/catering-inquiry",
        "/docs/recipes/catering-event-handoff",
        "/learn/chicago-small-businesses-ai-2026",
        ...newIndustries.map((item) => `/industries/${item.slug}`),
      ];
      for (const route of routes) await inspect(page, route, width, theme);
      assert(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
      await visit(page, "/chicago");
      await page.keyboard.press("Tab");
      assert.match(await page.locator(":focus").innerText(), /Skip to main content/i);
      await page.keyboard.press("Enter");
      if (width >= 1280) {
        const menu = page.getByRole("navigation", { name: "Primary", exact: true });
        await menu.getByRole("button", { name: "Industries", exact: true }).focus();
        await page.keyboard.press("Enter");
        assert(await menu.getByRole("link", { name: "All industries", exact: true }).isVisible());
        await page.keyboard.press("Escape");
      } else {
        const trigger = page.getByRole("button", { name: "Open navigation menu" });
        await trigger.focus();
        await page.keyboard.press("Enter");
        const menu = page.getByRole("navigation", { name: "Mobile", exact: true });
        await menu.getByRole("button", { name: "Industries", exact: true }).focus();
        await page.keyboard.press("Enter");
        assert(await menu.getByRole("link", { name: "All industries", exact: true }).isVisible());
        await page.keyboard.press("Escape");
        await page.locator("#mobile-site-navigation").waitFor({ state: "hidden" });
        assert(await trigger.evaluate((element) => element === document.activeElement));
      }
      const question = page.getByText("Do you work with businesses outside downtown?", {
        exact: true,
      });
      // Follow the real keyboard path. A programmatic focus call can fail while
      // the menu's visibility update settles, leaving Enter on the menu trigger.
      await question.waitFor({ state: "visible" });
      for (let step = 0; step < 60; step++) {
        if (await question.evaluate((element) => element === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }
      assert(
        await question.evaluate((element) => element === document.activeElement),
        `${width}/${theme}: FAQ reachable by keyboard after closing navigation`,
      );
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("main details")?.open === true);
      assert.equal(errors.length, 0, errors.join("\n"));
      await context.close();
    }
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/api/analytics/events", (route) => route.fulfill({ status: 204 }));
  const page = await context.newPage();
  const normalErrors = [];
  page.on("pageerror", (error) => normalErrors.push(error.message));
  const titles = new Set();
  for (const vertical of verticals) {
    const route = `/industries/${vertical.slug}`;
    await visit(page, route);
    const title = await page.title();
    assert(!titles.has(title), `${route}: unique title`);
    titles.add(title);
    assert((await page.locator('link[rel="canonical"]').getAttribute("href")).endsWith(route));
    assert.equal(await page.locator('#workflow-recipes a[href^="/docs/recipes/"]').count(), 2);
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    assert(schemas.map(JSON.parse).some((schema) => schema["@type"] === "Service"));
    assert(!(await page.locator('meta[name="robots"][content*="noindex"]').count()));
    assert.equal(
      await page.locator('meta[name="description"]').getAttribute("content"),
      vertical.shortDescription,
    );
    assert((await page.locator("main").innerText()).includes(vertical.pilot.measure));
    assert((await page.locator("main").innerText()).includes(vertical.pilot.readyWhen));
  }
  for (const route of recipes) await visit(page, route);
  for (const route of ["/chicago", "/about", "/contact"]) {
    await visit(page, route);
    assert((await page.locator("main").innerText()).includes("1 W Monroe Street, Chicago, IL"));
    assert((await page.locator("footer").innerText()).includes("1 W Monroe Street, Chicago, IL"));
    const organization = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    )
      .map(JSON.parse)
      .find((item) => item["@type"] === "Organization");
    assert.equal(organization.address.streetAddress, "1 W Monroe Street");
    assert.equal(organization.location.name, "Ferris");
    assert(!organization.openingHours && !organization.aggregateRating);
  }
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  for (const route of [
    "/chicago",
    ...verticals.map((item) => `/industries/${item.slug}`),
    ...recipes,
  ])
    assert(sitemap.includes(`${route}</loc>`), `${route}: sitemap`);
  assert(!sitemap.includes("/demo/"));
  const collections = new Map([["/learn", articles]]);
  for (const article of articles) {
    collections.set(
      `/learn/category/${article.category}`,
      articles.filter((item) => item.category === article.category),
    );
    for (const tag of article.tags) {
      const matched = articles.filter((item) => item.tags.includes(tag));
      if (matched.length >= 2) collections.set(`/learn/tag/${encodeURIComponent(tag)}`, matched);
    }
  }
  for (const [route, matched] of collections) {
    const entry = sitemap.split("<url>").find((item) => item.includes(`${route}</loc>`));
    const expected = new Date(
      Math.max(...matched.map((item) => Date.parse(item.updatedDate || item.date))),
    ).toISOString();
    assert(
      entry?.includes(`<lastmod>${expected}</lastmod>`),
      `${route}: newest publication or revision date`,
    );
  }
  await visit(page, "/chicago");
  const internal = await page
    .locator('main a[href^="/"]')
    .evaluateAll((links) => [
      ...new Set(links.map((link) => link.getAttribute("href").split("#")[0])),
    ]);
  for (const route of internal)
    assert((await fetch(base + route)).ok, `${route}: Chicago internal link`);
  const missing = await fetch(`${base}/industries/unknown-industry`);
  assert.equal(missing.status, 404);
  checks.push({
    status: "passed",
    checks:
      "20 unique industry pages, 40 guides, HQ consistency, schemas, sitemap, internal links, unknown route and normal motion",
  });
  assert.deepEqual(normalErrors, [], "Normal-motion route errors");
  await context.close();
  writeFileSync(
    `${output}/report.json`,
    JSON.stringify(
      {
        status: "passed",
        checks,
        boundary:
          "Local production build; analytics stubbed; no connected-provider or ranking claim.",
      },
      null,
      2,
    ),
  );
  console.log(`PASS: ${checks.length} checks; screenshots and report in ${output}`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  writeFileSync(`${output}/server.log`, serverLog);
}
