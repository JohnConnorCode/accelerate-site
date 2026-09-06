/**
 * Feature Board empty-horizon + left-edge layout check.
 * Proves the board opens on Now+Next with a populated working set, that
 * columns fill the content row instead of clustering on the left, and that
 * the public roadmap renders without a 500.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3015";
const outDir = "/tmp/accelerate-qa-feature-board-layout";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/features` },
});
if (linkError || !linkData?.properties?.hashed_token)
  throw linkError || new Error("no sign-in token");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session) throw verifyError || new Error("no session");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieKey = `sb-${projectRef}-auth-token`;
const cookieParts =
  cookieValue.length <= 3180
    ? [{ name: cookieKey, value: cookieValue }]
    : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({
        name: `${cookieKey}.${index}`,
        value: cookieValue.slice(index * 3180, (index + 1) * 3180),
      }));

const failures = [];
const browser = await chromium.launch({ headless: true });

async function authedPage(viewport) {
  const context = await browser.newContext({ baseURL: base, viewport, reducedMotion: "reduce" });
  const origin = new URL(base);
  await context.addCookies(
    cookieParts.map((cookie) => ({
      ...cookie,
      domain: origin.hostname,
      path: "/",
      httpOnly: false,
      secure: origin.protocol === "https:",
      sameSite: "Lax",
    })),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(error.message.split("\n")[0]));
  return { context, page };
}

async function openBoard(page) {
  await page.goto("/admin/features", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page
    .getByRole("heading", { name: "Feature Board", exact: true })
    .waitFor({ timeout: 30_000 });
  await page.getByLabel("Filter by milestone").waitFor({ timeout: 30_000 });
  await page.locator('[role="region"][aria-label="Kanban board"] article').first().waitFor({
    timeout: 30_000,
  });
}

for (const [label, viewport] of [
  ["phone", { width: 390, height: 844 }],
  ["tablet", { width: 768, height: 1024 }],
  ["laptop", { width: 1280, height: 800 }],
  ["desktop", { width: 1440, height: 1000 }],
]) {
  const { context, page } = await authedPage(viewport);
  await openBoard(page);
  const selected = await page.getByLabel("Filter by milestone").inputValue();
  if (selected !== "active") failures.push(`${label}: default milestone is ${selected}`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  if (overflow) failures.push(`${label}: document overflows horizontally`);
  const geom = await page.evaluate(() => {
    const board = document.querySelector('[role="region"][aria-label="Kanban board"]');
    const column = board?.querySelector("section[aria-labelledby]");
    const main = document.querySelector(".admin-main");
    const boardBox = board?.getBoundingClientRect();
    const colBox = column?.getBoundingClientRect();
    const mainBox = main?.getBoundingClientRect();
    return {
      colWidth: colBox?.width ?? 0,
      colLeft: colBox?.left ?? 0,
      boardWidth: boardBox?.width ?? 0,
      mainLeft: mainBox?.left ?? 0,
      vw: window.innerWidth,
    };
  });
  if (geom.colLeft < geom.mainLeft - 12)
    failures.push(`${label}: column overflows main left ${JSON.stringify(geom)}`);
  if (label === "phone") {
    if (geom.colWidth < geom.boardWidth * 0.85)
      failures.push(`${label}: column should fill the scrollport ${JSON.stringify(geom)}`);
  } else if (geom.colWidth < 240 || geom.colWidth > 420) {
    failures.push(`${label}: column width messy ${JSON.stringify(geom)}`);
  }
  await page
    .locator('[role="region"][aria-label="Kanban board"]')
    .evaluate((node) => node.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: `${outDir}/${label}.png` });
  await context.close();
}

{
  const context = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const response = await page.goto("/roadmap", { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (!response || response.status() >= 400)
    failures.push(`public roadmap HTTP ${response?.status()}`);
  await page.getByRole("heading", { name: /shipped, in progress, and planned/i }).waitFor({
    timeout: 20_000,
  });
  const columns = await page.locator("text=/In progress|Planned|Blocked|Backlog|Shipped/").count();
  if (columns < 3) failures.push(`public roadmap missing status columns (got ${columns})`);
  await page.screenshot({ path: `${outDir}/roadmap.png`, fullPage: true });
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`layout ok → ${outDir}`);
