import assert from "node:assert/strict";
import {
  createDemoWebsiteState,
  fictionalWebsite,
  handleDemoWebsite,
} from "../src/lib/admin/demo/website-runtime";
async function main() {
  const state = createDemoWebsiteState();
  const other = createDemoWebsiteState();
  const name = "Northstar Workshop";
  const document = fictionalWebsite(name);
  const save = { operation: "save", expectedVersion: 0, requestKey: crypto.randomUUID(), document };
  const first = await handleDemoWebsite(state, name, "POST", save).json();
  assert.equal(first.receipt.version, 1);
  assert.deepEqual(await handleDemoWebsite(state, name, "POST", save).json(), first);
  assert.equal(
    handleDemoWebsite(state, name, "POST", {
      ...save,
      document: { ...document, identity: { ...document.identity, name: "Changed" } },
    }).status,
    409,
  );
  assert.equal(
    handleDemoWebsite(state, name, "POST", { ...save, requestKey: crypto.randomUUID() }).status,
    409,
  );
  assert.equal(other.website.version, 0);
  assert.equal(state.website.publishedRevisionId, null);
  const publish = {
    operation: "publish",
    expectedVersion: 1,
    requestKey: crypto.randomUUID(),
    revisionId: first.receipt.draftRevisionId,
  };
  assert.equal(
    handleDemoWebsite(state, name, "POST", { ...publish, revisionId: crypto.randomUUID() }).status,
    409,
  );
  assert.equal(handleDemoWebsite(state, name, "POST", publish).status, 200);
  assert.equal(state.website.publishedRevisionId, first.receipt.draftRevisionId);
  assert.equal(
    handleDemoWebsite(state, name, "POST", {
      operation: "unpublish",
      expectedVersion: 2,
      requestKey: crypto.randomUUID(),
    }).status,
    200,
  );
  assert.equal(state.website.publishedRevisionId, null);
  assert.equal(
    handleDemoWebsite(state, name, "POST", {
      operation: "rollback",
      expectedVersion: 3,
      requestKey: crypto.randomUUID(),
      revisionId: first.receipt.draftRevisionId,
    }).status,
    200,
  );
  assert.equal(state.website.publishedRevisionId, first.receipt.draftRevisionId);
  assert.equal(
    handleDemoWebsite(state, name, "POST", {
      ...save,
      expectedVersion: 4,
      requestKey: crypto.randomUUID(),
      document: { ...document, scripts: ["alert(1)"] },
    }).status,
    400,
  );
  assert.equal(state.website.version, 4);
  console.log(
    "PASS: fictional website revisions, exact replay, stale saves, publication history, unsafe snapshot rejection and scenario isolation.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
