import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";

// Exercise the real React owners with a controlled router. Holding frames makes
// early operator interaction deterministic; normal browser frames run the exit.
// qa-invoice-navigation separately verifies the full compiled Next.js journey.
const output = process.env.QA_OUTPUT_DIR || "/tmp/accelerate-admin-focus-handoff";
mkdirSync(output, { recursive: true });
const owners = [
  "src/components/navigation/NavigationRuntime.tsx",
  "src/components/admin/AdminDialog.tsx",
];
const baseline = process.env.QA_FOCUS_BASELINE_REF;
const results = [];
const errors = [];
const escaped = [];
let passed = false;

async function bundle(ref) {
  const sources = new Map(
    ref
      ? owners.map((path) => [
          resolve(path),
          execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" }),
        ])
      : [],
  );
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `
        import React, {useState, useLayoutEffect} from 'react';
        import {createRoot} from 'react-dom/client';
        import {MotionConfig} from 'framer-motion';
        import {usePathname} from 'next/navigation';
        import {NavigationRuntime, useAppNavigation, useNavigationRuntime} from './src/components/navigation/NavigationRuntime';
        import {AdminDialog} from './src/components/admin/AdminDialog';
        function Workspace() {
          const route = usePathname(), navigation = useAppNavigation();
          const {registerAdminScroller} = useNavigationRuntime();
          const [palette, setPalette] = useState(false), [parent, setParent] = useState(false), [child, setChild] = useState(false);
          const [revision, setRevision] = useState(0), [value, setValue] = useState('');
          useLayoutEffect(() => { window.__qa = {
            navigate() { setPalette(false); navigation.push('/admin/invoicing'); },
            replaceHeading() { setRevision(r => r + 1); },
            closePalette() { setPalette(false); },
            closeChild() { setChild(false); },
            closeParent() { setParent(false); }
          }; });
          return <>
            <nav><button id="opener" onClick={() => setPalette(true)}>Search</button><button id="navigate" onClick={() => navigation.push('/admin/invoicing')}>Navigate</button><button id="parent-opener" onClick={() => setParent(true)}>Open editor</button></nav>
            <main ref={registerAdminScroller} tabIndex={-1} style={{padding: 24}}>
              <h1 key={route + revision} id={'heading-' + revision}>{route.endsWith('invoicing') ? 'Connect your Stripe account' : 'Today'}</h1>
              {route.endsWith('invoicing') && <><label htmlFor="stripe-key">Stripe API key</label><input id="stripe-key" value={value} onChange={e => setValue(e.target.value)} /></>}
            </main>
            <AdminDialog open={palette} onClose={() => setPalette(false)} title="Admin command palette"><input aria-label="Search commands" data-admin-autofocus="true" /><button onClick={() => window.__qa.navigate()}>Create invoice</button></AdminDialog>
            <AdminDialog open={parent} onClose={() => setParent(false)} title="Editor"><input aria-label="Editor name" data-admin-autofocus="true" /><button id="child-opener" onClick={() => setChild(true)}>Review</button><button onClick={() => setParent(false)}>Close editor</button></AdminDialog>
            <AdminDialog open={child} onClose={() => setChild(false)} title="Review"><input aria-label="Review note" data-admin-autofocus="true" /><button onClick={() => setChild(false)}>Close review</button></AdminDialog>
          </>;
        }
        createRoot(document.getElementById('root')).render(<MotionConfig reducedMotion="user"><NavigationRuntime><Workspace /></NavigationRuntime></MotionConfig>);
      `,
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "controlled-router-and-baseline",
        setup(build) {
          build.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "next/navigation",
            namespace: "controlled-router",
          }));
          build.onLoad({ filter: /.*/, namespace: "controlled-router" }, () => ({
            resolveDir: process.cwd(),
            contents: `import {useSyncExternalStore} from 'react';
              const subscribe = listener => { window.addEventListener('qa-route', listener); return () => window.removeEventListener('qa-route', listener); };
              export const usePathname = () => useSyncExternalStore(subscribe, () => location.pathname);
              const move = (kind, href) => { history[kind](null, '', href); window.dispatchEvent(new Event('qa-route')); };
              export const useRouter = () => ({ push: href => move('pushState', href), replace: href => move('replaceState', href) });`,
            loader: "js",
          }));
          build.onLoad({ filter: /(?:NavigationRuntime|AdminDialog)\.tsx$/ }, (args) =>
            sources.has(args.path) ? { contents: sources.get(args.path), loader: "tsx" } : null,
          );
        },
      },
    ],
  });
  return result.outputFiles[0].text.replaceAll("</script", "<\\/script");
}

