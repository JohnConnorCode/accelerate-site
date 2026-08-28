import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const profile = "/tmp/accelerate-persistent-browser-profile";
const output = "/tmp/accelerate-persistent-profile-qa";
const failures = [];
await mkdir(output, { recursive: true });

function signature(frame) {
  return `${frame.opacity.toFixed(3)}:${frame.transform}:${frame.filter}`;
}

async function sampleFrames(locator, checkpoints) {
  const frames = [];
  let elapsed = 0;
  for (const checkpoint of checkpoints) {
    await locator.page().waitForTimeout(checkpoint - elapsed);
    elapsed = checkpoint;
    frames.push(await locator.evaluate((node, at) => {
      const style = getComputedStyle(node);
      return {
        at,
        opacity: Number.parseFloat(style.opacity),
        transform: style.transform,
        filter: style.filter,
      };
    }, checkpoint));
  }
  return frames;
}

const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  viewport: { width: 390, height: 844 },
  reducedMotion: "no-preference",
});
const page = context.pages()[0] || await context.newPage();
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("net::ERR_FAILED")) runtimeErrors.push(message.text());
});

// Public navigation must remain animated with an existing disk cache and the
// local preferences a returning profile carries between browser sessions.
await page.goto(`${base}/work`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.setItem("accelerate-theme", "light");
  sessionStorage.setItem("accelerate:persistent-profile-qa", "returning");
});
const workLink = page.locator('[data-work-card="work-shelter"] a').first();
await workLink.scrollIntoViewIfNeeded();
await workLink.click({ noWaitAfter: true });
await page.waitForURL("**/work/work-shelter", { timeout: 15_000 });
const publicStage = page.locator("[data-route-entry]");
await publicStage.waitFor();
const publicFrames = await sampleFrames(publicStage, [0, 80, 240, 420]);
if (new Set(publicFrames.map(signature)).size < 3 || publicFrames.at(-1).opacity < 0.99) {
  failures.push(`returning public profile did not visibly settle through intermediate frames: ${JSON.stringify(publicFrames)}`);
}
await page.screenshot({ path: `${output}/public-returning-profile.png`, fullPage: false });

// A returning profile may satisfy this route from disk immediately. The slow
// route suite separately proves pending acknowledgement; this pass proves that
// cached navigation still receives a real committed entrance instead of a pop.
await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded" });
await page.locator("[data-admin-route-stage]").waitFor();
const pipelineLink = page.locator('a[href^="/demo/command-center/northline-roofing/pipeline"]:visible').first();
await pipelineLink.click({ noWaitAfter: true });
await page.waitForURL("**/northline-roofing/pipeline", { timeout: 15_000 });
const adminStage = page.locator("[data-admin-route-stage]");
const adminFrames = await sampleFrames(adminStage, [0, 72, 180, 460]);
if (new Set(adminFrames.map(signature)).size < 3 || adminFrames.at(-1).opacity < 0.99) {
  failures.push(`returning admin profile did not visibly settle through intermediate frames: ${JSON.stringify(adminFrames)}`);
}
await page.screenshot({ path: `${output}/admin-returning-profile.png`, fullPage: false });

// Controlled overlays must also interpolate rather than appearing as a final
// frame after a state update.
await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Approvals", exact: true }).click();
await page.locator('[data-today-workspace] button[aria-haspopup="dialog"]').first().click({ noWaitAfter: true });
const dialog = page.locator('[data-admin-overlay="dialog"]');
await dialog.waitFor({ state: "attached" });
const dialogFrames = await sampleFrames(dialog, [0, 64, 160, 300]);
if (new Set(dialogFrames.map(signature)).size < 3 || dialogFrames.at(-1).opacity < 0.99) {
  failures.push(`returning profile dialog did not visibly settle through intermediate frames: ${JSON.stringify(dialogFrames)}`);
}
await page.keyboard.press("Escape");
await page.waitForTimeout(16);
if (await dialog.count() !== 1) failures.push("dialog unmounted before its exit frame in the returning profile");
await dialog.waitFor({ state: "detached", timeout: 5_000 });

if (runtimeErrors.length) failures.push(`runtime errors: ${runtimeErrors.join(" | ")}`);
await context.close();

if (failures.length) {
  console.error(`Persistent profile QA failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", profile, screenshots: output }, null, 2));
