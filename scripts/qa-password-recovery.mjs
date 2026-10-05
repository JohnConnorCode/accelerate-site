import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3019";
const output = process.env.RUNNER_TEMP
  ? `${process.env.RUNNER_TEMP}/accelerate-password-recovery`
  : "/tmp/accelerate-password-recovery-browser";
assert.equal(new URL(base).hostname, "localhost", "Controlled recovery QA requires a local app");
await mkdir(output, { recursive: true });
let server;
let browser;
const results = [];
try {
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    const dist = process.env.NEXT_DIST_DIR || ".next";
    const { config } = JSON.parse(await readFile(`${dist}/required-server-files.json`, "utf8"));
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "--hostname", "localhost", "--port", "3019"],
      {
        env: { ...process.env, NEXT_DEPLOYMENT_ID: config.deploymentId },
        stdio: "ignore",
      },
    );
  }
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server?.exitCode != null) throw new Error("Recovery QA server exited before readiness");
    try {
      if ((await fetch(`${base}/admin/login`, { signal: AbortSignal.timeout(2000) })).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Readiness only. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Recovery QA server must be ready");
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
      const errors = [];
      const escaped = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let attempt = 0;
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith("/auth/v1/")) {
          if (url.pathname.endsWith("/settings"))
            return route.fulfill({ json: { external: { google: false } } });
          if (url.pathname.endsWith("/user") && route.request().method() === "PUT") {
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 600));
            return route.fulfill({
              status: 400,
              headers: { "x-supabase-api-version": "2024-01-01" },
              json: {
                code: attempt === 1 ? "fixture_provider_failure" : "same_password",
                message: "PRIVATE_PROVIDER_DETAIL_MUST_NOT_BE_DISPLAYED",
              },
            });
          }
          escaped.push(url.pathname);
          return route.abort();
        }
        if (url.origin === base && url.pathname === "/api/admin/password-reset")
          return route.fulfill({ json: { success: true } });
        if (url.origin !== base) {
          escaped.push(url.origin);
          return route.abort();
        }
        return route.continue();
      });
      await page.goto(`${base}/admin/login?error=reset_failed`);
      await page.getByRole("heading", { name: "Reset your password", exact: true }).waitFor();
      await page
        .getByRole("alert")
        .getByText(/expired or was invalid/)
        .waitFor();
      const email = page.getByLabel("Email", { exact: true });
      await email.focus();
      await page.keyboard.type("founder@local.test");
      await page.getByRole("button", { name: "Send reset link" }).focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("status")
        .getByText("Check your email for a password reset link.")
        .waitFor();
      await page.screenshot({ path: `${output}/${label}-reset-request.png` });

      await page.goto(`${base}/admin/update-password`);
      await page.getByLabel("New password", { exact: true }).fill("fictional-new-password");
      await page.getByLabel("Confirm password", { exact: true }).fill("fictional-new-password");
      await page.getByRole("button", { name: "Update password", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("alert")
        .getByText(/recovery session has expired/)
        .waitFor();
      assert(await page.getByRole("button", { name: "Update password", exact: true }).isEnabled());
      await page.screenshot({ path: `${output}/${label}-missing-session.png` });
      await page.getByRole("link", { name: "Request a new reset link" }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("heading", { name: "Reset your password", exact: true }).waitFor();

      // A fictional unsigned cookie exercises the client update state only.
      // Native Auth separately verifies real sessions and password replacement.
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
      const cookieKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
      const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const user = {
        id: "00000000-0000-4000-8000-000000000001",
        email: "founder@local.test",
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
      };
      const access = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, sub: user.id, aud: "authenticated", role: "authenticated" })}.fictional`;
      await context.addCookies([
        {
          name: cookieKey,
          value: `base64-${encode({ access_token: access, refresh_token: "fictional", expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user })}`,
          url: base,
        },
      ]);
      await page.goto(`${base}/admin/update-password`);
      await page.getByLabel("New password", { exact: true }).fill("fictional-new-password");
      await page.getByLabel("Confirm password", { exact: true }).fill("fictional-new-password");
      const update = page.getByRole("button", { name: "Update password", exact: true });
      await update.focus();
      await page.keyboard.press("Enter");
      const loading = page.getByRole("button", { name: "Updating…", exact: true });
      await loading.waitFor();
      assert(await loading.isDisabled());
      await page.screenshot({ path: `${output}/${label}-updating.png` });
      await page
        .getByRole("alert")
        .getByText(/could not be updated/)
        .waitFor();
      assert(await update.isEnabled());
      assert(!(await page.getByText("PRIVATE_PROVIDER_DETAIL_MUST_NOT_BE_DISPLAYED").count()));
      await page.screenshot({ path: `${output}/${label}-provider-failure.png` });
      await update.click();
      await page
        .getByRole("alert")
        .getByText("Choose a password different from your current password.", { exact: true })
        .waitFor();
      assert(await update.isEnabled());
      assert.equal(attempt, 2);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/${label}-retry.png` });
      assert.deepEqual(errors, []);
      assert.deepEqual(escaped, []);
      results.push({
        label,
        width,
        checks: [
          "expired-link-guidance",
          "keyboard-reset-request",
          "missing-session-recovery-link",
          "disabled-loading",
          "provider-error-redaction",
          "retry-and-same-password-guidance",
          "no-overflow",
          "no-uncaught-errors",
          "no-provider-traffic",
        ],
      });
    } finally {
      await context.close();
    }
  }
  const receipt = {
    result: "passed",
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    proof:
      "Controlled browser states; provider API intercepted, no actual recovery email or verified session",
    results,
  };
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
} finally {
  await browser?.close();
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) =>
      server.exitCode !== null ? resolve() : server.once("exit", resolve),
    );
  }
}
