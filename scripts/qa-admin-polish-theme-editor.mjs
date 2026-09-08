import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045",
  output = process.env.QA_OUTPUT || "/tmp/admin-polish-qa";
const browser = await chromium.launch();
const results = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/demo/command-center/superdebate/branding`, { timeout: 120000 });
  await page.getByLabel("Start from").waitFor();
  await page.getByLabel("Start from").selectOption("signal");
  await page.getByLabel("Theme name", { exact: true }).fill("Evergreen");
  const palette = {
    canvas: "#101d1a",
    surface: "#182a24",
    ink: "#edfff4",
    muted: "#accbb8",
    accent: "#7bdca6",
    sidebar: "#0b1611",
    sidebarInk: "#edfff4",
  };
  for (const [key, color] of Object.entries(palette))
    await page.getByLabel(`${key} color`, { exact: true }).fill(color);
  await page.screenshot({ path: `${output}/theme-preview.png` });
  await page.getByRole("button", { name: "Save and use theme" }).click();
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.theme === "workspace" &&
      getComputedStyle(document.querySelector(".admin-shell"))
        .getPropertyValue("--admin-canvas")
        .trim() === "#101d1a",
  );
  results.push("Custom palette preview and save/apply");
  await page.reload();
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".admin-shell"))
        .getPropertyValue("--admin-canvas")
        .trim() === "#101d1a",
  );
  results.push("Workspace theme persists on reload");
  await page.getByText("Import or export a theme", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export theme", exact: true }).click();
  const download = await downloadPromise;
  const file = await download.path();
  const exported = JSON.parse(await readFile(file, "utf8"));
  assert.equal(exported.name, "Evergreen");
  assert.deepEqual(exported.palette, palette);
  results.push("Portable export retains exact theme definition");
  await page
    .getByLabel("Theme definition", { exact: true })
    .fill(JSON.stringify({ ...exported, palette: { ...palette, muted: palette.surface } }));
  await page.getByRole("button", { name: "Preview import", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "4.5:1" }).waitFor();
  assert.equal(
    await page
      .locator(".admin-shell")
      .evaluate((e) => getComputedStyle(e).getPropertyValue("--admin-canvas").trim()),
    palette.canvas,
  );
  results.push("Unreadable import rejected without changing active appearance");
  await page.goto(`${base}/demo/command-center/superdebate/pipeline`);
  await page.getByRole("button", { name: "New opportunity", exact: true }).click();
  const dialog = page.locator('[data-admin-overlay="dialog"]').last();
  await dialog.waitFor();
  assert.equal(
    await dialog.evaluate((e) => getComputedStyle(e).getPropertyValue("--admin-canvas").trim()),
    palette.canvas,
  );
  const surfaceRadius = await dialog.locator(".admin-dialog-surface").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      actual: style.borderTopLeftRadius,
      token: style.getPropertyValue("--admin-surface-radius").trim(),
    };
  });
  assert.equal(surfaceRadius.actual, surfaceRadius.token, "Portal corners follow the saved theme");
  await page.screenshot({ path: `${output}/custom-theme-dialog.png` });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  results.push("Custom theme reaches portal dialogs and closes cleanly");
  await page.goto(`${base}/demo/command-center/hearthline-realty/pipeline`);
  await page.locator("[data-opportunity-id]").first().waitFor();
  assert.notEqual(
    await page
      .locator(".admin-shell")
      .evaluate((e) => getComputedStyle(e).getPropertyValue("--admin-canvas").trim()),
    palette.canvas,
  );
  results.push("Scenario switch does not reuse another workspace theme");
  assert.deepEqual(errors, []);
  await context.close();
  await writeFile(`${output}/theme-editor.json`, JSON.stringify(results, null, 2));
  console.log(results);
} finally {
  await browser.close();
}
