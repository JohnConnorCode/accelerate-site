import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const mode = process.argv[2];
const ownerEmail = "founder@local.test";
const base = "http://localhost:3000";

if (mode === "prepare") {
  const statusFile = process.argv[3];
  if (!statusFile) throw new Error("Pass the local Supabase status env file");
  process.loadEnvFile(statusFile);
  const values = {
    NEXT_PUBLIC_SITE_URL: base,
    ADMIN_EMAIL: ownerEmail,
    NEXT_PUBLIC_DISTRIBUTION_PROFILE: "neutral",
    BOOTSTRAP_BRAND_NAME: "Harbor Workspace",
    NEXT_PUBLIC_SUPABASE_URL: process.env.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY,
    SUPABASE_PROJECT_REF: "fork-connected-ci",
    SUPABASE_DB_HOST: "127.0.0.1",
    SUPABASE_DB_PORT: "54322",
    SUPABASE_DB_USER: "postgres",
    SUPABASE_DB_PASSWORD: "postgres",
    SETUP_OWNER_PASSWORD: randomBytes(24).toString("base64url"),
  };
  for (const [name, value] of Object.entries(values)) {
    if (!value) throw new Error(`Local Supabase status lacks ${name}`);
  }
  await writeFile(
    ".env.local",
    Object.entries(values)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  console.log("Prepared isolated fictional fork configuration");
} else if (mode === "run") {
  process.loadEnvFile(".env.local");
  const { chromium } = await import("playwright");
  const output = process.env.RUNNER_TEMP
    ? `${process.env.RUNNER_TEMP}/accelerate-connected-fork`
    : "/tmp/accelerate-connected-fork";
  await mkdir(output, { recursive: true });
  const { config } = JSON.parse(await readFile(".next/required-server-files.json", "utf8"));
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "localhost", "--port", "3000"],
    { env: { ...process.env, NEXT_DEPLOYMENT_ID: config.deploymentId }, stdio: "ignore" },
  );
  let browser;
  const checks = [];
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null)
        throw new Error("Connected fork server exited before readiness");
      try {
        const response = await fetch(`${base}/admin/login`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // Readiness poll, before the server accepts connections.
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, "Connected fork server must become ready");
    browser = await chromium.launch({ headless: true });
    for (const [label, width] of [
      ["desktop", 1440],
      ["mobile", 390],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        await page.goto(`${base}/admin/login`);
        await page.getByLabel("Email", { exact: true }).fill(ownerEmail);
        await page.getByLabel("Password", { exact: true }).fill(process.env.SETUP_OWNER_PASSWORD);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.waitForURL(
          (url) => url.pathname.includes("/admin") && !url.pathname.includes("/login"),
        );
        checks.push(`${label}-owner-sign-in`);

        await page.goto(`${base}/admin/contacts`);
        await page.getByRole("heading", { name: "Contacts", exact: true }).waitFor();
        const name = label === "desktop" ? "Maya Trial" : "Leo Trial";
        const email = label === "desktop" ? "maya@harbor.test" : "leo@harbor.test";
        await page.getByRole("button", { name: "Add contact" }).first().click();
        const dialog = page.getByRole("dialog", { name: "Add contact" });
        await dialog.getByLabel("Full name").fill(name);
        await dialog.getByLabel("Email", { exact: true }).fill(email);
        assert.ok(
          await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 2),
          `${label} contact dialog must not overflow horizontally`,
        );
        await dialog.getByRole("button", { name: "Add contact" }).click();
        await page.getByText(name, { exact: true }).first().waitFor();
        await page.reload();
        await page.getByText(name, { exact: true }).first().waitFor();
        checks.push(`${label}-contact-persists`);
        await page.screenshot({ path: `${output}/${label}-contacts.png`, fullPage: true });

        if (label === "desktop") {
          await page.getByRole("button", { name: "Add contact" }).first().click();
          const duplicate = page.getByRole("dialog", { name: "Add contact" });
          await duplicate.getByLabel("Full name").fill("Duplicate Maya");
          await duplicate.getByLabel("Email", { exact: true }).fill(email);
          await duplicate.getByRole("button", { name: "Add contact" }).click();
          await duplicate
            .getByRole("alert")
            .getByText(/already exists/)
            .waitFor();
          await duplicate.getByRole("button", { name: "Cancel" }).click();
          checks.push("duplicate-email-refused");
        }

        await page
          .getByText(name, { exact: true })
          .locator("..")
          .locator("..")
          .getByRole("link", { name: "Open history" })
          .click();
        await page.getByRole("button", { name: "Add follow-up" }).click();
        const taskDialog = page.getByRole("dialog", { name: "Add a follow-up" });
        const taskTitle = `Call ${name} about trial`;
        await taskDialog.getByLabel("What needs to happen?").fill(taskTitle);
        await taskDialog.getByRole("button", { name: "Add task" }).click();
        await page.reload();
        await page.locator("[data-contact-timeline-item]").getByText(taskTitle).waitFor();
        checks.push(`${label}-linked-task-persists`);
        await page.screenshot({ path: `${output}/${label}-contact-task.png`, fullPage: true });

        if (label === "mobile") await page.getByRole("button", { name: "Open More" }).click();
        await page.getByRole("button", { name: "Sign out" }).click();
        await page.waitForURL((url) => url.pathname === "/admin/login");
        await page.goto(`${base}/admin/contacts`);
        await page.waitForURL((url) => url.pathname.includes("/login"));
        checks.push(`${label}-sign-out-protects-workspace`);
        assert.deepEqual(pageErrors, [], `${label} must not have uncaught browser errors`);
      } finally {
        await context.close();
      }
    }
    const receipt = {
      result: "passed",
      commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      environment: "isolated GitHub runner local Supabase",
      fictionalData: true,
      checks,
      limitations: [
        "No hosted Supabase project",
        "No human installer",
        "No password-reset or restore proof",
      ],
    };
    await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + "\n");
    console.log(JSON.stringify(receipt));
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
  }
} else {
  throw new Error("Usage: node scripts/qa-connected-fork.mjs prepare STATUS_ENV|run");
}
