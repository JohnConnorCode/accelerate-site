import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.PLAYWRIGHT_BASE_URL || "https://www.acceleratewith.us";
const outputDirectory = "/tmp/accel-shots";
mkdirSync(outputDirectory, { recursive: true });

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_EMAIL",
]) {
  if (!process.env[key]) throw new Error(`${key} is required for production Contact Import QA`);
}

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
const { data: link, error: linkError } = await supabaseAuth.auth.admin.generateLink({
  type: "magiclink",
  email: adminEmail,
  options: { redirectTo: `${base}/auth/callback?next=/admin/contact-imports` },
});
if (linkError || !link?.properties?.hashed_token) {
  throw linkError || new Error("Could not generate the production QA session");
}
const { data: verified, error: verifyError } = await supabaseAuth.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session) {
  throw verifyError || new Error("Could not exchange the production QA session");
}
const serviceDatabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieKey = `sb-${projectRef}-auth-token`;
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieChunks = cookieValue.length <= 3180
  ? [{ name: cookieKey, value: cookieValue }]
  : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({
      name: `${cookieKey}.${index}`,
      value: cookieValue.slice(index * 3180, (index + 1) * 3180),
    }));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "light",
});
const origin = new URL(base);
await context.addCookies(cookieChunks.map((cookie) => ({
  ...cookie,
  domain: origin.hostname,
  path: "/",
  httpOnly: false,
  secure: origin.protocol === "https:",
  sameSite: "Lax",
})));
const page = await context.newPage();
const failures = [];
page.on("console", (message) => {
  if (message.type() === "error") failures.push(message.text());
});
page.on("pageerror", (error) => failures.push(error.message));

async function removeControlledBatch(batchId) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = await serviceDatabase
      .from("contact_import_batches")
      .delete()
      .eq("id", batchId)
      .select("id");
    if (result.error) return result.error;
    if (result.data?.length) return null;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return new Error("Controlled QA batch was not visible for cleanup");
}

let batchId = null;
const smokeSourcePrefix = "Revenue OS production smoke record,";
try {
  await page.goto(`${base}/admin/setup`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Setup Center", exact: true }).waitFor();
  const setup = await page.evaluate(async () => {
    const response = await fetch("/api/admin/setup");
    return { status: response.status, body: await response.json() };
  });
  if (setup.status !== 200) throw new Error(`Production Setup API returned ${setup.status}`);
  if (setup.body.summary?.requiredReady !== setup.body.summary?.requiredTotal) {
    throw new Error(
      `Production Setup is ${setup.body.summary?.requiredReady}/${setup.body.summary?.requiredTotal} required checks ready`,
    );
  }
  for (const id of ["ai", "contact_importer", "first_party_analytics"]) {
    const check = setup.body.checks?.find((candidate) => candidate.id === id);
    if (check?.status !== "ready") {
      throw new Error(`Production Setup check ${id} is ${check?.status || "missing"}`);
    }
  }
  await page.getByText("OpenRouter intelligence gateway").waitFor();
  await page.screenshot({ path: `${outputDirectory}/production-setup-ready.png`, fullPage: true });

  await page.goto(`${base}/admin/contact-imports`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Contact intake", exact: true }).waitFor();
  const importerRead = await page.evaluate(async () => {
    const response = await fetch("/api/admin/revenue-os/contact-imports");
    return { status: response.status, body: await response.json() };
  });
  if (importerRead.status !== 200 || importerRead.body.schemaReady !== true) {
    throw new Error(`Production importer read returned ${importerRead.status}`);
  }
  const uniqueEmail = `accelerate-import-smoke-${Date.now()}@example.com`;
  const source = page.getByTestId("contact-import-source");
  await source.click();
  await source.pressSequentially(
    `${smokeSourcePrefix} ${uniqueEmail}, Example QA Company, validation only`,
    { delay: 1 },
  );
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="contact-import-analyze"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().includes("/api/admin/revenue-os/contact-imports") &&
        candidate.request().method() === "POST" &&
        candidate.request().postDataJSON()?.action === "analyze",
      { timeout: 70_000 },
    ),
    page.getByTestId("contact-import-analyze").click(),
  ]);
  const payload = await response.json();
  if (response.status() !== 201 || payload.schemaReady !== true || !payload.batch?.id) {
    throw new Error(`Production importer analysis failed with ${response.status()}: ${payload.error || "unknown error"}`);
  }
  batchId = payload.batch.id;
  if (!Array.isArray(payload.batch.rows) || payload.batch.rows.length !== 1) {
    throw new Error("Production importer did not return the expected reviewed row");
  }
  const reviewed = payload.batch.rows[0]?.reviewed_data;
  if (payload.batch.rows[0]?.confidence !== "low" || payload.batch.rows[0]?.included !== false) {
    throw new Error("Production importer did not downgrade and exclude the incomplete row");
  }
  const trace = payload.batch;
  if (
    trace?.ai_provider !== "openrouter" ||
    !trace.ai_model ||
    !trace.ai_request_id ||
    !Number(trace.ai_usage?.total_tokens)
  ) {
    throw new Error(`Production OpenRouter trace is incomplete for ${batchId}`);
  }
  for (const field of ["phone", "role", "website", "industry"]) {
    if (reviewed?.[field]) throw new Error(`Production importer invented unsupported ${field}`);
  }
  await page.getByRole("heading", { name: "Review rows" }).waitFor();
  await page.screenshot({ path: `${outputDirectory}/production-contact-import-review.png`, fullPage: true });
} finally {
  if (batchId) {
    const error = await removeControlledBatch(batchId);
    if (error) failures.push(`Could not remove controlled QA batch: ${error.message}`);
  } else {
    const { error } = await serviceDatabase
      .from("contact_import_batches")
      .delete()
      .like("source_excerpt", `${smokeSourcePrefix}%`);
    if (error) failures.push(`Could not remove timed-out controlled QA batches: ${error.message}`);
  }
  await context.close();
  await browser.close();
}

if (failures.length) throw new Error(`Production Contact Import QA errors:\n${failures.join("\n")}`);
console.log(`${outputDirectory}/production-setup-ready.png`);
console.log(`${outputDirectory}/production-contact-import-review.png`);
console.log("Production Setup readiness, OpenRouter extraction, review rendering, and controlled-batch cleanup passed.");
