/**
 * Feature Board robustness check: subtasks on the card, dialog editor
 * above the fold, column quick-add, WIP menu, mobile layout.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3015";
const outDir = "/tmp/accelerate-qa-feature-board-kanban";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/features` },
});
if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("no sign-in token");
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
        value: cookieValue.slice(index * 3180, (index * 3180 + 3180)),
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
  page.on("pageerror", (error) => {
    const message = error.message.split("\n")[0];
    if (!message.includes("TeamCard")) failures.push(`pageerror: ${message}`);
  });
  return { context, page };
}

{
  const { context, page } = await authedPage({ width: 1440, height: 1000 });
  await page.goto("/admin/features", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Feature Board", exact: true }).waitFor({ timeout: 30_000 });
  await page.locator('[role="region"][aria-label="Kanban board"] article').first().waitFor({
    timeout: 30_000,
  });
  await page.waitForTimeout(800);

  const subtaskCopy = await page.getByText(/\d+\/\d+ subtasks/).count();
  if (!subtaskCopy) failures.push("desktop: no subtask progress on cards");

  const completeButtons = page.getByRole("button", { name: /^Complete / });
  const completeCount = await completeButtons.count();
  if (!completeCount) failures.push("desktop: no inline subtask checkboxes on cards");

  const addCard = await page.getByRole("button", { name: "Add card" }).count();
  if (!addCard) failures.push("desktop: missing column quick-add");

  await page.locator('[role="region"][aria-label="Kanban board"]').evaluate((node) =>
    node.scrollIntoView({ block: "start" }),
  );
  await page.screenshot({ path: `${outDir}/desktop-board.png` });

  if (completeCount) {
    const label = await completeButtons.first().getAttribute("aria-label");
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/admin/features") && res.request().method() === "PATCH",
      { timeout: 15_000 },
    ).catch(() => null);
    await completeButtons.first().click();
    const response = await responsePromise;
    if (!response) failures.push("desktop: subtask toggle did not PATCH");
    else if (!response.ok()) failures.push(`desktop: subtask PATCH ${response.status()}`);
    await page.screenshot({ path: `${outDir}/desktop-toggled.png` });
    if (label) {
      const stillOpen = await page.getByRole("button", { name: label }).count();
      if (stillOpen) failures.push(`desktop: completed subtask remained on the card (${label})`);
    }
  }

  const editButtons = page.getByRole("button", { name: /^Edit / });
  if (await editButtons.count()) {
    await editButtons.first().click();
    const heading = page.getByRole("heading", { name: "Subtasks" });
    await heading.waitFor({ timeout: 10_000 }).catch(() => failures.push("desktop: Subtasks heading missing in dialog"));
    const inView = await heading
      .evaluate((node) => {
        const box = node.getBoundingClientRect();
        return box.top >= 0 && box.top < window.innerHeight - 80;
      })
      .catch(() => false);
    if (!inView) failures.push("desktop: Subtasks heading is below the fold in the dialog");
    await page.screenshot({ path: `${outDir}/desktop-dialog.png` });
    await page.getByRole("button", { name: "Close feature details" }).click();
  } else {
    failures.push("desktop: no edit buttons to open dialog");
  }

  const menu = page.getByRole("button", { name: /^Column options for / }).first();
  await menu.click();
  const wip = page.getByRole("menuitem", { name: "WIP limit" });
  if (!(await wip.count())) failures.push("desktop: WIP limit missing from column menu");
  await page.screenshot({ path: `${outDir}/desktop-column-menu.png` });
  await context.close();
}

{
  const { context, page } = await authedPage({ width: 390, height: 844 });
  await page.goto("/admin/features", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Feature Board", exact: true }).waitFor({ timeout: 30_000 });
  await page.locator('[role="region"][aria-label="Kanban board"] article').first().waitFor({
    timeout: 30_000,
  });
  await page.locator('[role="region"][aria-label="Kanban board"]').evaluate((node) =>
    node.scrollIntoView({ block: "start" }),
  );
  const geom = await page.evaluate(() => {
    const board = document.querySelector('[role="region"][aria-label="Kanban board"]');
    const column = board?.querySelector("section[aria-labelledby]");
    return {
      colWidth: column?.getBoundingClientRect().width ?? 0,
      boardWidth: board?.getBoundingClientRect().width ?? 0,
    };
  });
  if (geom.colWidth < geom.boardWidth * 0.85)
    failures.push(`phone: column should fill the scrollport ${JSON.stringify(geom)}`);
  await page.screenshot({ path: `${outDir}/phone-board.png` });
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`kanban ok → ${outDir}`);
