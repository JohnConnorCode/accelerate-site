import { chromium } from "playwright";
import { mkdirSync } from "fs";

// Usage: node scripts/film.mjs <path> <frames> <mode> [theme] [width] [height]
//   mode = "scroll" (filmstrip across scroll) | "time" (entrance at top)
const path = process.argv[2] || "/v2";
const frames = Number(process.argv[3] || 16);
const mode = process.argv[4] || "scroll";
const theme = process.argv[5] || "dark";
const base = process.env.SHOT_BASE || "http://localhost:3000";
const out = "/tmp/accel-film";
mkdirSync(out, { recursive: true });

const W = Number(process.argv[6] || 1440);
const H = Number(process.argv[7] || 900);
const frameInterval = Number(process.env.FILM_INTERVAL || 90);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  colorScheme: theme === "light" ? "light" : "dark",
  reducedMotion: "no-preference",
});
await ctx.addInitScript((t) => {
  try {
    localStorage.setItem("theme", t);
  } catch {}
}, theme);
const page = await ctx.newPage();
// emulate a real pointer near center so the interactive grid lights up
await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60000 });
await page.mouse.move(W * 0.5, H * 0.45);
await page.waitForTimeout(1000);

const pad = (n) => String(n).padStart(2, "0");

if (mode === "time") {
  // Reload to catch the entrance from t0, capturing rapid frames.
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < frames; i++) {
    await page.screenshot({ path: `${out}/t-${pad(i)}.png` });
    await page.waitForTimeout(frameInterval);
  }
  console.log(`${out}/t-00.png .. t-${pad(frames - 1)}.png`);
} else {
  const total = await page.evaluate(() => document.body.scrollHeight);
  const maxY = Math.max(0, total - H);
  for (let i = 0; i < frames; i++) {
    const y = Math.round((i / (frames - 1)) * maxY);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    // small wheel nudge so the interactive pointer + scrub update
    await page.mouse.move(W * 0.5, H * 0.45 + (i % 2 === 0 ? 10 : -10));
    await page.waitForTimeout(260);
    await page.screenshot({ path: `${out}/s-${pad(i)}.png` });
  }
  console.log(`${out}/s-00.png .. s-${pad(frames - 1)}.png`);
}

await browser.close();
