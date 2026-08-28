import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-ux-integrity";
const failures = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function assertNoSeriousAxe(page, label) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const violations = result.violations.filter((item) => ["serious", "critical"].includes(item.impact || ""));
  if (violations.length) failures.push(`${label}: axe ${violations.map((item) => `${item.id} (${item.nodes.map((node) => node.target.join(" ")).join("; ")})`).join(", ")}`);
}

async function openToday(page) {
  await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded" });
  await page.locator(".admin-shell").waitFor();
  await page.getByRole("button", { name: "Approvals", exact: true }).click();
  const row = page.locator('[data-today-workspace] button[aria-haspopup="dialog"]').first();
  await row.click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Review before approving" });
  await dialog.waitFor();
  await page.waitForFunction(() => new URL(location.href).searchParams.has("action"));
  check(new URL(page.url()).searchParams.has("action"), "today: approval click did not preserve a deep link");
  check(await dialog.evaluate((node) => node.contains(document.activeElement)), "today: approval dialog did not receive focus");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await page.waitForFunction(() => !new URL(location.href).searchParams.has("action"));
  await page.waitForFunction(() => document.activeElement?.hasAttribute("data-approval-review"));
  check(!new URL(page.url()).searchParams.has("action"), "today: closing approval left a stale action URL");
  check(await page.evaluate(() => document.activeElement?.hasAttribute("data-approval-review")), "today: approval close did not return focus to its trigger");
}

