import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { chromium } from "playwright";

const source = ts.transpileModule(readFileSync("src/lib/admin/offline-store.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045"}/admin/login`);
  const results = await page.evaluate(async (code) => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    const store = await import(url);
    URL.revokeObjectURL(url);
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const draft = (tenantSlug, userId, id) => ({
      id,
      tenantSlug,
      userId,
      kind: "note",
      body: "Fictional local note",
      updatedAt: new Date().toISOString(),
      status: "local",
    });
    check(await store.saveOfflineDraft(draft("alpha", "one", "a")), "Draft did not commit");
    check(await store.saveOfflineDraft(draft("alpha", "two", "b")), "Second user did not commit");
    check(await store.saveOfflineDraft(draft("beta", "one", "c")), "Second tenant did not commit");
    check((await store.listOfflineDrafts("alpha", "one")).length === 1, "Draft isolation failed");
    const canceled = new AbortController();
    canceled.abort();
    check(
      !(await store.saveOfflineDraft(draft("alpha", "one", "canceled"), canceled.signal)),
      "Canceled write reported saved",
    );
    await store.saveOfflineSnapshot({
      version: 1,
      tenantSlug: "alpha",
      userId: "one",
      tenantName: "Fictional",
      generatedAt: new Date().toISOString(),
      summary: { total: 1, urgent: 0, critical: 0, byKind: {} },
    });
    check(await store.clearOfflineWorkspace("alpha", "one"), "Cleanup did not commit");
    check((await store.listOfflineDrafts("alpha", "one")).length === 0, "Draft survived cleanup");
    check((await store.readOfflineSnapshot("alpha", "one")) === null, "Snapshot survived cleanup");
    check(
      (await store.listOfflineDrafts("alpha", "two")).length === 1,
      "Cleanup crossed user boundary",
    );
    check(
      (await store.listOfflineDrafts("beta", "one")).length === 1,
      "Cleanup crossed tenant boundary",
    );
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = originalPut.call(this, value, key);
      this.transaction.abort();
      return request;
    };
    let rejected = false;
    try {
      await store.saveOfflineDraft(draft("alpha", "one", "aborted"));
    } catch {
      rejected = true;
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }
    check(rejected, "Aborted transaction falsely reported saved");
    check((await store.listOfflineDrafts("alpha", "one")).length === 0, "Aborted write persisted");
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
    check(
      !(await store.saveOfflineDraft(draft("alpha", "one", "unavailable"))),
      "Unavailable storage falsely reported saved",
    );
    return [
      "committed save",
      "tenant/user isolation",
      "canceled write",
      "cleanup parity",
      "transaction abort",
      "unavailable storage",
    ];
  }, source);
  assert.equal(results.length, 6);
  console.log("PASS: Command Center offline storage", results.join(", "));
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/command-center-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.evaluate(async () => {
    const cache = await caches.open("accelerate-command-center-v1");
    await cache.put("/cleanup-test.js", new Response("fictional"));
    navigator.serviceWorker.controller.postMessage({ type: "CLEAR_WORKSPACE_CACHE" });
  });
  await page.waitForFunction(async () => !(await caches.match("/cleanup-test.js")));
  assert.ok(
    await page.evaluate(async () => Boolean(await caches.match("/command-center-offline.html"))),
  );
  await page.context().setOffline(true);
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045"}/workspace`);
  await page.getByRole("heading", { name: "You are offline." }).waitFor();
  console.log("PASS: Service worker cleanup preserves the working offline fallback");
} finally {
  await browser.close();
}
