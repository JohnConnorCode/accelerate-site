import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";

export function hostedReleaseConfig() {
  const fullSha = process.env.QA_EXPECTED_RELEASE_SHA || "";
  assert.match(fullSha, /^[0-9a-f]{40}$/, "Supply the full released main SHA");
  const target = new URL(process.env.HERO_QA_TARGET_URL || "");
  assert.ok(
    target.origin === "https://www.acceleratewith.us" &&
      target.pathname === "/" &&
      !target.search &&
      !target.hash &&
      !target.username &&
      !target.password &&
      !target.port,
    "Use the exact canonical Accelerate homepage URL",
  );
  return { fullSha, deploymentId: fullSha.slice(0, 12), origin: target.origin };
}

// Optional for ordinary local admin QA; required by the hosted wrapper.
export function observeHostedRelease(context, label, receiptPath) {
  if (!process.env.QA_EXPECTED_RELEASE_SHA) return { finish: async () => {} };
  const expected = hostedReleaseConfig();
  const assets = new Map();
  context.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== expected.origin || !url.pathname.startsWith("/_next/")) return;
    const deploymentId = url.searchParams.get("dpl");
    if (!deploymentId && !/\/static\/.*\.(?:js|css)$/.test(url.pathname)) return;
    assets.set(url.href, { url: url.href, deploymentId, status: response.status() });
  });
  return {
    async finish() {
      const loaded = [...assets.values()].sort((a, b) => a.url.localeCompare(b.url));
      const failures = loaded.filter(
        (asset) => asset.deploymentId !== expected.deploymentId || asset.status >= 400,
      );
      await writeFile(
        receiptPath,
        JSON.stringify({ label, ...expected, loaded, failures }, null, 2),
      );
      assert.ok(loaded.length, `${label}: no versioned Next assets observed`);
      assert.deepEqual(failures, [], `${label}: loaded assets differ from the released main SHA`);
    },
  };
}

async function settleWorkshop(page) {
  await page.locator("#workshop-heading").waitFor();
  await page.locator("footer").waitFor({ state: "attached" });
  await page.evaluate(() => document.fonts.ready);
  const tour = [];
  for (let step = 0; step < 200; step++) {
    const position = await page.evaluate(() => {
      const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      return { y: scrollY, max, next: Math.min(max, scrollY + innerHeight * 0.65) };
    });
    tour.push(position);
    if (position.y >= position.max - 1) break;
    assert.ok(step < 199, "Workshop document exceeded the bounded scroll tour");
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), position.next);
    await page.waitForTimeout(100);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  }
  // Inspect the entire body. Footer reveal owners are outside main.
  await page.waitForFunction(() => {
    const owners = [...document.querySelectorAll("body [data-reveal-state]")];
    const sections = [...document.querySelectorAll("footer [data-footer-section]")];
    const opaqueAncestors = (element) => {
      for (let node = element; node; node = node.parentElement)
        if (Number(getComputedStyle(node).opacity) < 0.999) return false;
      return true;
    };
    return (
      owners.length > 0 &&
      owners.every((owner) => owner.dataset.revealState === "visible" && opaqueAncestors(owner)) &&
      sections.length >= 6 &&
      sections.every(opaqueAncestors)
    );
  });
  await page.waitForFunction(() =>
    [...document.images].every(
      (image) => !image.getClientRects().length || (image.complete && image.naturalWidth > 0),
    ),
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForFunction(() => {
    const header = document.querySelector(".site-header");
    const logo = header?.querySelector(".logo-link");
    const owners = [...document.querySelectorAll("body [data-reveal-state]")];
    const sections = [...document.querySelectorAll("footer [data-footer-section]")];
    const opaqueAncestors = (element) => {
      for (let node = element; node; node = node.parentElement)
        if (Number(getComputedStyle(node).opacity) < 0.999) return false;
      return true;
    };
    const finiteMovement = document
      .getAnimations()
      .some(
        (animation) =>
          Number.isFinite(animation.effect?.getComputedTiming().endTime) &&
          (animation.pending || !["finished", "idle"].includes(animation.playState)),
      );
    return (
      scrollY === 0 &&
      header &&
      !header.classList.contains("is-scrolled") &&
      logo &&
      opaqueAncestors(logo) &&
      !finiteMovement &&
      owners.every((owner) => owner.dataset.revealState === "visible" && opaqueAncestors(owner)) &&
      sections.length >= 6 &&
      sections.every(opaqueAncestors)
    );
  });
  const settled = await page.evaluate(async () => {
    const logo = document.querySelector(".site-header .logo-link");
    const before = logo.getBoundingClientRect().toJSON();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const after = logo.getBoundingClientRect().toJSON();
    const stable = ["x", "y", "width", "height"].every(
      (key) => Math.abs(before[key] - after[key]) < 0.1,
    );
    return {
      scrollY,
      stableLogo: stable,
      logo: after,
      headerScrolled: document.querySelector(".site-header").classList.contains("is-scrolled"),
      owners: [...document.querySelectorAll("body [data-reveal-state]")].map((owner) => ({
        tag: owner.tagName,
        state: owner.dataset.revealState,
        opacity: getComputedStyle(owner).opacity,
      })),
      footerSections: [...document.querySelectorAll("footer [data-footer-section]")].map(
        (section) => ({
          opacity: getComputedStyle(section).opacity,
          text: section.textContent.trim().slice(0, 80),
        }),
      ),
      finiteMovement: document
        .getAnimations()
        .filter(
          (animation) =>
            Number.isFinite(animation.effect?.getComputedTiming().endTime) &&
            (animation.pending || !["finished", "idle"].includes(animation.playState)),
        ).length,
    };
  });
  assert.ok(settled.stableLogo, "Header logo moved during the final settled frames");
  assert.equal(settled.finiteMovement, 0);
  return { tour, ...settled };
}

