import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { installAdminDemoRuntime } from "../src/lib/admin/demo/runtime";

async function main() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { value: storage, configurable: true });
  Object.defineProperty(globalThis, "window", {
    value: {
      location: { origin: "https://demo.example", reload() {} },
      open() {},
      fetch() {
        throw new Error("Protected network request escaped the demo");
      },
    },
    configurable: true,
  });
  let runtime = installAdminDemoRuntime("northline-roofing");
  const call = (operation: string, id?: string, revision?: number, payload = {}) =>
    window.fetch("/api/admin/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, id, revision, payload, requestKey: randomUUID() }),
    });
  try {
    let firstId = "";
    for (let i = 0; i < 7; i++) {
      const created = await call("create", undefined, undefined, {
        title: `Continuity ${i}`,
        description: "Fictional fixture",
        acceptance_criteria: "Claim succeeds",
        work_kind: "research",
      });
      const { card } = await created.json();
      assert.equal(created.status, 200);
      if (!i) firstId = card.id;
      const claimed = await call("claim", card.id, card.revision, { claimToken: "old-token" });
      assert.equal(claimed.status, 200, await claimed.text());
    }
    assert.equal((await call("claim", firstId, undefined, { claimToken: "other" })).status, 409);
    runtime.restore();
    const key = "accelerate:admin-demo:northline-roofing:v3";
    const state = JSON.parse(values.get(key)!);
    const revision = state.featureOverrides[firstId].revision;
    state.featureOverrides[firstId].lease_expires_at = "2000-01-01T00:00:00Z";
    values.set(key, JSON.stringify(state));
    runtime = installAdminDemoRuntime("northline-roofing");
    assert.equal(
      (await call("claim", firstId, revision - 1, { claimToken: "new-token" })).status,
      409,
    );
    assert.equal((await call("claim", firstId, revision, { claimToken: "new-token" })).status, 200);
    assert.equal(
      (await call("heartbeat", firstId, undefined, { claimToken: "old-token" })).status,
      403,
    );
    assert.equal(
      (await call("heartbeat", firstId, undefined, { claimToken: "new-token" })).status,
      200,
    );
    console.log(
      "Demo passed: seventh claim, live-claim denial, expired continuation, stale revision and old-token rejection; zero external requests.",
    );
  } finally {
    runtime.restore();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
}
void main();
