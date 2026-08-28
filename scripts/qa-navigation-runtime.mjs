import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-navigation-runtime";
mkdirSync(output, { recursive: true });
const failures = [];

const browser = await chromium.launch({ headless: true });

for (const config of [
  { label: "mobile", viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" },
  { label: "desktop", viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" },
  { label: "reduced", viewport: { width: 430, height: 932 }, reducedMotion: "reduce" },
]) {
  const context = await browser.newContext({ viewport: config.viewport, reducedMotion: config.reducedMotion });
  await context.addInitScript(() => {
    const count = Number(sessionStorage.getItem("accelerate:qa-document-count") || "0") + 1;
    sessionStorage.setItem("accelerate:qa-document-count", String(count));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });

  await page.goto(`${base}/work`, { waitUntil: "networkidle" });
  const card = page.locator('[data-work-card="work-shelter"] a').first();
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 80));
  const publicOrigin = await page.evaluate(() => window.scrollY);
  await card.evaluate((node) => node.click());
  await page.waitForURL("**/work/work-shelter");
  await page.waitForTimeout(32);
  const publicForward = await page.evaluate(() => ({
    y: window.scrollY,
    animation: getComputedStyle(document.querySelector("[data-route-entry]")).animationName,
    title: document.title,
    focused: document.activeElement?.matches("h1, [data-route-heading]") || false,
  }));
  if (publicForward.y > 2) failures.push(`${config.label}: public forward navigation landed at ${publicForward.y}px`);
  if (config.reducedMotion === "no-preference" && !publicForward.animation.includes("route-entry-in")) failures.push(`${config.label}: public route entrance did not run`);
  if (config.reducedMotion === "reduce" && publicForward.animation !== "none") failures.push("reduced: public route entrance remained animated");
  if (!/WORK\+SHELTER/i.test(publicForward.title)) failures.push(`${config.label}: public destination title is not contextual (${publicForward.title})`);
  if (!publicForward.focused) failures.push(`${config.label}: public forward navigation did not focus the destination heading`);
  await page.goBack();
  await page.waitForTimeout(1_050);
  const publicRestored = await page.evaluate(() => window.scrollY);
  if (Math.abs(publicRestored - publicOrigin) > 2) failures.push(`${config.label}: public history restored ${publicRestored}px instead of ${publicOrigin}px`);

  await page.goto(`${base}/demo/command-center/sprout-and-spark/today`, { waitUntil: "networkidle" });
  await page.locator(".admin-main").waitFor({ state: "visible", timeout: 15_000 });
  await page.evaluate(() => { document.querySelector(".admin-main").scrollTop = 900; });
  await page.waitForTimeout(30);
  const pipeline = page.locator('a[href="/demo/command-center/sprout-and-spark/pipeline"]:visible').first();
  if (!await pipeline.count()) failures.push(`${config.label}: scenario-aware Pipeline link is missing`);
  else await pipeline.evaluate((node) => node.click());
  await page.waitForURL("**/sprout-and-spark/pipeline");
  await page.waitForTimeout(48);
  const earlyFallback = await page.evaluate(() => {
    const fallback = document.querySelector("[data-admin-route-loading]");
    return fallback ? Number(getComputedStyle(fallback).opacity) : null;
  });
  if (config.reducedMotion === "no-preference" && earlyFallback !== null && earlyFallback < 0.1) {
    failures.push(`${config.label}: admin fallback left a blank intermediate frame (${earlyFallback})`);
  }
  await page.locator("[data-admin-route-loading]").waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
  const adminEntrance = await page.evaluate(() => ({
    fallback: document.querySelectorAll("[data-admin-route-loading]").length,
    contentAnimations: document.getAnimations().filter((animation) => (
      animation instanceof CSSAnimation
      && animation.animationName === "admin-route-entry-in"
      && animation.effect?.target instanceof Element
      && animation.effect.target.closest(".admin-route-entry")
    )).length,
  }));
  if (adminEntrance.fallback) failures.push(`${config.label}: admin route fallback did not resolve`);
  if (config.reducedMotion === "no-preference" && !adminEntrance.contentAnimations) failures.push(`${config.label}: real admin destination did not receive its route entrance`);
  await page.waitForTimeout(1_050);
  const adminForward = await page.evaluate(() => ({
    y: document.querySelector(".admin-main").scrollTop,
    duplicateHeaders: document.getAnimations().filter((animation) => (
      animation instanceof CSSAnimation
      && String(animation.effect?.target?.className || "").includes("admin-page-title")
    )).length,
    title: document.title,
    focused: document.activeElement?.matches("h1, [data-route-heading]") || false,
  }));
  if (adminForward.y > 2) failures.push(`${config.label}: admin forward navigation landed at ${adminForward.y}px`);
  if (adminForward.duplicateHeaders) failures.push(`${config.label}: admin header retained ${adminForward.duplicateHeaders} duplicate entrance animations`);
  if (config.reducedMotion === "reduce" && adminEntrance.contentAnimations) failures.push("reduced: admin route entrance remained animated");
  if (adminForward.title !== "Pipeline | Sprout & Spark Kids Studio Demo") failures.push(`${config.label}: demo title is not contextual (${adminForward.title})`);
  if (!adminForward.focused) failures.push(`${config.label}: admin forward navigation did not focus the destination heading`);
  await page.goBack();
  await page.waitForTimeout(1_050);
  const adminRestored = await page.evaluate(() => document.querySelector(".admin-main").scrollTop);
  if (Math.abs(adminRestored - 900) > 2) failures.push(`${config.label}: admin history restored ${adminRestored}px instead of 900px`);

  if (config.label === "mobile") {
    await page.getByRole("button", { name: "Open More" }).click();
    await page.getByRole("button", { name: "Open demo controls" }).click();
    const documentCount = await page.evaluate(() => sessionStorage.getItem("accelerate:qa-document-count"));
    await page.getByLabel("Demo business").selectOption("northline-roofing");
    await page.waitForURL("**/northline-roofing/today");
    await page.waitForTimeout(120);
    const scenarioState = await page.evaluate(() => ({
      count: sessionStorage.getItem("accelerate:qa-document-count"),
      title: document.querySelector(".admin-mobile-header")?.textContent || "",
      documentTitle: document.title,
      y: document.querySelector(".admin-main")?.scrollTop || 0,
    }));
    if (scenarioState.count !== documentCount) failures.push("mobile: scenario switch caused a full document reload");
    if (!scenarioState.title.includes("Northline")) failures.push("mobile: scenario identity did not update after client navigation");
    if (scenarioState.documentTitle !== "Today | Northline Roofing & Exteriors Demo") failures.push(`mobile: scenario title did not update (${scenarioState.documentTitle})`);
    if (scenarioState.y > 2) failures.push(`mobile: scenario switch landed at ${scenarioState.y}px`);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  if (overflow) failures.push(`${config.label}: navigation flow caused horizontal overflow`);
  if (errors.length) failures.push(`${config.label}: runtime errors: ${errors.join(" | ")}`);
  await page.screenshot({ path: `${output}/${config.label}.png`, fullPage: false });
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", screenshots: output }, null, 2));
