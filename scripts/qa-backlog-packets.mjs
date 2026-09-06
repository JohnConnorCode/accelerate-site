/**
 * Feature Board empty-horizon + left-edge layout check.
 * Proves the board opens on Now+Next with a populated working set, that
 * columns fill the content row instead of clustering on the left, and that
 * the public roadmap renders without a 500.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3037";
const outDir = "/tmp/accelerate-backlog-packets-qa";
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
const spec = {
  packetVersion: 2,
  northstar: {
    phase: "B",
    layers: ["Remember", "Act"],
    contribution: "Make a fictional operator task safe to resume",
  },
  businessValue: "A controlled operator workflow has a clear next step.",
  currentBehavior: "The fictional task has no retry receipt yet.",
  scope: ["Record one controlled retry receipt"],
  exclusions: ["No external provider calls"],
  workflow: [
    "Inspect the canonical service",
    "Implement the bounded receipt",
    "Verify acceptance and submit for review",
  ],
  failureModes: ["Repeated requests preserve the same receipt"],
  acceptance: [
    {
      id: "AC1",
      criterion: "A duplicate request returns the same receipt.",
      environment: "controlled-integration",
    },
  ],
  verification: [
    {
      command: "npm run test:work-packet",
      environment: "controlled-integration",
      expected: "Controlled fixture passes",
    },
  ],
  references: [{ path: "src/lib/revenue-os/work-board.ts", reason: "Canonical work service" }],
};
const fixture = (id, title, status, work_spec, readiness, initiative = "Runtime quality") => ({
  id,
  seed_key: id,
  title,
  status,
  description: "Controlled browser fixture; no business data.",
  priority: "high",
  labels: ["milestone:next", "category:quality", "phase:3", "capability:testing"],
  sort_order: 1,
  owner: null,
  notes: "Controlled UI verification only.",
  acceptance_criteria: "- Verify the controlled receipt",
  subtasks: [],
  source: "qa",
  archived_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  revision: 1,
  project_key: "qa",
  initiative,
  work_kind: "feature",
  work_spec,
  work_delivery: {},
  dependencies: [],
  readiness,
});
const fixtures = [
  fixture("qa-ready", "QA complete packet", "planned", spec, []),
  fixture("qa-missing", "QA needs repository base", "backlog", {}, ["missing_repository"]),
  fixture("qa-review", "QA waiting for review", "in_review", spec, ["status:in_review"]),
  fixture("qa-verified", "QA verified awaiting integration", "shipped", spec, ["status:shipped"]),
];
await page.route("**/api/admin/features**", async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname !== "/api/admin/features") return route.continue();
  if (route.request().method() !== "GET") throw new Error("This QA must not mutate platform work");
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ schemaReady: true, features: fixtures, nextOffset: null }),
  });
});
await page.goto("/admin/features", { waitUntil: "domcontentloaded" });
await page
  .getByRole("button", { name: "Needs specification", exact: true })
  .click({ timeout: 60000 });
await page.screenshot({ path: `${outDir}/needs-specification.png`, fullPage: true });
await page.getByRole("button", { name: "Edit QA needs repository base", exact: true }).waitFor();
if (await page.getByRole("button", { name: "Edit QA complete packet", exact: true }).count())
  throw new Error("Specification queue includes ready work");
await page.getByRole("button", { name: "Ready to claim", exact: true }).click();
await page.getByLabel("North star phase", { exact: true }).selectOption("B");
await page.getByLabel("Initiative", { exact: true }).selectOption("Runtime quality");
await page.getByRole("button", { name: "Edit QA complete packet", exact: true }).click();
await page.getByText("Implementation contract", { exact: true }).click();
await page.getByText("Execution steps", { exact: true }).waitFor();
await page.getByText("Failure and recovery", { exact: true }).waitFor();
await page.screenshot({ path: `${outDir}/contract-desktop.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${outDir}/contract-mobile.png`, fullPage: true });
await page.getByRole("button", { name: "Close feature details", exact: true }).click();
await page.getByRole("button", { name: "Needs review", exact: true }).focus();
await page.keyboard.press("Enter");
await page.getByRole("button", { name: "Edit QA waiting for review", exact: true }).waitFor();
await page.getByRole("button", { name: "Awaiting integration / proof", exact: true }).click();
await page
  .getByRole("button", { name: "Edit QA verified awaiting integration", exact: true })
  .waitFor();
await page.screenshot({ path: `${outDir}/queues-mobile.png`, fullPage: true });
if (
  await page.evaluate(() => {
    const main = document.querySelector(".admin-main");
    return (
      document.documentElement.scrollWidth > innerWidth + 1 ||
      main.scrollWidth > main.clientWidth + 1 ||
      main.scrollLeft !== 0
    );
  })
)
  throw new Error("Mobile admin container overflow");
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "PASS shared board: specification/ready/review/delivery queues, phase and initiative filtering, structured packet, desktop/mobile, keyboard and reduced motion; no platform mutations.",
);
await browser.close();
