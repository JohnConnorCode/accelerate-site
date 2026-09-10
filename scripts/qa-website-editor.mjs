import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3038";
const output = "/tmp/accelerate-website-editor";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const networkWrites = [];
const results = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/"))
      networkWrites.push(request.url());
  });
  await page.goto(`${base}/demo/command-center/northline-roofing/site/website`);
  await page.getByText("Bundled website loaded.", { exact: false }).waitFor();
  const section = page
    .locator("details")
    .filter({ has: page.locator("textarea") })
    .first();
  await section.locator("summary").click();
  const eyebrow = section.getByRole("textbox", { name: "Eyebrow", exact: true });
  await eyebrow.fill("A private fictional edit", { timeout: 5000 }).catch(async (error) => {
    await page.screenshot({ path: `${output}/failure.png` });
    console.log(await page.locator("main").innerText());
    throw error;
  });
  await page.evaluate(() => {
    const original = window.fetch;
    let fail = true;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      if (fail && String(input) === "/api/admin/site/website" && init?.method === "POST") {
        fail = false;
        throw new TypeError("Simulated lost response after save");
      }
      return response;
    };
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("button", { name: "Retry same save", exact: true }).waitFor();
  assert.equal(await eyebrow.isDisabled(), true, "uncertain save locks fields");
  await page.getByRole("button", { name: "Retry same save", exact: true }).click();
  await page.getByText("Private revision 1 saved.", { exact: false }).waitFor();
  const saved = await page.evaluate(
    async () => (await (await fetch("/api/admin/site/website")).json()).website,
  );
  assert.equal(saved.version, 1, "lost response retry does not create another revision");
  await eyebrow.fill("Keep this unsaved edit");
  await page.evaluate(async () => {
    const { website } = await (await fetch("/api/admin/site/website")).json();
    const document = website.draft.document;
    document.identity.tagline = "Another editor saved this change.";
    const result = await fetch("/api/admin/site/website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "save",
        expectedVersion: website.version,
        requestKey: crypto.randomUUID(),
        document,
      }),
    });
    if (!result.ok) throw new Error("Fixture update failed");
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "website changed" }).waitFor();
  assert.equal(await eyebrow.inputValue(), "Keep this unsaved edit");
  await page.getByRole("button", { name: "Website tools", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export draft", exact: true }).click(),
  ]);
  const downloaded = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(downloaded.pages[0].content.sections[0].fields.eyebrow, "Keep this unsaved edit");
  await page.getByRole("button", { name: "Website tools", exact: true }).click();
  await page.getByRole("button", { name: "Reload saved draft", exact: true }).click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  assert.equal(await eyebrow.inputValue(), "Keep this unsaved edit");
  await page.screenshot({ path: `${output}/desktop-conflict.png` });
  await page.getByRole("button", { name: "Website tools", exact: true }).click();
  await page.getByRole("button", { name: "Reload saved draft", exact: true }).click();
  await page.getByRole("button", { name: "Replace local edits", exact: true }).click();
  await page.getByText("Saved draft loaded.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Website tools", exact: true }).click();
  await page.getByRole("link", { name: "Open saved preview", exact: true }).click();
  const frameResponse = await page.request.get(`${base}/site-preview`);
  assert.equal(frameResponse.headers()["x-frame-options"], "SAMEORIGIN");
  assert.equal(frameResponse.headers()["content-security-policy"], "frame-ancestors 'self'");
  assert.equal(
    (await frameResponse.text()).includes("A private fictional edit"),
    false,
    "Anonymous frame HTML never contains saved draft text",
  );
  const preview = page.frameLocator('iframe[title="Saved website preview"]');
  await preview.getByText("Private preview of saved revision 2.", { exact: false }).waitFor();
  await preview.getByText("A private fictional edit", { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/desktop-preview.png` });
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('iframe[title="Saved website preview"]')?.contentWindow?.innerWidth ===
      390,
  );
  assert.equal(await preview.locator("body").evaluate(() => window.innerWidth), 390);
  await page.screenshot({ path: `${output}/mobile-preview.png` });

  results.push(
    "Lost save response replays revision 1; stale edit preserves local fields; export and reload confirmation work; saved preview shows revision 2.",
  );
  await page.goto(`${base}/demo/command-center/alder-ridge-law/site/website`);
  await page.getByText("Bundled website loaded.", { exact: false }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Open saved preview", exact: true }).count(),
    0,
  );
  results.push("A second fictional scenario cannot read the first scenario's draft.");
  const appearances = JSON.parse(
    await readFile(new URL("../src/lib/admin/themes.json", import.meta.url), "utf8"),
  );
  for (const appearance of appearances) {
    await page.evaluate(
      (value) =>
        sessionStorage.setItem("accelerate:admin-demo:alder-ridge-law:appearance:v1", value),
      appearance.id,
    );
    await page.reload();
    await page.getByText("Bundled website loaded.", { exact: false }).waitFor();
    await page.waitForFunction(
      (id) => document.documentElement.getAttribute("data-theme") === id,
      appearance.id,
    );
    await page.screenshot({ path: `${output}/appearance-${appearance.label.toLowerCase()}.png` });
  }
  results.push(
    "Editor screens captured in all five shared appearances; the mobile preview uses a real 390px frame viewport.",
  );
  const titleBeforeImport = await page
    .getByRole("textbox", { name: "Title", exact: true })
    .inputValue();
  await page.getByLabel("Import website snapshot", { exact: true }).setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...downloaded, tenantId: "not-portable" })),
  });
  await page.getByRole("alert").filter({ hasText: "Import rejected" }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    titleBeforeImport,
  );
  await page.getByLabel("Import website snapshot", { exact: true }).setInputFiles({
    name: "website-draft.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(downloaded)),
  });
  await page.getByText("Imported into local edits.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByText("Private revision 1 saved.", { exact: false }).waitFor();
  results.push(
    "Invalid import preserves current fields; a valid portable import saves as a private revision in the destination scenario.",
  );
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const mobile = await mobileContext.newPage();
  mobile.on("pageerror", (error) => errors.push(error.message));
  await mobile.goto(`${base}/demo/command-center/northline-roofing/site/website`);
  await mobile.getByText("Bundled website loaded.", { exact: false }).waitFor();
  await mobile
    .locator("details")
    .filter({ has: mobile.locator("textarea") })
    .first()
    .locator("summary")
    .click();
  assert.equal(
    await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    "mobile document has no horizontal overflow",
  );
  await mobile.screenshot({ path: `${output}/mobile-editor.png` });
  await mobile.getByRole("button", { name: "Save draft", exact: true }).focus();
  await mobile.keyboard.press("Enter");
  await mobile.getByText("Private revision 1 saved.", { exact: false }).waitFor();
  results.push("Mobile editor fits 390px; keyboard activation saves the fictional draft.");
  assert.deepEqual(errors, [], "no browser runtime errors");
  assert.deepEqual(networkWrites, [], "fictional website mutations never reach the network");
  await writeFile(
    `${output}/result.json`,
    JSON.stringify({ results, errors, networkWrites }, null, 2),
  );
  console.log(JSON.stringify({ status: "passed", results, output }, null, 2));
} finally {
  await browser.close();
}
