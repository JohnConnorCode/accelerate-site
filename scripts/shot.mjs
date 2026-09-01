import { chromium } from "playwright";
import { mkdirSync } from "fs";

// Usage: node scripts/shot.mjs <path> <label> [width] [height]
const path = process.argv[2] || "/";
const label = process.argv[3] || "home";
const width = Number(process.argv[4] || 1440);
const height = Number(process.argv[5] || (width < 600 ? 844 : 900));
const base = process.env.SHOT_BASE || "http://localhost:3000";
const maxShots = Number(process.env.SHOT_MAX || Number.POSITIVE_INFINITY);
const settleMs = Number(process.env.SHOT_WAIT || 1500);
const dpr = Number(process.env.SHOT_DPR || 1.5);
const outDir = "/tmp/accel-shots";
mkdirSync(outDir, { recursive: true });

const theme = process.env.SHOT_THEME || "dark";
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: dpr,
  colorScheme: theme === "light" ? "light" : "dark",
});
await ctx.addInitScript((t) => {
  try {
    localStorage.setItem("theme", t);
  } catch {}
}, theme);
const page = await ctx.newPage();
await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
await page.waitForTimeout(settleMs);

// Total scrollable height
const total = await page.evaluate(() => document.body.scrollHeight);
const step = Math.round(height * 0.85);
let y = 0;
let i = 0;
const shots = [];
while (y < total && i < maxShots) {
  await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y);
  await page.waitForTimeout(900); // let ScrollTrigger reveals fire
  const file = `${outDir}/${label}-${width}-${String(i).padStart(2, "0")}.png`;
  await page.screenshot({ path: file });
  shots.push(file);
  y += step;
  i++;
}
console.log(shots.join("\n"));
await browser.close();