const bundles = [["current", await bundle()]];
if (baseline) bundles.unshift(["baseline", await bundle(baseline)]);
if (process.argv.includes("--compile-only")) {
  console.log(JSON.stringify({ compiled: bundles.map(([version]) => version), baseline }));
  process.exit(0);
}
const browser = await chromium.launch({ headless: true });
try {
  for (const [version, script] of bundles) {
    for (const width of [1440, 390]) {
      for (const reducedMotion of ["no-preference", "reduce"]) {
        for (const scenario of [
          "early-field",
          "closing-palette",
          "new-dialog",
          "dismissal",
          "stacked-dialogs",
        ]) {
          const label = `${version}-${width}-${reducedMotion}-${scenario}`;
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion,
          });
          const page = await context.newPage();
          page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
          page.on("console", (message) => {
            if (message.type() === "error") errors.push(`${label}: ${message.text()}`);
          });
          await context.addInitScript(() => {
            window.__focusCalls = [];
            const focus = HTMLElement.prototype.focus;
            HTMLElement.prototype.focus = function (...args) {
              window.__focusCalls.push({
                target: this.id || this.getAttribute("aria-label") || this.tagName,
                stack: new Error().stack?.split("\n").slice(1, 4),
              });
              return focus.apply(this, args);
            };
            const raf = requestAnimationFrame.bind(window);
            const cancel = cancelAnimationFrame.bind(window);
            let held = false;
            let id = 10000000;
            const callbacks = new Map();
            window.__holdFrames = () => (held = true);
            window.__resumeFrames = () => {
              held = false;
              for (const callback of callbacks.values()) raf(callback);
              callbacks.clear();
            };
            window.__nextFrames = () => new Promise((done) => raf(() => raf(done)));
            window.requestAnimationFrame = (callback) => {
              if (!held) return raf(callback);
              const key = id++;
              callbacks.set(key, callback);
              return key;
            };
            window.cancelAnimationFrame = (key) => {
              if (!callbacks.delete(key)) cancel(key);
            };
          });
          await page.route("**/*", (route) => {
            if (route.request().isNavigationRequest())
              return route.fulfill({
                contentType: "text/html",
                body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Controlled focus workspace</title></head><body style="margin:0;font-family:system-ui"><div id="root"></div><script>${script}</script></body></html>`,
              });
            escaped.push(`${label}: ${route.request().url()}`);
            return route.abort();
          });
          await page.goto("https://accelerate-focus.example/admin/today");
          await page.waitForFunction(() => window.__qa);
          let ok;
          if (scenario === "early-field" || scenario === "closing-palette") {
            if (scenario === "closing-palette") {
              await page.getByRole("button", { name: "Search", exact: true }).click();
              await page.getByRole("textbox", { name: "Search commands" }).waitFor();
            }
            await page.evaluate(() => {
              window.__holdFrames();
              window.__qa.navigate();
            });
            const key = page.getByLabel("Stripe API key", { exact: true });
            await key.waitFor();
            await key.focus();
            await page.keyboard.type("fictional-input");
            await page.evaluate(() => window.__resumeFrames());
            await page.getByRole("dialog").waitFor({ state: "detached" });
            await page.evaluate(() => window.__nextFrames());
            const afterHandoff = await key.evaluate((node) => node === document.activeElement);
            await page.evaluate(() => window.__qa.replaceHeading());
            await page.locator("#heading-1").waitFor();
            await page.evaluate(() => window.__nextFrames());
            const afterReplacement = await key.evaluate((node) => node === document.activeElement);
            ok = afterHandoff && afterReplacement && (await key.inputValue()) === "fictional-input";
          } else if (scenario === "new-dialog") {
            await page.evaluate(() => {
              window.__holdFrames();
              window.__qa.navigate();
            });
            await page.getByLabel("Stripe API key", { exact: true }).waitFor();
            await page
              .getByRole("button", { name: "Open editor", exact: true })
              .evaluate((node) => node.click());
            const editor = page.getByRole("textbox", { name: "Editor name" });
            await editor.waitFor();
            await editor.focus();
            await page.evaluate(() => window.__resumeFrames());
            await page.evaluate(() => window.__nextFrames());
            ok = await editor.evaluate((node) => node === document.activeElement);
          } else if (scenario === "dismissal") {
            const opener = page.getByRole("button", { name: "Search", exact: true });
            await opener.focus();
            await page.keyboard.press("Enter");
            await page.getByRole("textbox", { name: "Search commands" }).waitFor();
            await page.keyboard.press("Escape");
            await page.getByRole("dialog").waitFor({ state: "detached" });
            await page.waitForFunction(() => document.activeElement?.id === "opener");
            await page.getByRole("button", { name: "Navigate", exact: true }).click();
            await page.waitForFunction(() => document.activeElement?.id === "heading-0");
            await page.evaluate(() => window.__qa.replaceHeading());
            await page.waitForFunction(() => document.activeElement?.id === "heading-1");
            ok = true;
          } else {
            await page.getByRole("button", { name: "Open editor", exact: true }).click();
            await page.getByRole("textbox", { name: "Editor name" }).waitFor();
            await page.getByRole("button", { name: "Review", exact: true }).click();
            await page.getByRole("textbox", { name: "Review note" }).waitFor();
            await page.getByRole("button", { name: "Close review", exact: true }).focus();
            await page.keyboard.press("Enter");
            await page
              .getByRole("dialog", { name: "Review", exact: true })
              .waitFor({ state: "detached" });
            await page.waitForFunction(() => document.activeElement?.id === "child-opener");
            await page.getByRole("button", { name: "Close editor", exact: true }).focus();
            await page.keyboard.press("Enter");
            await page.getByRole("dialog").waitFor({ state: "detached" });
            await page.waitForFunction(() => document.activeElement?.id === "parent-opener");
            ok = true;
          }
          const trace = await page.evaluate(() => window.__focusCalls.slice(-12));
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          );
          results.push({ version, width, reducedMotion, scenario, passed: ok, trace, overflow });
          if (version === "current") {
            await page.screenshot({ path: `${output}/${label}.png` });
            assert.ok(ok, `${label}: preserve the operator's focus and typed input`);
            assert.equal(overflow, false, `${label}: no horizontal overflow`);
          }
          await context.close();
        }
      }
    }
  }
  assert.deepEqual(errors, [], "No browser errors in the real shared owners");
  assert.deepEqual(escaped, [], "The controlled focus fixture makes no backend/provider requests");
  passed = true;
} finally {
  await browser.close();
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify(
      {
        passed,
        commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        baseline,
        boundary:
          "Actual shared React owners with a controlled Next router; full Next invoice acceptance is separate.",
        results,
        errors,
        escaped,
      },
      null,
      2,
    ) + "\n",
  );
}
