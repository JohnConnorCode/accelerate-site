import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const output = "/tmp/accelerate-client-interactions";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [scenario, width] of [
    ["northline-roofing", 1440],
    ["northline-roofing", 390],
    ["superdebate", 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/admin"))
        errors.push("Protected API escaped demo runtime");
    });
    await page.goto(`${base}/demo/command-center/${scenario}/clients`);
    await page.locator("[data-client-row]").first().waitFor();
    const clients = await page.evaluate(
      async () => (await (await fetch("/api/admin/clients")).json()).clients,
    );
    const first = clients[0];
    const orphanCheck = await page.evaluate(
      async (email) =>
        (
          await (
            await fetch(`/api/admin/contacts/timeline?email=${encodeURIComponent(email)}`)
          ).json()
        ).timeline,
      clients.at(-1).contact_email,
    );
    assert.ok(
      orphanCheck.every((item) => !item.link.includes("/pipeline?search=")),
      "Timeline links must resolve exact records",
    );

    await page
      .getByRole("textbox", { name: "Search clients", exact: true })
      .fill("no-such-client-qa");
    await page.getByText("No clients match these filters.", { exact: false }).waitFor();
    await page
      .getByRole("textbox", { name: "Search clients", exact: true })
      .fill(first.business_name);
    await page.waitForFunction(() => document.querySelectorAll("[data-client-row]").length === 1);
    await page.getByRole("textbox", { name: "Search clients", exact: true }).fill("");
    await page.getByRole("combobox", { name: "Filter by status" }).selectOption("active");
    await page.waitForFunction(
      (count) => document.querySelectorAll("[data-client-row]").length === count,
      clients.filter((c) => c.status === "active").length,
    );
    await page.getByRole("combobox", { name: "Filter by status" }).selectOption("all");
    await page.waitForFunction(
      (count) => document.querySelectorAll("[data-client-row]").length === count,
      clients.length,
    );
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      "Clients should fit the phone viewport",
    );
    await page.screenshot({ path: `${output}/${scenario}-${width}-list.png`, fullPage: true });
    // Click a table cell, not just the tiny business-name text.
    await page.locator(`[data-client-row="${first.id}"] td`).nth(3).click();
    await page.getByRole("heading", { name: first.business_name, exact: true }).waitFor();
    const note = `Reviewed delivery plan at ${width}px`;
    await page.getByRole("textbox", { name: "Notes", exact: true }).fill(note);
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await page.getByText("Client updated", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("textbox", { name: "Notes", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("textbox", { name: "Notes", exact: true }).inputValue(),
      note,
    );
    await page.getByRole("button", { name: "Add follow-up", exact: true }).click();
    const taskTitle = `Confirm ${width}px delivery follow-up`;
    await page.getByRole("textbox", { name: "Follow-up title", exact: true }).fill(taskTitle);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const taskLink = page.getByRole("link", { name: new RegExp(taskTitle) });
    await taskLink.waitFor();
    await page.screenshot({ path: `${output}/${scenario}-${width}-detail.png`, fullPage: true });
    await taskLink.click();
    const inspector = page.getByRole("dialog", { name: "Task details", exact: true });
    await inspector.waitFor();
    assert.equal(
      await inspector.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
      taskTitle,
    );
    await page.reload();
    await page.getByRole("dialog", { name: "Task details", exact: true }).waitFor();
    const stored = await page.evaluate(
      async (id) =>
        (await (await fetch(`/api/admin/tasks?related_type=client&related_id=${id}`)).json()).tasks,
      first.id,
    );
    assert.equal(stored.filter((task) => task.title === taskTitle).length, 1);
    const invalid = await page.evaluate(
      async () =>
        (
          await fetch("/api/admin/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Wrong record",
              related_type: "client",
              related_id: "missing",
              priority: "medium",
            }),
          })
        ).status,
    );
    assert.equal(invalid, 404);
    await page.goto(`${base}/demo/command-center/${scenario}/clients`);
    const keyboardLink = page.getByRole("link", { name: first.business_name, exact: true });
    await keyboardLink.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: first.business_name, exact: true }).waitFor();
    await page
      .getByRole("link", { name: `Open ${first.contact_name}'s contact history`, exact: true })
      .click();
    await page.waitForURL((url) => url.pathname.includes("/contacts/"));
    assert.equal(errors.length, 0, errors.join("\n"));
    results.push({ scenario, width, result: "passed" });
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${output}/result.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
