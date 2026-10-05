import assert from "node:assert/strict";
import { randomBytes, generateKeyPairSync, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const mode = process.argv[2];
const ownerEmail = "founder@local.test";
const base = "http://localhost:3000";
const resetCallback = new URL("/auth/callback", base);
resetCallback.searchParams.set("next", "/admin/update-password");

if (mode === "diagnose-native") {
  const path = process.argv[3];
  assert.equal(path, `${process.env.RUNNER_TEMP}/supabase-start.log`);
  const lines = (await readFile(path, "utf8"))
    .split("\n")
    .filter((line) => /error|failed|fatal|unhealthy|invalid|not found/i.test(line))
    .filter(
      (line) =>
        !/jwt_keys|jwt_secret|anon_key|service_role_key|password|authorization|apikey/i.test(line),
    )
    .slice(-30)
    .map((line) => line.replace(/[A-Za-z0-9_+/=-]{40,}/g, "[redacted]").slice(0, 600));
  const output = `${process.env.RUNNER_TEMP}/accelerate-native-mcp-oauth`;
  await mkdir(output, { recursive: true, mode: 0o700 });
  const diagnostic =
    lines.join("\n") || "Native service startup failed without a safe diagnostic line.";
  await writeFile(`${output}/bootstrap-failure.txt`, diagnostic, { mode: 0o600 });
  console.error(diagnostic);
} else if (mode === "configure-native") {
  const root = process.argv[3];
  assert.equal(root, `${process.env.RUNNER_TEMP}/fork-connected-ci`);
  const path = `${root}/supabase/config.toml`;
  let config = await readFile(path, "utf8");
  config = config
    .replace(/^site_url = .*$/m, `site_url = "${base}"`)
    .replace(
      /^additional_redirect_urls = .*$/m,
      `additional_redirect_urls = ${JSON.stringify([`${base}/auth/callback`, resetCallback.href])}`,
    );
  config = config.replace(/(\[auth\.oauth_server\][\s\S]*?)(?=\n\[|$)/, (block) =>
    block
      .replace(/^enabled = false$/m, "enabled = true")
      .replace(/^authorization_url_path = .*$/m, 'authorization_url_path = "/admin/oauth/consent"'),
  );
  config = config.replace(
    /^# signing_keys_path = .*$/m,
    'signing_keys_path = "./signing_keys.json"',
  );
  config +=
    '\n[auth.hook.custom_access_token]\nenabled = true\nuri = "pg-functions://postgres/public/site_editor_access_token_hook"\n';
  assert.match(config, /\[auth\.oauth_server\][\s\S]*?\nenabled = true/);
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  await writeFile(
    `${root}/supabase/signing_keys.json`,
    JSON.stringify([
      {
        ...privateKey.export({ format: "jwk" }),
        kid: randomUUID(),
        alg: "ES256",
        use: "sig",
        key_ops: ["sign", "verify"],
      },
    ]),
    { mode: 0o600 },
  );
  await writeFile(path, config, { mode: 0o600 });
  console.log("Configured fictional native OAuth and asymmetric signing for isolated CI.");
} else if (mode === "prepare") {
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
  assert.equal(process.env.SUPABASE_PROJECT_REF, "fork-connected-ci");
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(process.env.SUPABASE_DB_HOST, "127.0.0.1");
  assert.equal(process.env.ADMIN_EMAIL, ownerEmail);
  assert.ok(!process.env.RESEND_API_KEY, "Native recovery must use local mail capture only");
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
  let currentPassword = process.env.SETUP_OWNER_PASSWORD;
  const mailBase = "http://127.0.0.1:54324";
  async function mail(path) {
    const response = await fetch(`${mailBase}/api/v1/${path}`, {
      signal: AbortSignal.timeout(3000),
    });
    assert.ok(response.ok, "Isolated Mailpit must be available");
    return response.json();
  }
  async function capturedResetLink(existingIds) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const { messages } = await mail("messages");
      const message = messages.find(
        (item) =>
          !existingIds.has(item.ID) &&
          item.To.some((recipient) => recipient.Address === ownerEmail) &&
          /reset/i.test(item.Subject),
      );
      if (message) {
        const body = await mail(`message/${encodeURIComponent(message.ID)}`);
        const hrefs = [...body.HTML.matchAll(/href="([^"]+)"/g)];
        const link = hrefs
          .map((match) => match[1].replaceAll("&amp;", "&"))
          .find((href) => {
            const url = new URL(href);
            return (
              url.origin === process.env.NEXT_PUBLIC_SUPABASE_URL &&
              url.pathname === "/auth/v1/verify" &&
              url.searchParams.get("type") === "recovery" &&
              url.searchParams.get("redirect_to") === resetCallback.href
            );
          });
        assert.ok(link, "Captured email must contain the exact isolated recovery callback");
        return link;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("Native reset email was not captured within 15 seconds");
  }
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
        await page.getByLabel("Password", { exact: true }).fill(currentPassword);
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
        await dialog.screenshot({ path: `${output}/${label}-add-contact.png` });
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
        const recordUrl = page.url();
        await page.screenshot({ path: `${output}/${label}-contact-task.png`, fullPage: true });

        if (label === "mobile") await page.getByRole("button", { name: "Open More" }).click();
        await page.getByRole("button", { name: "Sign out" }).click();
        await page.waitForURL((url) => url.pathname === "/admin/login");
        await page.goto(`${base}/admin/contacts`);
        await page.waitForURL((url) => url.pathname.includes("/login"));
        checks.push(`${label}-sign-out-protects-workspace`);

        const existingMail = new Set((await mail("messages")).messages.map((item) => item.ID));
        await page.getByRole("button", { name: "Forgot password?" }).click();
        await page.getByLabel("Email", { exact: true }).fill(ownerEmail);
        const resetResponse = page.waitForResponse(
          (response) => response.url() === `${base}/api/admin/password-reset`,
        );
        await page.getByRole("button", { name: "Send reset link" }).focus();
        await page.keyboard.press("Enter");
        assert.equal((await resetResponse).status(), 200, "Native reset request must succeed");
        await page
          .getByRole("status")
          .getByText("Check your email for a password reset link.")
          .waitFor();
        assert.ok(
          (await context.cookies()).some((cookie) => cookie.name.includes("code-verifier")),
        );
        const resetLink = await capturedResetLink(existingMail);
        await page.goto(resetLink);
        await page.waitForURL((url) => url.pathname === "/admin/update-password");
        const oldPassword = currentPassword;
        currentPassword = randomBytes(24).toString("base64url");
        await page.getByLabel("New password", { exact: true }).fill(currentPassword);
        await page.getByLabel("Confirm password", { exact: true }).fill(currentPassword);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `${output}/${label}-password-recovery.png` });
        await page.getByRole("button", { name: "Update password", exact: true }).click();
        await page.waitForURL(
          (url) => url.pathname.includes("/admin") && !url.pathname.includes("update-password"),
        );
        await page.goto(recordUrl);
        await page.locator("[data-contact-timeline-item]").getByText(taskTitle).waitFor();
        checks.push(`${label}-native-email-pkce-password-update-retains-records`);

        if (label === "mobile") await page.getByRole("button", { name: "Open More" }).click();
        await page.getByRole("button", { name: "Sign out" }).click();
        await page.waitForURL((url) => url.pathname === "/admin/login");
        await page.getByLabel("Email", { exact: true }).fill(ownerEmail);
        await page.getByLabel("Password", { exact: true }).fill(oldPassword);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.getByRole("alert").waitFor();
        assert.equal(new URL(page.url()).pathname, "/admin/login");
        checks.push(`${label}-old-password-rejected`);
        await page.getByLabel("Password", { exact: true }).fill(currentPassword);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.waitForURL(
          (url) => url.pathname.includes("/admin") && !url.pathname.includes("/login"),
        );
        await page.goto(recordUrl);
        await page.locator("[data-contact-timeline-item]").getByText(taskTitle).waitFor();
        checks.push(`${label}-new-password-sign-in-retains-records`);
        if (label === "mobile") await page.getByRole("button", { name: "Open More" }).click();
        await page.getByRole("button", { name: "Sign out" }).click();
        await page.waitForURL((url) => url.pathname === "/admin/login");
        await page.goto(resetLink);
        await page.waitForURL(
          (url) =>
            url.pathname === "/admin/login" && url.searchParams.get("error") === "reset_failed",
        );
        await page.getByRole("heading", { name: "Reset your password", exact: true }).waitFor();
        await page
          .getByRole("alert")
          .getByText(/expired or was invalid/)
          .waitFor();
        await page.getByRole("button", { name: "Send reset link" }).focus();
        await page.screenshot({ path: `${output}/${label}-replayed-reset-link.png` });
        checks.push(`${label}-replayed-email-refused-with-reset-guidance`);
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
        "No hosted SMTP delivery or human account recovery",
        "No backup/restore proof",
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
