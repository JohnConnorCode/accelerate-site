import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const scenario = "northline-roofing";
const output = "/tmp/accelerate-source-authority";
const failures = [];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`${label}: console ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/admin") && pathname !== "/api/admin/source-authority")
      failures.push(`${label}: protected request escaped demo runtime (${pathname})`);
  });
  await page.goto(`${base}/demo/command-center/${scenario}/source-authority`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.getByRole("heading", { name: "Source authority" }).waitFor({ timeout: 30_000 });
  await page.getByRole("heading", { name: "Registered sources" }).waitFor({ timeout: 15_000 });
  const crm = page.getByText("Canonical CRM");
  await crm.waitFor({ timeout: 10_000 });
  if (!(await page.getByText("official", { exact: false }).count()))
    failures.push(`${label}: official tier is missing`);
  if (!(await page.getByText("Stale", { exact: true }).count()))
    failures.push(`${label}: stale source is not surfaced`);
  if (!(await page.getByText("Slack asides").count()))
    failures.push(`${label}: low-trust source is missing`);
  await page.getByRole("button", { name: "Register source" }).click();
  await page.getByText("System key").waitFor({ timeout: 10_000 });
  await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
  if (label === "mobile" && overflow) failures.push(`${label}: horizontal overflow`);
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(JSON.stringify({ result: "failed", failures, screenshots: output }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", screenshots: output }, null, 2));
