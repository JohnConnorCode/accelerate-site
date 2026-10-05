import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID, createHash } from "node:crypto";
import { chromium } from "playwright";
import { servicePageTemplate } from "../src/lib/site-studio/templates";

async function main() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3028";
  const output = process.env.SITE_STUDIO_QA_OUTPUT ?? "/tmp/accelerate-site-studio-qa";
  await mkdir(output, { recursive: true });
  const server = process.env.PLAYWRIGHT_BASE_URL
    ? null
    : spawn(
        process.execPath,
        [
          "node_modules/next/dist/bin/next",
          "dev",
          "--webpack",
          "--hostname",
          "127.0.0.1",
          "--port",
          "3028",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
  let log = "";
  server?.stdout.on("data", (chunk) => (log += chunk));
  server?.stderr.on("data", (chunk) => (log += chunk));
  let activePage: import("playwright").Page | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    for (let attempt = 0; server && attempt < 60; attempt++) {
      if (log.includes("Ready in")) break;
      if (server.exitCode !== null) throw new Error(log);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    browser = await chromium.launch();
    const document = servicePageTemplate({
      serviceName: "Roof inspection",
      audience: "Property owners",
      outcome: "Review the condition report",
    });
    const initial = {
      id: randomUUID(),
      title: document.metadata.title,
      slug: document.metadata.slug,
      document,
      source: "template",
      status: "draft",
      version: 1,
      checksum: createHash("sha256").update(JSON.stringify(document)).digest("hex"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      // Controlled adapter around the real admin UI. No API/provider request escapes.
      // This is browser interaction proof, not the default demo or live database proof.
      await context.addInitScript("globalThis.__name = (value) => value;");
      await context.addInitScript(
        ({ initial }) => {
          let record: typeof initial | null = null;
          let staleSave = false,
            failedRead = false,
            failedDiscard = false,
            uncertainCreate = false;
          let heldCreate: (() => void) | null = null;
          let holdCreate = false;
          Object.defineProperty(window, "__siteDraftQA", {
            value: {
              holdCreate() {
                holdCreate = true;
              },
              releaseCreate() {
                heldCreate?.();
              },
              conflict() {
                staleSave = true;
              },
              failRead() {
                failedRead = true;
              },
              failDiscard() {
                failedDiscard = true;
              },
              uncertainCreate() {
                uncertainCreate = true;
              },
            },
          });
          let wrapped: typeof fetch;
          const wrap =
            (next: typeof fetch): typeof fetch =>
            async (input, init) => {
              const raw =
                typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
              const url = new URL(raw, location.href);
              if (!url.pathname.startsWith("/api/admin/site/drafts")) return next(input, init);
              const method = init?.method ?? (input instanceof Request ? input.method : "GET");
              const reply = (body: unknown, status = 200) =>
                new Response(JSON.stringify(body), {
                  status,
                  headers: { "content-type": "application/json" },
                });
              if (method === "POST") {
                record = structuredClone(initial);
                if (holdCreate) {
                  holdCreate = false;
                  await new Promise<void>((resolve) => {
                    heldCreate = resolve;
                  });
                  heldCreate = null;
                }
                if (uncertainCreate) {
                  uncertainCreate = false;
                  return reply({ error: "Response lost after saving" }, 503);
                }
                return reply({ draft: record }, 201);
              }
              if (method === "PATCH") {
                const value = JSON.parse(String(init?.body));
                if (!record || value.expectedChecksum !== record.checksum)
                  return reply({ error: "Draft changed; reload" }, 409);
                if (staleSave) {
                  staleSave = false;
                  record = {
                    ...record,
                    title: "Changed elsewhere",
                    checksum: "d".repeat(64),
                    document: {
                      ...record.document,
                      metadata: { ...record.document.metadata, title: "Changed elsewhere" },
                    },
                    version: record.version + 1,
                  };
                  return reply({ error: "Stale title" }, 409);
                }
                record = {
                  ...record,
                  title: value.patches[0].title,
                  document: {
                    ...record.document,
                    metadata: { ...record.document.metadata, title: value.patches[0].title },
                  },
                  checksum: "b".repeat(64),
                  version: record.version + 1,
                };
                return reply({ draft: record });
              }
              if (method === "DELETE") {
                if (new Headers(init?.headers).get("if-match") !== record?.checksum)
                  return reply({ error: "Stale discard" }, 409);
                if (failedDiscard) {
                  failedDiscard = false;
                  return reply({ error: "Stale discard" }, 422);
                }
                const discarded = { id: record!.id, slug: record!.slug, title: record!.title };
                record = null;
                return reply({ discarded });
              }
              if (failedRead) {
                failedRead = false;
                return reply({ error: "Read unavailable" }, 503);
              }
              if (url.pathname === "/api/admin/site/drafts")
                return reply({
                  drafts: record
                    ? [
                        (({ id, slug, title, source, updatedAt, checksum }) => ({
                          id,
                          slug,
                          title,
                          source,
                          updatedAt,
                          checksum,
                        }))(record),
                      ]
                    : [],
                });
              return record ? reply({ draft: record }) : reply({ error: "Draft not found" }, 404);
            };
          wrapped = wrap(window.fetch.bind(window));
          Object.defineProperty(window, "fetch", {
            configurable: true,
            get: () => wrapped,
            set: (value) => {
              wrapped = wrap(value);
            },
          });
        },
        { initial },
      );
      const page = await context.newPage();
      activePage = page;
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });
      page.on("pageerror", (error) => {
        errors.push(error.message);
        console.error("browser:", error.message);
      });
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== base || url.pathname.startsWith("/api/")) return route.abort();
        return route.continue();
      });
      page.setDefaultTimeout(20_000);
      await page.goto(`${base}/demo/command-center/superdebate/site`, { timeout: 60_000 });
      await page.getByRole("heading", { name: "Site Studio", exact: true }).waitFor();
      await page
        .getByPlaceholder("Bookkeeping automation", { exact: true })
        .fill("Roof inspection");
      await page.getByPlaceholder("Home service owners", { exact: true }).fill("Property owners");
      await page
        .getByPlaceholder("The office runs while the crew builds", { exact: true })
        .fill("Review the condition report");
      const catalogue = page.getByText("Browse image catalogue", { exact: true });
      await catalogue.focus();
      await page.keyboard.press("Enter");
      const photos = page.locator("details").filter({ has: catalogue }).getByRole("checkbox");
      assert.ok((await photos.count()) > 8);
      for (let i = 0; i < 8; i++) await photos.nth(i).check();
      assert.equal(await photos.nth(8).isDisabled(), true);
      await page.getByText("8 of 8 images selected", { exact: true }).waitFor();
      await photos.nth(0).uncheck();
      assert.equal(await photos.nth(8).isDisabled(), false);
      for (let i = 1; i < 8; i++) await photos.nth(i).uncheck();
      await catalogue.focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("heading", { name: "Site Studio", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/${width}-create.png`, fullPage: true });
      await page.evaluate(() => Reflect.get(window, "__siteDraftQA").holdCreate());
      await page.getByPlaceholder("bookkeeping-automation", { exact: true }).fill(" CUSTOM-ROOF ");
      await page.getByPlaceholder("Bookkeeping automation", { exact: true }).press("Enter");
      await page.getByRole("button", { name: "Creating draft…", exact: true }).waitFor();
      assert.equal(
        await page.getByPlaceholder("Bookkeeping automation", { exact: true }).isDisabled(),
        true,
      );
      await page.evaluate(() => Reflect.get(window, "__siteDraftQA").releaseCreate());
      await page.getByRole("heading", { name: "Rename draft", exact: true }).waitFor();
      assert.match(page.url(), /\/demo\/command-center\/superdebate\/site\//);
      assert.equal(
        await page.getByRole("button", { name: "Save title", exact: true }).isDisabled(),
        true,
      );
      await page.getByLabel("Draft title", { exact: true }).fill("Reviewed roof inspection");
      await page.evaluate(() => Reflect.get(window, "__siteDraftQA").conflict());
      await page.getByRole("button", { name: "Save title", exact: true }).click();
      await page
        .getByText(
          "This draft changed elsewhere. Load the latest draft, review it, then save your title again.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await page.getByLabel("Draft title", { exact: true }).inputValue(),
        "Reviewed roof inspection",
      );
      assert.equal(
        await page.getByRole("button", { name: "Save title", exact: true }).isDisabled(),
        true,
      );
      await page.evaluate(() => Reflect.get(window, "__siteDraftQA").failRead());
      await page.getByRole("button", { name: "Load latest draft", exact: true }).click();
      await page
        .getByText(
          "Could not load the private draft. Retry to check the latest copy. Your title text is retained.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await page.getByLabel("Draft title", { exact: true }).inputValue(),
        "Reviewed roof inspection",
      );
      assert.equal(
        await page.getByRole("button", { name: "Save title", exact: true }).isDisabled(),
        true,
      );
      await page.screenshot({ path: `${output}/${width}-refresh-failed.png`, fullPage: true });
      await page.getByRole("button", { name: "Load latest draft", exact: true }).click();
      await page
        .getByText("Latest draft loaded. Review before saving or discarding.", { exact: true })
        .waitFor();
      await page.getByRole("heading", { name: "Changed elsewhere", exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("Draft title", { exact: true }).inputValue(),
        "Reviewed roof inspection",
      );
      await page.getByRole("button", { name: "Save title", exact: true }).click();
      await page.getByRole("heading", { name: "Reviewed roof inspection", exact: true }).waitFor();
      assert.ok(
        await page.evaluate(() => window.document.documentElement.scrollWidth <= innerWidth),
      );
      await page.screenshot({ path: `${output}/${width}-title-controls.png`, fullPage: true });
      await page
        .getByRole("heading", { name: "Reviewed roof inspection", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/${width}-detail.png`, fullPage: true });
      await page.getByRole("button", { name: "Discard draft", exact: true }).click();
      await page.getByRole("button", { name: "Keep draft", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Discard draft", exact: true }).waitFor();
      await page.evaluate(() => Reflect.get(window, "__siteDraftQA").failDiscard());
      await page.getByRole("button", { name: "Discard draft", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Click again to discard Reviewed roof inspection",
          exact: true,
        })
        .click();
      await page
        .getByText(
          "Could not confirm discard. Load the latest draft and review it before retrying.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Discard draft", exact: true }).isDisabled(),
        true,
      );
      await page.getByRole("button", { name: "Load latest draft", exact: true }).click();
      await page
        .getByText("Latest draft loaded. Review before saving or discarding.", { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Discard draft", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Click again to discard Reviewed roof inspection",
          exact: true,
        })
        .click();
      await page.getByRole("heading", { name: "Site Studio", exact: true }).waitFor();
      await page.getByText("No drafts yet. Create the first one above.", { exact: true }).waitFor();
      await page
        .getByPlaceholder("Bookkeeping automation", { exact: true })
        .fill("Roof inspection");
      await page.getByPlaceholder("Home service owners", { exact: true }).fill("Property owners");
      await page
        .getByPlaceholder("The office runs while the crew builds", { exact: true })
        .fill("Review the report");
      await page.evaluate(() => Reflect.get(window, "__siteDraftQA").uncertainCreate());
      await page.getByRole("button", { name: "Create draft", exact: true }).click();
      await page
        .getByText(
          "Could not confirm draft creation. Refresh drafts to check for a saved copy before retrying.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Create draft", exact: true }).isDisabled(),
        true,
      );
      await page.getByRole("button", { name: "Refresh drafts", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("link", { name: initial.title, exact: true }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Create draft", exact: true }).isDisabled(),
        false,
      );
      await page.screenshot({ path: `${output}/${width}-create-recovered.png`, fullPage: true });
      for (const [route, expected] of [
        ["/docs/plugins/site-studio", "A failed refresh retains the preview and your text"],
        ["/docs/plugins/overview", "checking the list after an uncertain create"],
        ["/command-center", "Private workspace drafts retain typed titles"],
        ["/changelog", "Recover private page drafts without losing your title"],
      ] as const) {
        const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
        assert.equal(response?.status(), 200, route);
        await page.locator("main h1").waitFor({ state: "visible" });
        if (route.startsWith("/docs/")) {
          const figureImage = page.locator("main figure img").first();
          await figureImage.scrollIntoViewIfNeeded();
          await page.waitForFunction(
            (image) =>
              image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            await figureImage.elementHandle(),
            { timeout: 15_000 },
          );
          await page.locator("main h1").scrollIntoViewIfNeeded();
        }
        if (route === "/command-center") {
          await page
            .getByText("Browse and search the complete capability reference", { exact: true })
            .click();
          await page.getByLabel("Find a capability", { exact: true }).fill("Website pages");
          await page.getByText("Website pages", { exact: true }).click();
        }
        assert.ok((await page.locator("main").innerText()).includes(expected), route);
        assert.ok(
          await page.evaluate(() => window.document.documentElement.scrollWidth <= innerWidth),
          route,
        );
        if (route === "/docs/plugins/site-studio") {
          await page
            .getByRole("heading", {
              name: "Private workspace drafts and the fictional demo",
              exact: true,
            })
            .evaluate((element) =>
              window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 120),
            );
        }
        await page.screenshot({ path: `${output}/${width}-${route.replaceAll("/", "_")}.png` });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(
      "PASS: Site Studio shared admin Enter submission, locked creation, uncertain create refresh, stale title review, failed refresh retention, discard cancellation/recovery and responsive rendering at 1440/390, plus changed public guide, overview, feature and changelog rendering (controlled adapter).",
    );
  } catch (error) {
    if (activePage && !activePage.isClosed()) {
      await activePage.screenshot({ path: `${output}/failure.png`, fullPage: true });
      await writeFile(
        `${output}/failure.json`,
        JSON.stringify(
          { url: activePage.url(), text: await activePage.locator("body").innerText() },
          null,
          2,
        ),
      );
    }
    throw error;
  } finally {
    await browser?.close();
    if (server) {
      server.kill("SIGTERM");
      if (server.exitCode === null) await once(server, "exit");
    }
    await writeFile(`${output}/server.log`, log);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
