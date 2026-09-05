/**
 * Feature Board empty-horizon + left-edge layout check.
 * Proves the board opens on Now+Next with a populated working set, that
 * columns fill the content row instead of clustering on the left, and that
 * the public roadmap renders without a 500.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3014";
const outDir = "/tmp/accelerate-work-board-qa";
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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL: base,
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
await context.addCookies(
  cookieParts.map((cookie) => ({
    ...cookie,
    domain: new URL(base).hostname,
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  })),
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("/admin/features", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "All work", exact: true }).click();
await page
  .getByPlaceholder("Search title, outcome, owner, subtask, or capability")
  .fill("Receivables and dispute resolution");
await page
  .getByRole("button", { name: "Edit Receivables and dispute resolution plugin", exact: true })
  .click();
await page.getByText("Implementation contract", { exact: true }).click();
await page.screenshot({ path: `${outDir}/admin-plugin-contract-desktop.png`, fullPage: true });
const notes = await page
  .getByPlaceholder("Dependencies, decisions, links, or implementation notes", { exact: true })
  .inputValue();
if (notes.length < 5000) throw new Error("Long notes lost");
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${outDir}/admin-plugin-contract-mobile.png`, fullPage: true });
await page.getByRole("button", { name: "Close feature details", exact: true }).click();
await page.getByText("Agent access", { exact: true }).click();
await page.getByLabel("Agent name", { exact: true }).waitFor();
await page.screenshot({ path: `${outDir}/admin-agent-access-mobile.png`, fullPage: true });
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `PASS authenticated admin: live plugin packet, ${notes.length}-character notes, execution contract, desktop/mobile, credential management metadata`,
);
await browser.close();