for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));

  await openToday(page);

  const bell = page.locator('button[aria-label^="Open command center alerts"]:visible').first();
  const buttonBox = await bell.boundingBox();
  await bell.click();
  const notifications = page.getByRole("dialog", { name: "Notifications" });
  await notifications.waitFor();
  await page.waitForTimeout(350);
  const panelBox = await notifications.boundingBox();
  const geometry = buttonBox && panelBox ? { button: { left: buttonBox.x, right: buttonBox.x + buttonBox.width, top: buttonBox.y }, panel: { left: panelBox.x, right: panelBox.x + panelBox.width, top: panelBox.y, bottom: panelBox.y + panelBox.height, width: panelBox.width, height: panelBox.height }, viewport: viewport } : null;
  check(Boolean(geometry), `${label}: notification geometry unavailable`);
  if (geometry && label === "desktop") {
    check(geometry.panel.left >= geometry.button.right && geometry.panel.left - geometry.button.right <= 20, `desktop: notifications are not anchored beside the bell (${JSON.stringify(geometry)})`);
    check(geometry.panel.width <= 370 && geometry.panel.height <= 560, `desktop: notifications are oversized (${JSON.stringify(geometry)})`);
    check(geometry.panel.right <= geometry.viewport.width - 8 && geometry.panel.bottom <= geometry.viewport.height - 8, `desktop: notifications escape the viewport (${JSON.stringify(geometry)})`);
  }
  if (geometry && label === "mobile") {
    check(geometry.panel.left >= 7 && geometry.panel.right <= geometry.viewport.width - 7, `mobile: notification sheet is not inset from the viewport (${JSON.stringify(geometry)})`);
    check(geometry.panel.bottom <= geometry.viewport.height - 7 && geometry.panel.height <= geometry.viewport.height * 0.7, `mobile: notification sheet owns too much of the page (${JSON.stringify(geometry)})`);
  }
  await page.waitForFunction(() => document.querySelector('.admin-notification-panel')?.contains(document.activeElement));
  check(await notifications.evaluate((node) => node.contains(document.activeElement)), `${label}: notification panel did not receive focus`);
  await page.screenshot({ path: `${output}/notifications-${label}.png`, fullPage: false });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.matches('button[aria-label^="Open command center alerts"]'));
  check(await bell.evaluate((node) => node === document.activeElement), `${label}: notification close did not restore bell focus`);

  await page.goto(`${base}/demo/command-center/northline-roofing/contacts`, { waitUntil: "domcontentloaded" });
  const contactRow = page.locator("[data-contact-row-toggle]").first();
  await contactRow.waitFor();
  const contactId = await contactRow.getAttribute("data-contact-row-toggle");
  await contactRow.click();
  const contactDialog = page.getByRole("dialog").filter({ hasText: "Full message" });
  await contactDialog.waitFor();
  check(await contactDialog.getByText("Full message", { exact: true }).count() === 1, `${label}: contact details lack the full message`);
  check(await contactDialog.getByRole("link", { name: "Open relationship" }).count() === 1, `${label}: contact dialog lacks a relationship action`);
  check(await contactDialog.evaluate((node) => node.contains(document.activeElement)), `${label}: contact dialog did not receive focus`);
  await page.screenshot({ path: `${output}/contact-${label}.png`, fullPage: false });
  await page.keyboard.press("Escape");
  await page.waitForFunction((id) => document.activeElement?.getAttribute("data-contact-row-toggle") === id, contactId);
  check(await page.evaluate((id) => document.activeElement?.getAttribute("data-contact-row-toggle") === id, contactId), `${label}: contact close did not restore row focus`);

  if (label === "mobile") {
    await page.getByRole("button", { name: "Open More", exact: true }).click();
    const drawer = page.locator("#admin-mobile-navigation");
    await drawer.waitFor();
    await page.waitForTimeout(400);
    check(await drawer.getByText("Navigation", { exact: true }).count() === 0, "mobile more: redundant Navigation label remains");
    check(await drawer.getByRole("heading", { name: "More", exact: true }).count() === 0, "mobile more: redundant More heading remains");
    const tools = drawer.getByLabel("Workspace tools");
    check(await tools.getByRole("button", { name: "Search", exact: true }).count() === 1, "mobile more: Search is missing from the top utility area");
    check(await tools.getByRole("button", { name: "Ask AI", exact: true }).count() === 1, "mobile more: Ask AI is missing from the top utility area");
    const toolTop = await tools.evaluate((node) => node.getBoundingClientRect().top);
    check(toolTop < 90, "mobile more: workspace tools do not use the top of the drawer");
    await page.screenshot({ path: `${output}/more-mobile.png`, fullPage: false });
  }

  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const path of ["/roofing", "/demo/command-center"]) {
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
    await page.locator(".site-header").waitFor();
    check(await page.locator(".site-header").count() === 1, `${path}: shared site header is missing or duplicated`);
    check(await page.locator("footer").count() === 1, `${path}: shared site footer is missing or duplicated`);
    if (path === "/roofing") {
      const reducedHero = await page.locator("h1").evaluate((node) => ({ opacity: getComputedStyle(node).opacity, transform: getComputedStyle(node).transform, filter: getComputedStyle(node).filter }));
      check(reducedHero.opacity === "1" && reducedHero.transform === "none" && reducedHero.filter === "none", "/roofing: hero remained hidden or animated under reduced motion");
    }
    await assertNoSeriousAxe(page, path);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${output}/${path === "/roofing" ? "roofing" : "launcher"}-public.png`, fullPage: true });
  }
  await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded" });
  check(await page.locator(".site-header").count() === 0 && await page.locator("footer").count() === 0, "entered demo: marketing chrome leaked into the application workspace");
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${base}/demo/command-center/northline-roofing/setup`, { waitUntil: "domcontentloaded" });
  const sync = page.getByRole("button", { name: "Sync Gmail", exact: true });
  await sync.click();
  const message = page.getByRole("status").filter({ hasText: "Gmail sync completed." });
  await message.waitFor();
  const contrast = await message.evaluate((node) => {
    const rgb = (value) => {
      const channels = (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      return value.startsWith("color(srgb") ? channels.map((channel) => channel * 255) : channels;
    };
    const luminance = (value) => {
      const channels = rgb(value).map((channel) => { const normalized = channel / 255; return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4; });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const style = getComputedStyle(node);
    const light = Math.max(luminance(style.color), luminance(style.backgroundColor));
    const dark = Math.min(luminance(style.color), luminance(style.backgroundColor));
    return (light + 0.05) / (dark + 0.05);
  });
  check(contrast >= 4.5, `setup: success message contrast is ${contrast.toFixed(2)}, expected at least 4.5`);
  await page.screenshot({ path: `${output}/setup-success.png`, fullPage: false });
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(`UX integrity QA failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`UX integrity QA passed. Screenshots: ${output}`);
