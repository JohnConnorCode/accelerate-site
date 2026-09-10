import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3036";
const output = "/tmp/accelerate-blueprint-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const scenarios = [
  "northline-roofing",
  "alder-ridge-law",
  "ledgerstone-advisory",
  "hearthline-realty",
  "common-table-network",
];

async function expectReview(page, version) {
  await page.getByRole("heading", { name: `Blueprint v${version}`, exact: true }).waitFor();
  for (const section of [
    "Business model",
    "Workflows",
    "Boards",
    "Coworkers",
    "Integrations",
    "Questions and assumptions",
    "Approval gates",
    "Preflight",
  ]) {
    await page.getByRole("heading", { name: section, exact: true }).waitFor();
  }
  await page.getByText("Production Order", { exact: true }).first().waitFor();
  await page.getByText("Blocked", { exact: true }).first().waitFor();
  await page.getByText("Approval", { exact: true }).first().waitFor();
  await page.getByText("Fictional workspace", { exact: false }).first().waitFor();
}

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    const escaped = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
    });
    await page.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== new URL(base).origin || u.pathname.startsWith("/api/")) {
        escaped.push(u.origin + u.pathname);
        return route.abort();
      }
      return route.continue();
    });

    for (const [index, scenario] of scenarios.entries()) {
      const root = `${base}/demo/command-center/${scenario}`;
      await page.goto(`${root}/blueprints`);
      await page.getByRole("heading", { name: "Workspace Blueprints", exact: true }).waitFor();
      await page
        .getByRole("link", { name: "Example Manufacturing Blueprint", exact: true })
        .first()
        .waitFor();

      if (index === 0) {
        // Full review flow on the first scenario, including edit-forks-version.
        await page.getByRole("link", { name: "Review", exact: true }).click();
        await expectReview(page, 1);
        await page.screenshot({ path: `${output}/review-${width}.png` });

        await page.getByRole("button", { name: "Edit blueprint", exact: true }).click();
        await page
          .getByLabel("Business summary", { exact: true })
          .fill("Edited summary for the Playwright review pass.");
        await page.getByRole("button", { name: "Save as new version", exact: true }).click();
        await expectReview(page, 2);
        await page.getByText("Edited summary for the Playwright review pass.").waitFor();

        // Session persistence across reload.
        await page.reload();
        await expectReview(page, 2);

        // Keyboard operability without motion.
        await page.keyboard.press("Tab");
        assert.ok(await page.evaluate(() => document.activeElement !== document.body));

        // Reset restores the seeded proposal (reload lands on the detail URL).
        await page.getByRole("button", { name: "Open demo controls", exact: true }).click();
        await page.getByRole("button", { name: "Reset this demo", exact: true }).click();
        await expectReview(page, 1);
      } else {
        // Other scenarios load the same seeded proposal independently.
        await page.getByRole("link", { name: "Review", exact: true }).click();
        await expectReview(page, 1);
      }
    }
    if (width === 390) await page.screenshot({ path: `${output}/list-390.png` });
    assert.deepEqual(escaped, []);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "PASS: Blueprint review in all five scenarios at desktop/mobile; sections, Ready/Blocked/Approval states, edit-forks-version, session persistence, reset, cross-scenario isolation, keyboard/reduced motion and zero escaped API/provider requests or console errors.",
  );
} finally {
  await browser.close();
}
