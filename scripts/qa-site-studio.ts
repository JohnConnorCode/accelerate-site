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
                return reply({ draft: record }, 201);
              }
              if (method === "PATCH") {
                const value = JSON.parse(String(init?.body));
                if (!record || value.expectedChecksum !== record.checksum)
                  return reply({ error: "Draft changed; reload" }, 409);
                record = {
                  ...record,
                  title: value.patches[0].title,
                  checksum: "b".repeat(64),
                  version: record.version + 1,
                };
                return reply({ draft: record });
              }
              if (method === "DELETE") {
                if (new Headers(init?.headers).get("if-match") !== record?.checksum)
                  return reply({ error: "Stale discard" }, 409);
                record = null;
                return reply({ discarded: true });
              }
              if (url.pathname === "/api/admin/site/drafts")
                return reply({ drafts: record ? [record] : [] });
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
      await page.screenshot({ path: `${output}/${width}-create.png`, fullPage: true });
      await page.getByRole("button", { name: "Create draft", exact: true }).click();
      await page.getByRole("heading", { name: "Rename draft", exact: true }).waitFor();
      assert.match(page.url(), /\/demo\/command-center\/superdebate\/site\//);
      await page.getByLabel("Draft title", { exact: true }).fill("Reviewed roof inspection");
      await page.getByRole("button", { name: "Save title", exact: true }).click();
      await page.getByRole("heading", { name: "Reviewed roof inspection", exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/${width}-detail.png`, fullPage: true });
      await page.getByRole("button", { name: "Discard draft", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Click again to discard Reviewed roof inspection",
          exact: true,
        })
        .click();
      await page.getByRole("heading", { name: "Site Studio", exact: true }).waitFor();
      await page.getByText("No drafts yet. Create the first one above.", { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(
      "PASS: Site Studio shared admin create, scoped navigation, rename, checksum-bound discard and responsive rendering at 1440/390 (controlled adapter).",
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
