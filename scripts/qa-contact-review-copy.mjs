import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3047";
const output = "/tmp/accelerate-contact-review";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    for (const mode of ["empty", "populated", "error"]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: width === 390 ? "reduce" : "no-preference",
      });
      await context.addInitScript(
        ({ mode }) => {
          window.reviewFixtureMode = mode;
          const browserFetch = window.fetch.bind(window);
          let underlyingFetch = browserFetch;
          const fixtureFetch = async (input, init) => {
            const path = String(input instanceof Request ? input.url : input);
            if (!new URL(path, location.origin).pathname.startsWith("/api/"))
              return browserFetch(input, init);
            if (path.includes("/api/admin/revenue-os/pipeline"))
              return Response.json({ schemaReady: false, opportunities: [] });
            if (!path.includes("/api/admin/revenue-os/identity-review"))
              return underlyingFetch(input, init);
            await new Promise((resolve) => setTimeout(resolve, 350));
            if (window.reviewFixtureMode === "error")
              return Response.json(
                { error: 'relation "private_table" does not exist' },
                { status: 500 },
              );
            if (init?.method === "POST") {
              window.reviewDecision = JSON.parse(init.body);
              window.reviewFixtureMode = "empty";
              return Response.json({ success: true });
            }
            return Response.json({
              contract: "revenue-os-identity-review.v1",
              items:
                window.reviewFixtureMode === "empty"
                  ? []
                  : [
                      {
                        contract: "revenue-os-identity-review.v1",
                        actionId: "fictional-review",
                        participantEmail: "jordan@customer.example",
                        reason: "ambiguous",
                        source: "Gmail",
                        conversationId: "fictional-conversation",
                        threadId: null,
                        createdAt: new Date().toISOString(),
                        candidates: [
                          {
                            id: "fictional-contact",
                            full_name: "Jordan Mitchell",
                            primary_email: "jordan@customer.example",
                            company_id: null,
                            company_name: null,
                          },
                        ],
                        evidence: [
                          {
                            strength: "Possible match",
                            observation: "The sender name matches this contact.",
                            source: "Gmail",
                          },
                        ],
                        downstream: {
                          conversationSubject: "Roof inspection",
                          conversationStatus: "open",
                          contactId: null,
                          companyId: null,
                          opportunityId: null,
                        },
                      },
                    ],
            });
          };
          Object.defineProperty(window, "fetch", {
            configurable: true,
            get: () => fixtureFetch,
            set: (value) => {
              underlyingFetch = value;
            },
          });
        },
        { mode },
      );
      const page = await context.newPage();
      const errors = [],
        protectedRequests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (new URL(r.url()).pathname.startsWith("/api/admin")) protectedRequests.push(r.url());
      });
      await page.goto(`${base}/demo/command-center/northline-roofing/identity-review`, {
        waitUntil: "networkidle",
      });
      await page.getByRole("heading", { name: "Contact review", exact: true }).waitFor();
      if (mode === "empty")
        await page.getByText("No contacts need review", { exact: true }).waitFor();
      if (mode === "populated") {
        await page.getByRole("heading", { name: "Suggested contacts" }).waitFor();
        const match = page.getByRole("button", { name: "Match selected contact" });
        assert.equal(await match.isDisabled(), true);
        await page.getByRole("radio").focus();
        await page.keyboard.press("Space");
        assert.equal(await match.isEnabled(), true);
      }
      if (mode === "error") {
        await page
          .getByText("We couldn’t load contacts that need review. Try again in a moment.", {
            exact: false,
          })
          .waitFor();
        assert.equal(await page.getByText("No contacts need review", { exact: true }).count(), 0);
        assert.equal(
          (await page.locator(".admin-main").innerText()).includes("private_table"),
          false,
        );
      }
      assert.equal((await page.locator(".admin-main").innerText()).includes("migration"), false);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      await page.screenshot({ path: `${output}/${width}-${mode}.png`, fullPage: true });
      if (mode === "populated") {
        await page.getByRole("button", { name: "Match selected contact" }).click();
        await page.getByText("No contacts need review", { exact: true }).waitFor();
        assert.equal(
          (await page.evaluate(() => window.reviewDecision)).contactId,
          "fictional-contact",
        );
      }
      if (mode === "error") {
        await page.evaluate(() => (window.reviewFixtureMode = "empty"));
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await page.getByText("No contacts need review", { exact: true }).waitFor();
      }
      if (mode === "empty") {
        await page.evaluate(() => {
          window.reviewFixtureMode = "setup";
        });
        await page.getByRole("link", { name: "Pipeline", exact: true }).first().click();
        await page.getByRole("heading", { name: "This feature needs setup" }).waitFor();
        const copy = await page.locator(".admin-main").innerText();
        assert.ok(copy.includes("Open Setup Center to see what’s missing"));
        assert.equal(/migration|idempotent|\.sql/.test(copy), false);
        await page.screenshot({ path: `${output}/${width}-setup.png`, fullPage: true });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(protectedRequests, []);
      results.push({ width, mode, result: "passed" });
      await context.close();
    }
  }
  writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "PASS: contact-review empty, populated, error/retry, keyboard matching, no technical warning, responsive layout and protected-request isolation.",
  );
} finally {
  await browser.close();
}