async function runAdmin(origin, output) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/qa-admin-polish.mjs"], {
      env: { ...process.env, PLAYWRIGHT_BASE_URL: origin, QA_OUTPUT: output, QA_THEME: "" },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ exitCode: code, signal }));
  });
}

async function main() {
  const expected = hostedReleaseConfig();
  const output = process.env.HOSTED_RELEASE_QA_OUTPUT || "/tmp/accelerate-hosted-release";
  const workshopOutput = `${output}/workshop`;
  const adminOutput = `${output}/admin`;
  await mkdir(workshopOutput, { recursive: true });
  await mkdir(adminOutput, { recursive: true });
  // Read the released content definition. No database fixture or checkout action.
  const { WORKSHOP_EVENT } = await import("../src/content/workshops.ts");
  const path = `/events/${WORKSHOP_EVENT.slug}`;
  const browser = await chromium.launch({ headless: true });
  const cases = [],
    failures = [];
  try {
    for (const width of [1440, 390])
      for (const theme of ["light", "dark"]) {
        const label = `${theme}-${width}`;
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          colorScheme: theme,
          reducedMotion: "no-preference",
        });
        await context.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
        const release = observeHostedRelease(
          context,
          label,
          `${workshopOutput}/${label}-assets.json`,
        );
        const page = await context.newPage();
        page.setDefaultTimeout(30_000);
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const result = { label, width, theme, path };
        try {
          const response = await page.goto(expected.origin + path, {
            waitUntil: "domcontentloaded",
          });
          assert.equal(response.status(), 200, "Hosted workshop must be publicly available");
          assert.equal(new URL(page.url()).pathname, path);
          result.settled = await settleWorkshop(page);
          assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
          assert.deepEqual(errors, [], `${label}: workshop runtime errors`);
          await release.finish();
          const image = `${workshopOutput}/workshop-${label}.png`;
          await page.screenshot({ path: image, fullPage: true, caret: "hide" });
          await release.finish();
          result.image = image;
          result.sha256 = createHash("sha256")
            .update(await readFile(image))
            .digest("hex");
          result.status = "passed";
        } catch (error) {
          result.status = "failed";
          result.error = error.stack || String(error);
          failures.push(`${label}: ${error.message}`);
          await page
            .screenshot({ path: `${workshopOutput}/workshop-${label}-failure.png`, fullPage: true })
            .catch(() => {});
          await release.finish().catch((error) => {
            result.assetError = error.message;
          });
        } finally {
          await context.close();
          cases.push(result);
          await writeFile(`${workshopOutput}/${label}.json`, JSON.stringify(result, null, 2));
        }
      }
  } finally {
    await browser.close();
  }
  const admin = await runAdmin(expected.origin, adminOutput);
  if (admin.exitCode !== 0)
    failures.push(
      `Existing admin polish suite exited ${admin.exitCode} (${admin.signal || "no signal"})`,
    );
  if (admin.exitCode === 0) {
    try {
      const themes = JSON.parse(
        await readFile(new URL("../src/lib/admin/themes.json", import.meta.url), "utf8"),
      );
      const adminResults = JSON.parse(await readFile(`${adminOutput}/results.json`, "utf8"));
      assert.equal(themes.length, 4, "The hosted review requires four workspace modes");
      assert.deepEqual(
        adminResults.map((result) => result.theme).sort(),
        themes.map((theme) => theme.id).sort(),
      );
      admin.images = [];
      for (const theme of themes)
        for (const device of ["desktop", "mobile"]) {
          const image = `${adminOutput}/${theme.id}-${device}.png`;
          admin.images.push({
            theme: theme.id,
            device,
            image,
            sha256: createHash("sha256")
              .update(await readFile(image))
              .digest("hex"),
          });
        }
    } catch (error) {
      admin.evidenceError = error.message;
      failures.push(`Admin evidence: ${error.message}`);
    }
  }
  const summary = { ...expected, cases, admin, failures, readOnly: true, providerFixtures: false };
  await writeFile(`${output}/results.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  assert.deepEqual(
    failures,
    [],
    "Hosted release review must pass every capture and the existing admin suite",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
