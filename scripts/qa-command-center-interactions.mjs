import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045";
const output = process.env.QA_OUTPUT || "/tmp/accelerate-command-interactions";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const route = (path) => `${base}/demo/command-center/northline-roofing/${path}`;
try {
  for (const width of [1440, 390]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion,
      });
      await context.addInitScript(() => {
        window.__qa = {
          clientFailure: location.search.includes("qaClientFailure"),
          timelineFailure: true,
          searchFailure: true,
          slowStarted: false,
          taskDelayId: null,
          taskFailure: true,
          frames: [],
          panels: [],
        };
        let handler = window.fetch;
        Object.defineProperty(window, "fetch", {
          configurable: true,
          get: () => {
            const current = handler;
            return async (input, init) => {
              const url = new URL(
                input instanceof Request ? input.url : String(input),
                location.href,
              );
              const json = (body, status = 200) =>
                new Response(JSON.stringify(body), {
                  status,
                  headers: { "content-type": "application/json" },
                });
              if (
                url.pathname === "/api/admin/clients" &&
                (!init?.method || init.method === "GET") &&
                url.searchParams.has("id")
              ) {
                if (url.searchParams.get("id") === "missing-client") return json({ client: null });
                if (url.searchParams.get("id") === "missing-client-404")
                  return json({ error: "Client not found" }, 404);
                if (window.__qa.clientFailure)
                  return json({ error: "Client temporarily unavailable" }, 503);
              }
              if (
                url.pathname === "/api/admin/tasks" &&
                window.__qa.taskDelayId &&
                url.searchParams.get("id") === window.__qa.taskDelayId
              ) {
                await new Promise((resolve) => setTimeout(resolve, 600));
                if (window.__qa.taskFailure)
                  return json({ error: "Task detail temporarily unavailable" }, 503);
              }
              if (url.pathname === "/api/admin/contacts/timeline" && window.__qa.timelineFailure)
                return json({ error: "Activity temporarily unavailable" }, 503);
              if (url.pathname === "/api/admin/search") {
                const query = url.searchParams.get("q");
                if (query === "slow") {
                  window.__qa.slowStarted = true;
                  // Deliberately ignore AbortSignal: late results must still be invalidated.
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  return json({
                    results: [
                      {
                        name: "Stale fictional match",
                        email: "stale@example.example",
                        type: "Contact",
                      },
                    ],
                  });
                }
                if (query === "fresh")
                  return json({
                    results: [
                      {
                        name: "Fresh fictional match",
                        email: "fresh@example.example",
                        type: "Contact",
                      },
                    ],
                  });
                if (window.__qa.searchFailure)
                  return json({ error: "Search temporarily unavailable" }, 503);
              }
              return current.call(window, input, init);
            };
          },
          set: (next) => {
            handler = next;
          },
        });
      });
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(120000);
      page.setDefaultTimeout(30000);
      const errors = [],
        protectedRequests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          /^\/api\/(admin|demo\/agent)(\/|$)/.test(url.pathname) ||
          ["api.stripe.com", "openrouter.ai"].includes(url.hostname)
        )
          protectedRequests.push(request.url());
      });
      await page.goto(route("clients"));
      await page.getByLabel("Search clients", { exact: true }).waitFor();
      const client = await page.evaluate(
        async () => (await (await fetch("/api/admin/clients")).json()).clients[0],
      );
      assert(client?.id, "fictional client exists");
      await page.goto(`${route(`clients/${client.id}`)}?qaClientFailure=1`);
      await page
        .getByRole("heading", { name: "We couldn’t load this information", exact: true })
        .waitFor();
      assert.equal(
        await page.getByRole("heading", { name: "Client not found", exact: true }).count(),
        0,
      );
      await page.screenshot({
        path: `${output}/client-error-${width}-${reducedMotion}.png`,
        style: "nextjs-portal{visibility:hidden}",
      });
      await page.evaluate(() => {
        window.__qa.clientFailure = false;
      });
      await page.getByRole("button", { name: "Retry", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("heading", { name: client.business_name, exact: true }).waitFor();
      const activity = page.getByRole("region", { name: "Client activity", exact: true });
      await activity
        .getByRole("heading", { name: "We couldn’t load this information", exact: true })
        .waitFor();
      assert.equal(
        await activity.getByText("No interactions found for this contact", { exact: true }).count(),
        0,
      );
      await page.evaluate(() => {
        window.__qa.timelineFailure = false;
      });
      await activity.getByRole("button", { name: "Retry", exact: true }).click();
      await activity.locator("[data-contact-timeline-item]").first().waitFor();
      const firstEvent = await activity.locator("[data-contact-timeline-item]").first().innerText();
      await page.evaluate(() => {
        window.__qa.timelineFailure = true;
      });
      await page.getByRole("button", { name: /Save Changes/i }).click();
      await activity.getByText("Showing previously loaded information", { exact: true }).waitFor();
      assert.equal(
        await activity.locator("[data-contact-timeline-item]").first().innerText(),
        firstEvent,
      );
      await page.evaluate(() => {
        window.__qa.clientFailure = true;
      });
      await page.getByRole("button", { name: "Refresh client", exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('[role="alert"]').length >= 2);
      assert(
        await page.getByRole("heading", { name: client.business_name, exact: true }).isVisible(),
      );
      await page.screenshot({
        path: `${output}/client-retained-${width}-${reducedMotion}.png`,
        style: "nextjs-portal{visibility:hidden}",
      });
      await page.evaluate(() => {
        window.__qa.clientFailure = false;
        window.__qa.timelineFailure = false;
      });
      await page.getByRole("button", { name: "Refresh client", exact: true }).click();
      await page.waitForFunction(
        () =>
          ![...document.querySelectorAll("p")].some(
            (element) => element.textContent === "Showing previously loaded information",
          ),
      );
      for (const missing of ["missing-client", "missing-client-404"]) {
        await page.goto(route(`clients/${missing}`));
        await page.getByRole("heading", { name: "Client not found", exact: true }).waitFor();
        assert.equal(
          await page
            .getByRole("heading", { name: "We couldn’t load this information", exact: true })
            .count(),
          0,
        );
      }
      await page.goto(route("ai"));
      const views = page.getByRole("group", { name: "AI workspace views", exact: true });
      await views.waitFor();
      // Start recording before interaction; a host round trip can miss a short transition.
      await page.evaluate(() => {
        const sample = () => {
          for (const group of document.querySelectorAll(".admin-view-switcher")) {
            const selected = group.querySelector('[aria-pressed="true"]');
            const marker = group.querySelector("[data-admin-view-selection]");
            if (selected && marker)
              window.__qa.frames.push({
                label: selected.getAttribute("aria-label"),
                delta: marker.getBoundingClientRect().x - selected.getBoundingClientRect().x,
              });
          }
          const panel = document.querySelector("[data-admin-view-panel]");
          if (panel)
            window.__qa.panels.push({
              key: panel.dataset.adminViewPanel,
              opacity: Number(getComputedStyle(panel).opacity),
              animation: getComputedStyle(panel).animationName,
            });
          if (window.__qa.frames.length < 1000) window.__qa.frame = requestAnimationFrame(sample);
        };
        sample();
      });
      const draft = page.locator("main textarea").last();
      await draft.fill("Prepare a fictional follow-up, without sending it.");
      await views.getByRole("button", { name: "Run history", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.locator('[data-admin-view-panel="runs"]').waitFor();
      await page.waitForTimeout(400);
      await views.getByRole("button", { name: "Capabilities", exact: true }).click();
      await page.locator('[data-admin-view-panel="capabilities"]').waitFor();
      await views.getByRole("button", { name: "Ask", exact: true }).click();
      await page.locator('[data-admin-view-panel="ask"]').waitFor();
      assert.equal(
        await page.locator("main textarea").last().inputValue(),
        "Prepare a fictional follow-up, without sending it.",
      );
      const motion = await page.evaluate(() => ({
        frames: window.__qa.frames,
        panels: window.__qa.panels,
      }));
      const moved = motion.frames.some(
        (frame) => frame.label === "Run history" && Math.abs(frame.delta) > 10,
      );
      assert.equal(
        moved,
        reducedMotion === "no-preference",
        "selection must visibly travel only with motion enabled",
      );
      assert(
        motion.panels.some(
          (panel) =>
            panel.key === "runs" &&
            (reducedMotion === "reduce"
              ? panel.animation === "none"
              : panel.animation === "admin-route-section-in" && panel.opacity < 1),
        ),
        "view content uses the shared entrance and reduced-motion behavior",
      );
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `${output}/ai-views-${width}-${reducedMotion}.png`,
        style: "nextjs-portal{visibility:hidden}",
      });
      await page.keyboard.press("ControlOrMeta+k");
      const search = page.getByPlaceholder("Search records, pages, or run a command…");
      await search.fill("invoice");
      await page.getByText("Workspace search couldn’t load. Try again.", { exact: true }).waitFor();
      assert.equal(
        await page.getByText("No matching records, pages, or commands.", { exact: true }).count(),
        0,
      );
      assert(
        (await page
          .getByRole("dialog")
          .getByRole("option", { name: /invoice/i })
          .count()) > 0,
        "local actions remain available after remote failure",
      );
      await page.screenshot({
        path: `${output}/search-error-${width}-${reducedMotion}.png`,
        style: "nextjs-portal{visibility:hidden}",
      });
      await page.evaluate(() => {
        window.__qa.searchFailure = false;
      });
      await page.getByRole("button", { name: "Retry search", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page
        .getByText("Workspace search couldn’t load. Try again.", { exact: true })
        .waitFor({ state: "hidden" });
      assert(
        await search.evaluate((element) => element === document.activeElement),
        "retry restores input focus",
      );
      await search.fill("slow");
      await page.waitForFunction(() => window.__qa.slowStarted);
      await search.fill("fresh");
      await page.getByText("Fresh fictional match", { exact: true }).waitFor();
      await page.waitForTimeout(1100);
      assert.equal(await page.getByText("Stale fictional match", { exact: true }).count(), 0);
      // Search actual scenario records, then open each record through its owned detail link.
      const records = await page.evaluate(async () => {
        const read = async (path) => await (await fetch(path)).json();
        const tasks = await read("/api/admin/tasks");
        const pipeline = await read("/api/admin/revenue-os/pipeline");
        const clients = await read("/api/admin/clients");
        const proposals = await read("/api/admin/proposals");
        return [
          {
            kind: "Work",
            label: tasks.tasks[0].title,
            id: tasks.tasks[0].id,
            href: `/work?task=${tasks.tasks[0].id}`,
          },
          {
            kind: "Work",
            label: tasks.tasks[1].title,
            id: tasks.tasks[1].id,
            href: `/work?task=${tasks.tasks[1].id}`,
            repeatTask: true,
          },
          {
            kind: "Opportunities",
            label: pipeline.opportunities[0].name,
            id: pipeline.opportunities[0].id,
            href: `/pipeline/${pipeline.opportunities[0].id}`,
          },
          {
            kind: "Clients",
            label: clients.clients[0].business_name,
            id: clients.clients[0].id,
            href: `/clients/${clients.clients[0].id}`,
          },
          {
            kind: "Proposals",
            label: proposals.proposals[0].title,
            id: proposals.proposals[0].id,
            href: `/proposals?proposal=${proposals.proposals[0].id}`,
          },
        ];
      });
      for (const record of records) {
        if (record.repeatTask)
          await page.evaluate((id) => {
            window.__qa.taskDelayId = id;
          }, record.id);
        const input = page.getByRole("combobox", { name: "Search workspace" });
        if (!(await input.count())) await page.keyboard.press("Control+k");
        await input.fill(record.label);
        const group = page.getByRole("group", { name: record.kind, exact: true });
        const option = group
          .getByRole("option")
          .filter({ has: page.getByText(record.label, { exact: true }) })
          .first();
        await option.waitFor();
        for (
          let step = 0;
          step < 40 && (await option.getAttribute("aria-selected")) !== "true";
          step++
        )
          await input.press("ArrowDown");
        assert.equal(
          await option.getAttribute("aria-selected"),
          "true",
          "keyboard reaches the desired group",
        );
        assert.equal(
          await input.getAttribute("aria-activedescendant"),
          await option.getAttribute("id"),
        );
        const bounds = await option.boundingBox();
        assert(
          bounds && bounds.y >= 0 && bounds.y + bounds.height <= (width === 390 ? 844 : 1000),
          "selected result stays in view",
        );
        await page.waitForTimeout(150); // Let the 100ms selected-row color transition settle.
        await page.screenshot({
          path: `${output}/record-search-${record.kind.toLowerCase()}-${width}-${reducedMotion}.png`,
          style: "nextjs-portal{visibility:hidden}",
        });
        await input.press("Enter");
        await page.waitForURL((url) => `${url.pathname}${url.search}`.endsWith(record.href));
        await page
          .getByRole("dialog", { name: "Admin command palette" })
          .waitFor({ state: "hidden" });
        if (record.kind === "Work") {
          const details = page.getByRole("dialog", { name: "Task details", exact: true });
          await details.waitFor();
          if (record.repeatTask) {
            const alert = details
              .getByRole("alert")
              .filter({ hasText: "We couldn’t load this information" });
            await alert.waitFor();
            assert(await details.isVisible(), "task recovery keeps the requested inspector open");
            assert.equal(await details.getByLabel("Title", { exact: true }).count(), 0);
            await page.evaluate(() => {
              window.__qa.taskFailure = false;
            });
            await alert.getByRole("button", { name: "Retry", exact: true }).click();
          }
          assert.equal(
            await details.getByLabel("Title", { exact: true }).inputValue(),
            record.label,
          );
          await details.getByRole("button", { name: "Close task", exact: true }).click();
        } else {
          await page.getByRole("heading", { name: record.label, exact: true }).waitFor();
        }
        if (record.kind === "Proposals") {
          await page.getByRole("heading", { name: record.label, exact: true }).waitFor();
          // A selected proposal remains reachable when its status is excluded from the list.
          await page.getByLabel("Filter by status").selectOption("declined");
          await page.getByText("No proposals match this filter.", { exact: true }).waitFor();
          await page.getByRole("heading", { name: record.label, exact: true }).waitFor();
          await page.screenshot({
            path: `${output}/proposal-empty-filter-${width}-${reducedMotion}.png`,
            style: "nextjs-portal{visibility:hidden}",
          });
        }
      }
      await page.keyboard.press("Control+k");
      await search.fill("zzzx-no-fixture-match");
      await page.getByText("No matching records, pages, or commands.", { exact: true }).waitFor();
      await search.fill("zx");
      await page
        .getByText("Type at least 3 characters to search workspace records.", { exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      await page.goto(route("content"));
      const board = page.getByRole("group", { name: "Board view", exact: true });
      await board.waitFor();
      await board.getByRole("button", { name: "List", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.locator('[data-admin-view-panel="list"]').waitFor();
      await board.getByRole("button", { name: "Board", exact: true }).click();
      await page.locator('[data-admin-view-panel="board"]').waitFor();
      await page.screenshot({
        path: `${output}/content-view-${width}-${reducedMotion}.png`,
        style: "nextjs-portal{visibility:hidden}",
      });
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
        "no horizontal overflow",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(
        protectedRequests,
        [],
        "fictional browser checks must never contact protected APIs or providers",
      );
      results.push({
        width,
        reducedMotion,
        clientRecovery: "passed",
        retainedActivity: "passed",
        searchRecoveryAndRace: "passed",
        recordDetailNavigation: "passed: work, opportunities, clients, proposals",
        taskDetailCacheAndRecovery: "passed",
        selectionMotion: moved,
        panels: "passed",
        retainedAIDraft: "passed",
        keyboard: "passed",
        protectedRequests: 0,
      });
      console.log(`Command Center ${width}/${reducedMotion} passed`);
      await context.close();
    }
  }
  await writeFile(`${output}/receipt.json`, JSON.stringify({ status: "passed", results }, null, 2));
} finally {
  await browser.close();
}
