import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import {
  installHeroMotionObserver,
  hasPerceptibleHeroSequence,
  hasFreshHeroEntrance,
} from "./lib/hero-motion-observer.mjs";

const output = "/tmp/accelerate-hero-motion-observer";
await mkdir(output, { recursive: true });
const server = createServer((_request, response) => {
  response.setHeader("Content-Type", "text/html");
  response.end(`<!doctype html><html data-navigation-kind="fresh"><style>
    .home-hero.in .home-hero-eyebrow { animation: home-hero-label-enter 400ms both; }
    .home-hero.in .home-hero-word { animation: home-hero-word-enter 400ms 120ms both; }
    .home-hero-actions { opacity: 0; }
    @keyframes home-hero-label-enter { from { opacity: 0 } to { opacity: 1 } }
    @keyframes home-hero-word-enter { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: none } }
    </style><button id="home">Home</button><main></main></html>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
let status = "failed";
try {
  browser = await chromium.launch();
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport });
    const delayDelivery = () => {
      document.addEventListener("animationstart", (event) => {
        if (window.__blockHeroDelivery && event.target.matches(".home-hero-eyebrow")) {
          window.__blockHeroDelivery = false;
          const until = performance.now() + 240;
          while (performance.now() < until) {
            /* Fixture-only delayed event delivery. */
          }
        }
      });
    };
    // Playwright does not promise ordering between separate init scripts.
    await context.addInitScript({
      content: `(${delayDelivery.toString()})(); (${installHeroMotionObserver.toString()})();`,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const mode of [
      "delayed-read",
      "delayed-delivery",
      "collapsed",
      "misordered",
      "missing",
      "immediate",
      "stale",
    ]) {
      await page.goto(`${base}/services`);
      await page.evaluate((mode) => {
        window.__blockHeroDelivery = mode === "delayed-delivery";
        window.__heroForwardArmedAt = performance.now();
        document.querySelector("#home").onclick = () => {
          history.pushState({}, "", "/");
          document.querySelector("main").innerHTML =
            `<section class="home-hero"><p class="home-hero-eyebrow">Eyebrow</p><h1 class="home-hero-lead"><span class="home-hero-word">Headline</span></h1><div class="home-hero-actions">Book</div></section>`;
          const hero = document.querySelector(".home-hero");
          if (mode === "missing") hero.querySelector(".home-hero-word").style.animation = "none";
          if (mode === "immediate") hero.classList.add("reveal-immediate");
          if (mode === "collapsed")
            hero.querySelector(".home-hero-word").style.animationDelay = "0ms";
          if (mode === "misordered")
            hero.querySelector(".home-hero-word").style.animationDelay = "-60ms";
          hero.classList.add("in");
          // Resolve real CSS animation clocks before arranging observer delay.
          const animations = hero.getAnimations({ subtree: true });
          Promise.all(animations.map((animation) => animation.ready)).then(() => {
            if (mode === "stale") window.__heroForwardArmedAt = performance.now();
          });
        };
      }, mode);
      await page.locator("#home").click();
      // Deliberately read after every animation has finished. The entry captured
      // in the browser must survive a slow caller without accepting stale work.
      await page.waitForTimeout(750);
      const observation = await page.evaluate(() => ({
        phases: ["eyebrow", "lead"].map((phase) =>
          window.__heroEntrances.find((entry) => entry.phase === phase),
        ),
        entrance: window.__heroForward,
        late: document
          .querySelector(".home-hero-word")
          .getAnimations()
          .map((animation) => ({
            playState: animation.playState,
            currentTime: animation.currentTime,
            endTime: animation.effect.getComputedTiming().endTime,
          })),
      }));
      const sequence = hasPerceptibleHeroSequence(observation.phases);
      const fresh = hasFreshHeroEntrance(observation.entrance);
      if (["delayed-read", "delayed-delivery"].includes(mode)) {
        assert(sequence, `${label}/${mode}: actual stagger was lost`);
        assert(fresh, `${label}/${mode}: captured fresh entrance was lost`);
        assert.equal(
          observation.late[0].playState,
          "finished",
          "Fixture must reproduce a late settled read",
        );
        if (mode === "delayed-delivery") {
          const gap = observation.phases[1].observedAt - observation.phases[0].observedAt;
          assert(gap < 30, `Fixture must reproduce bunched event delivery, got ${gap}ms`);
        }
      } else if (["collapsed", "misordered", "missing"].includes(mode)) {
        assert.equal(sequence, false, `${label}/${mode}: genuine sequence defect was accepted`);
        if (mode === "missing") assert.equal(fresh, false, "Absent entrance was accepted");
      } else {
        assert.equal(fresh, false, `${label}/${mode}: immediate or stale entrance was accepted`);
      }
      results.push({ label, mode, sequence, fresh, ...observation });
    }
    assert.deepEqual(errors, [], `${label}: browser errors`);
    await context.close();
  }
  assert.equal(hasPerceptibleHeroSequence([]), false);
  assert.equal(hasFreshHeroEntrance(null), false);
  status = "passed";
  console.log(JSON.stringify({ status: "passed", scenarios: results.length }));
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ status, results }, null, 2) + "\n");
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
