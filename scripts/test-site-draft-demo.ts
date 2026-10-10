import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createDemoSiteDraftState,
  handleDemoSiteDrafts,
} from "../src/lib/admin/demo/site-draft-runtime";
import { installAdminDemoRuntime } from "../src/lib/admin/demo/runtime";
import { SITE_ASSET_CATALOG } from "../src/lib/site-studio/assets";

const brief = {
  serviceName: "Roof inspection",
  audience: "Property owners",
  outcome: "Review the condition report",
};
const create = { brief, mode: "template" };

async function main() {
  const state = createDemoSiteDraftState();
  const post = await handleDemoSiteDrafts(state, "POST", create);
  assert.equal(post.status, 201);
  const { draft, simulated } = await post.json();
  assert.equal(simulated, true);
  assert.equal(
    draft.checksum,
    createHash("sha256").update(JSON.stringify(draft.document)).digest("hex"),
  );
  assert.equal((await handleDemoSiteDrafts(state, "POST", create)).status, 409);
  assert.equal(
    (await handleDemoSiteDrafts(state, "POST", { ...create, unknown: true })).status,
    400,
  );
  assert.equal(
    (await handleDemoSiteDrafts(state, "POST", { ...create, assetIds: Array(9).fill("bad") }))
      .status,
    400,
  );
  assert.equal(
    (
      await handleDemoSiteDrafts(state, "POST", {
        ...create,
        slug: "unknown-asset",
        assetIds: ["bad"],
      })
    ).status,
    422,
  );
  const ai = await handleDemoSiteDrafts(state, "POST", {
    ...create,
    mode: "ai",
    slug: "ai-example",
    assetIds: SITE_ASSET_CATALOG.slice(0, 1).map((asset) => asset.id),
  });
  assert.equal(ai.status, 201);
  assert.equal((await ai.json()).simulated, true);
  const list = await (await handleDemoSiteDrafts(state, "GET", {})).json();
  assert.deepEqual(
    Object.keys(list.drafts[0]).sort(),
    ["id", "slug", "title", "source", "updatedAt", "checksum"].sort(),
  );
  assert.equal((await handleDemoSiteDrafts(state, "GET", {}, draft.id.toUpperCase())).status, 200);
  const revision = {
    patches: [{ op: "updateMetadata", title: "Reviewed inspection" }],
    expectedChecksum: draft.checksum,
  };
  const results = await Promise.all([
    handleDemoSiteDrafts(state, "PATCH", revision, draft.id),
    handleDemoSiteDrafts(state, "PATCH", revision, draft.id),
  ]);
  assert.deepEqual(results.map((response) => response.status).sort(), [200, 409]);
  const saved = (await results.find((response) => response.ok)!.json()).draft;
  assert.equal(saved.document.metadata.title, saved.title);
  assert.equal(saved.version, 2);
  assert.equal((await handleDemoSiteDrafts(state, "DELETE", {}, draft.id)).status, 428);
  assert.equal(
    (await handleDemoSiteDrafts(state, "DELETE", {}, draft.id, draft.checksum)).status,
    422,
  );
  const discarded = await (
    await handleDemoSiteDrafts(state, "DELETE", {}, draft.id, saved.checksum)
  ).json();
  assert.deepEqual(discarded.discarded, { id: draft.id, title: saved.title, slug: saved.slug });
  assert.equal((await handleDemoSiteDrafts(state, "GET", {}, draft.id)).status, 404);
  assert.deepEqual(
    state.receipts.map((receipt) => receipt.operation),
    ["discard", "revise", "create", "create"],
  );
  const simultaneous = createDemoSiteDraftState();
  assert.deepEqual(
    (
      await Promise.all([
        handleDemoSiteDrafts(simultaneous, "POST", create),
        handleDemoSiteDrafts(simultaneous, "POST", create),
      ])
    )
      .map((response) => response.status)
      .sort(),
    [201, 409],
  );

  // Exercise the installed handler, session persistence and module boundary,
  // with native fetch forbidden rather than replacing the draft request adapter.
  const storage = new Map<string, string>();
  let nativeRequests = 0;
  Object.assign(globalThis, {
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    window: {
      location: { origin: "https://demo.example", reload() {} },
      fetch: async () => {
        nativeRequests++;
        throw new Error("No native request is permitted");
      },
      open() {},
      dispatchEvent() {},
    },
  });
  window.sessionStorage = sessionStorage;
  let runtime = installAdminDemoRuntime("northline-roofing");
  const request = (path: string, method = "GET", value?: unknown, headers?: HeadersInit) =>
    window.fetch(`/api/admin/site/drafts${path}`, {
      method,
      body: value ? JSON.stringify(value) : undefined,
      headers,
    });
  const created = await (await request("", "POST", create)).json();
  assert(created.draft.id);
  const history = await (await window.fetch("/api/admin/activity?entity=site_draft")).json();
  assert.equal(history.entries.length, 1);
  assert.equal(history.entries[0].metadata.simulated, true);
  assert.equal(
    (
      await window.fetch(
        new Request("https://demo.example/api/admin/site/drafts", {
          method: "POST",
          body: JSON.stringify({ ...create, slug: "request-object" }),
        }),
      )
    ).status,
    201,
  );
  assert.equal(
    (await window.fetch("/api/admin/site/drafts", { method: "POST", body: "{" })).status,
    400,
  );
  runtime.restore();
  runtime = installAdminDemoRuntime("northline-roofing");
  assert.equal((await (await request("")).json()).drafts.length, 2);
  runtime.restore();
  runtime = installAdminDemoRuntime("ledgerstone-advisory");
  assert.equal((await (await request("")).json()).drafts.length, 0);
  runtime.restore();
  const key = "accelerate:admin-demo:northline-roofing:v3";
  const persisted = JSON.parse(storage.get(key)!);
  persisted.moduleOverrides["site-studio"] = false;
  storage.set(key, JSON.stringify(persisted));
  runtime = installAdminDemoRuntime("northline-roofing");
  for (const [path, method, body] of [
    ["", "GET", undefined],
    ["", "POST", create],
    [`/${created.draft.id}`, "PATCH", revision],
    [`/${created.draft.id}`, "DELETE", undefined],
  ] as const)
    assert.equal((await request(path, method, body)).status, 403);
  runtime.reset();
  runtime.restore();
  runtime = installAdminDemoRuntime("northline-roofing");
  assert.equal((await (await request("")).json()).drafts.length, 0);
  runtime.restore();
  assert.equal(nativeRequests, 0);
  console.log(
    "PASS: shared draft rules, checksums, gallery validation, concurrent saves/creates, receipts, installed demo handler, reload persistence, scenario isolation, module denial and reset without native requests.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
