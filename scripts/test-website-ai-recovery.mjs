import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";
import { fictionalWebsite } from "../src/lib/admin/demo/website-runtime.ts";
import * as authoring from "../src/lib/site-studio/website-authoring.ts";
import * as commands from "../src/lib/site-studio/website-commands.ts";
import * as documents from "../src/lib/site-studio/website-document.ts";
import * as modelExports from "../src/lib/site-studio/models.ts";
import * as generated from "../src/lib/site-studio/generate.ts";
import * as structured from "../src/lib/site-studio/structured-output.ts";
import { NextResponse } from "next/server";

const models = { ...modelExports.default, ...modelExports };
const require = createRequire(import.meta.url);
const stub = () => null;
function compile(path, mocks = {}) {
  const compiled = { exports: {} };
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", "fetch", "window", output)(
    (name) =>
      mocks[name] ??
      (name.startsWith(".") || name.startsWith("@/")
        ? new Proxy({}, { get: () => stub })
        : require(name)),
    compiled,
    compiled.exports,
    (...args) => mocks.fetch(...args),
    mocks.window,
  );
  return compiled.exports;
}
const original = fictionalWebsite("Fictional workshop");
const page = authoring.createWebsitePage(original, {
  title: "Consulting",
  path: "/consulting",
  starter: "service",
});
const website = { ...original, pages: [...original.pages, page] };
function hooks() {
  const state = [],
    refs = [],
    cleanups = [],
    effects = [];
  let stateIndex = 0,
    refIndex = 0,
    mounted = false;
  return {
    state,
    cleanups,
    effects,
    begin() {
      stateIndex = 0;
      refIndex = 0;
    },
    end() {
      mounted = true;
    },
    react: {
      ...React,
      useState(initial) {
        const index = stateIndex++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [
          state[index],
          (next) => {
            state[index] = typeof next === "function" ? next(state[index]) : next;
          },
        ];
      },
      useRef(initial) {
        const index = refIndex++;
        return (refs[index] ??= { current: initial });
      },
      useEffect(callback) {
        if (!mounted) {
          effects.push(callback);
          cleanups.push(callback());
        }
      },
    },
  };
}
function find(node, predicate) {
  if (Array.isArray(node)) return node.map((item) => find(item, predicate)).find(Boolean);
  if (!node || typeof node !== "object") return null;
  return predicate(node) ? node : find(node.props?.children, predicate);
}
const text = (value) =>
  Array.isArray(value) ? value.map(text).join("") : typeof value === "string" ? value : "";
const button = (tree, label) =>
  find(tree, (node) => node.type === "button" && text(node.props.children).trim() === label);
const lifecycle = hooks(),
  writes = [];
let finish, signal;
const Tools = compile("src/components/admin/site/WebsitePageTools.tsx", {
  react: lifecycle.react,
  "@/lib/site-studio/website-authoring": authoring,
  "@/lib/site-studio/website-document": documents,
  "@/lib/site-studio/models": models,
  fetch: (_, options) => {
    signal = options.signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  },
}).WebsitePageTools;
let currentPage = page;
const render = () => {
  lifecycle.begin();
  const tree = Tools({
    website,
    page: currentPage,
    disabled: false,
    onChange: (next) => writes.push(next),
  });
  lifecycle.end();
  return tree;
};
button(render(), "Add page").props.onClick();
find(render(), (node) => node.type === "input" && node.props.maxLength === 160).props.onChange({
  target: { value: "Initial title" },
});
find(
  render(),
  (node) => node.type === "input" && node.props.placeholder === "/your-page",
).props.onChange({ target: { value: "/custom-address" } });
find(render(), (node) => node.type === "input" && node.props.maxLength === 160).props.onChange({
  target: { value: "Changed title" },
});
assert.equal(
  find(render(), (node) => node.type === "input" && node.props.placeholder === "/your-page").props
    .value,
  "/custom-address",
);
button(render(), "Ask AI").props.onClick();
find(render(), (node) => node.type === "textarea").props.onChange({
  target: { value: "Improve the introduction" },
});
const pending = button(render(), "Prepare suggestion").props.onClick();
assert(signal instanceof AbortSignal);
button(render(), "Cancel suggestion").props.onClick();
assert(signal.aborted);
assert.equal(button(render(), "Prepare suggestion").props.disabled, false);
const canceledReply = {
  page: { ...page, metadata: { ...page.metadata, title: "Canceled result" } },
  summary: "Late canceled reply",
};
finish(new Response(JSON.stringify(canceledReply)));
await pending;
assert.equal(
  Boolean(button(render(), "Apply to draft")),
  false,
  "late canceled responses cannot offer an apply action",
);
assert.deepEqual(writes, []);
const fresh = button(render(), "Prepare suggestion").props.onClick();
finish(
  new Response(
    JSON.stringify({
      page: { ...page, metadata: { ...page.metadata, title: "Fresh result" } },
      summary: "Fresh change",
    }),
  ),
);
await fresh;
assert(button(render(), "Preview suggestion"));
currentPage = {
  ...page,
  metadata: { ...page.metadata, title: "Manual edit after the suggestion" },
};
assert.equal(
  button(render(), "Apply to draft").props.disabled,
  true,
  "stale suggestions preserve newer local edits",
);
currentPage = page;
button(render(), "Apply to draft").props.onClick();
assert.equal(writes[0].pages.at(-1).metadata.title, "Fresh result");
const unmounting = button(render(), "Prepare suggestion").props.onClick();
for (const cleanup of lifecycle.cleanups) cleanup?.();
assert(signal.aborted, "leaving the page aborts its pending suggestion");
finish(new Response(JSON.stringify(canceledReply)));
await unmounting;

const editorHooks = hooks();
editorHooks.state.push(
  { version: 0, draft: null, publishedRevisionId: null },
  website,
  [],
  [],
  false,
  false,
  true,
  "",
  "pages",
  page.id,
  false,
  "",
  "",
  false,
  null,
);
const Owner = compile("src/components/admin/site/WebsiteEditor.tsx", {
  react: { ...editorHooks.react, useCallback: (callback) => callback, useEffect: () => {} },
  "./WebsitePageTools": { WebsitePageTools: Tools },
}).WebsiteEditor;
editorHooks.begin();
assert.equal(
  find(Owner(), (node) => node.type === Tools).key,
  page.id,
  "page identity resets tool state",
);

const Content = compile("src/components/admin/site/WebsiteContentEditor.tsx", {
  react: { ...React, useState: () => ["hero", () => {}] },
}).WebsiteContentEditor;
const bounded = {
  ...page,
  content: {
    ...page.content,
    document: {
      ...page.content.document,
      root: Array.from({ length: 40 }, (_, index) => ({
        ...page.content.document.root[0],
        id: `s-${index}`,
        children: page.content.document.root[0].children.map((child, at) => ({
          ...child,
          id: `s-${index}-${at}`,
        })),
      })),
    },
  },
};
documents.parseWebsiteDocument({
  ...website,
  pages: website.pages.map((row) => (row.id === bounded.id ? bounded : row)),
});
assert.equal(
  button(
    Content({ page: bounded, onChange: () => assert.fail("over-limit additions") }),
    "Add section",
  ).props.disabled,
  true,
);

// Execute the actual route, service and generation adapter with a controlled gateway.
const calls = [];
const OpenRouterError = class extends Error {};
const provider = {
  OpenRouterError,
  openRouterJson: async (input) => {
    calls.push(input);
    return {
      data:
        input.schemaName === "website_text_edits_v1"
          ? {
              summary: "Improved title",
              edits: [{ field: "metadata.title", text: "Refined consulting" }],
            }
          : { ...page.content.document.metadata, root: page.content.document.root },
    };
  },
};
const shared = {
  "server-only": {},
  "./models": models,
  "./model-catalog": { resolveSiteModel: async () => ({ model: models.DEFAULT_SITE_MODEL }) },
  "@/lib/ai/openrouter": provider,
  "./generate": generated,
  "./structured-output": structured,
};
const adapter = compile("src/lib/site-studio/openrouter-adapter.ts", shared);
let limited = 0;
const ai = compile("src/lib/site-studio/website-ai.ts", {
  ...shared,
  "./website-store": {
    assertWebsiteOwner: (auth) => {
      if (!auth.owner) throw new Error("Owner required");
    },
  },
  "./website-document": documents,
  "./website-authoring": authoring,
  "./openrouter-adapter": adapter,
  "@/lib/rate-limit": {
    rateLimit: async () => {
      limited++;
      return { success: true };
    },
  },
});
const actor = { owner: true, user: { id: "fictional-owner" }, database: {} };
const controller = new AbortController();
const input = {
  page,
  instruction: "Improve the title",
  business: "Fictional workshop",
  mode: "edit",
  model: models.DEFAULT_SITE_MODEL,
};
await ai.proposeWebsitePage(actor, input, controller.signal);
assert.equal(calls.at(-1).signal, controller.signal);
await ai.proposeWebsitePage(actor, { ...input, mode: "generate" }, controller.signal);
assert.equal(calls.at(-1).signal, controller.signal);
controller.abort();
const beforeLimit = limited;
await assert.rejects(ai.proposeWebsitePage(actor, input, controller.signal), {
  name: "AbortError",
});
assert.equal(limited, beforeLimit, "already canceled requests cannot start another model attempt");
await assert.rejects(
  ai.proposeWebsitePage({ ...actor, owner: false }, input, controller.signal),
  /Owner required/,
);
let requestSignal;
const route = compile("src/app/api/admin/site/website/suggest/route.ts", {
  "next/server": { NextResponse },
  "@/lib/admin/module-guard": { requireAdminForModule: async () => actor },
  "@/lib/http/bounded-json": { readBoundedJson: (request) => request.json() },
  "@/lib/site-studio/website-store": { assertWebsiteOwner: () => {} },
  "@/lib/site-studio/models": models,
  "@/lib/site-studio/website-ai": {
    ...ai,
    proposeWebsitePage: async (_, __, signal) => {
      requestSignal = signal;
      signal.throwIfAborted();
      return { page, summary: "Controlled reply" };
    },
  },
});
const stopped = new AbortController();
stopped.abort();
const request = new Request("http://fixture/api/admin/site/website/suggest", {
  method: "POST",
  body: JSON.stringify(input),
  signal: stopped.signal,
});
assert.equal((await route.POST(request)).status, 499);
assert.equal(requestSignal, request.signal);
// Exercise the actual website owner against deferred reads and writes.
function ownerHarness() {
  const life = hooks();
  const requests = [];
  const PageTools = () => null;
  const Publishing = () => null;
  const Editor = compile("src/components/admin/site/WebsiteEditor.tsx", {
    react: { ...life.react, useCallback: (callback) => callback },
    "@/lib/site-studio/website-document": documents,
    "@/lib/site-studio/website-commands": commands,
    "./WebsitePageTools": { WebsitePageTools: PageTools },
    "./WebsitePublishing": { WebsitePublishing: Publishing },
    window: { addEventListener() {}, removeEventListener() {} },
    fetch: (url, options) =>
      new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
  }).WebsiteEditor;
  const owner = {
    life,
    requests,
    render() {
      life.begin();
      const tree = Editor();
      life.end();
      return tree;
    },
    edit(next) {
      find(owner.render(), (node) => node.type === PageTools).props.onChange(
        next,
        next.pages[0].id,
      );
    },
    publish(command) {
      find(owner.render(), (node) => node.type === Publishing).props.onCommand(command);
    },
    async reply(value, status = 200) {
      const request = requests.shift();
      assert.ok(request, "expected an owner request");
      request.resolve(new Response(JSON.stringify(value), { status }));
      await new Promise((resolve) => setImmediate(resolve));
      return request;
    },
    close() {
      life.cleanups.forEach((cleanup) => cleanup?.());
    },
  };
  return owner;
}
const ownerState = { version: 0, draft: null, publishedRevisionId: null };
const editedWebsite = {
  ...website,
  identity: { ...website.identity, tagline: "Retain this local edit" },
};
const overlap = ownerHarness();
overlap.render();
await overlap.reply({ website: ownerState, bundled: website });
overlap.edit(editedWebsite);
button(overlap.render(), "Reload saved draft").props.onClick();
button(overlap.render(), "Save draft").props.onClick();
assert.equal(
  button(overlap.render(), "Replace local edits").props.disabled,
  true,
  "reload confirmation must lock during a pending save",
);
button(overlap.render(), "Replace local edits").props.onClick();
assert.equal(overlap.requests.length, 1, "a reload cannot overlap the pending save");
overlap.close();

const tick = () => new Promise((resolve) => setImmediate(resolve));
async function readyOwner(state = ownerState) {
  const owner = ownerHarness();
  owner.render();
  await owner.reply({ website: state, bundled: website });
  return owner;
}
function receiptFor(owner, overrides = {}) {
  const command = JSON.parse(owner.requests[0].options.body);
  const state = owner.life.state[0];
  return {
    requestKey: command.requestKey,
    operation: command.operation,
    version: command.expectedVersion + 1,
    draftRevisionId: command.operation === "save" ? crypto.randomUUID() : state.draft.id,
    publishedRevisionId:
      command.operation === "save"
        ? state.publishedRevisionId
        : command.operation === "unpublish"
          ? null
          : command.revisionId,
    previousPublishedRevisionId: state.publishedRevisionId,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
const duplicate = await readyOwner();
duplicate.edit(editedWebsite);
const clickSave = button(duplicate.render(), "Save draft").props.onClick;
clickSave();
clickSave();
assert.equal(duplicate.requests.length, 1, "rapid save clicks share a synchronous lock");
assert.ok(duplicate.requests[0].options.signal instanceof AbortSignal);
const frozenBody = duplicate.requests[0].options.body;
await duplicate.reply({ receipt: receiptFor(duplicate, { version: 9 }) });
assert.equal(duplicate.life.state[0].version, 0);
assert.equal(duplicate.life.state[1].identity.tagline, editedWebsite.identity.tagline);
assert.ok(duplicate.life.state[14], "unverified success retains the frozen command");
assert.match(duplicate.life.state[11], /confirmation did not match/);
button(duplicate.render(), "Retry same save").props.onClick();
assert.equal(duplicate.requests[0].options.body, frozenBody);
await duplicate.reply({ receipt: receiptFor(duplicate) });
assert.equal(duplicate.life.state[0].version, 1);
assert.equal(duplicate.life.state[14], null);
duplicate.close();

for (const mismatch of [
  { requestKey: crypto.randomUUID() },
  { operation: "unpublish" },
  { publishedRevisionId: crypto.randomUUID() },
  { previousPublishedRevisionId: crypto.randomUUID() },
  { draftRevisionId: "invalid" },
]) {
  const owner = await readyOwner();
  owner.edit(editedWebsite);
  button(owner.render(), "Save draft").props.onClick();
  await owner.reply({ receipt: receiptFor(owner, mismatch) });
  assert.equal(owner.life.state[0].version, 0);
  assert.ok(owner.life.state[14]);
  assert.equal(owner.life.state[1].identity.tagline, editedWebsite.identity.tagline);
  owner.close();
}
const revisionId = crypto.randomUUID();
const savedState = {
  version: 5,
  draft: {
    id: revisionId,
    checksum: "demo-content-revision",
    createdAt: new Date().toISOString(),
    document: website,
  },
  publishedRevisionId: crypto.randomUUID(),
};
for (const kind of ["publish", "rollback", "unpublish"]) {
  const owner = await readyOwner(savedState);
  owner.publish({
    operation: kind,
    expectedVersion: 5,
    requestKey: crypto.randomUUID(),
    ...(kind === "unpublish"
      ? {}
      : { revisionId: kind === "publish" ? revisionId : crypto.randomUUID() }),
  });
  const exactBody = owner.requests[0].options.body;
  await owner.reply({ receipt: receiptFor(owner, { draftRevisionId: crypto.randomUUID() }) });
  assert.equal(owner.life.state[0].version, 5, `${kind} must preserve the current draft`);
  button(owner.render(), `Retry same ${kind}`).props.onClick();
  assert.equal(owner.requests[0].options.body, exactBody);
  const receipt = receiptFor(owner);
  await owner.reply({ receipt });
  assert.equal(owner.life.state[0].version, 6);
  assert.equal(owner.life.state[0].publishedRevisionId, receipt.publishedRevisionId);
  assert.equal(owner.life.state[0].draft.id, revisionId);
  assert.deepEqual(owner.life.state[1], website);
  owner.close();
}
const invalidRead = ownerHarness();
invalidRead.render();
await invalidRead.reply({ website: { ...ownerState, version: "0" }, bundled: website });
assert.equal(invalidRead.life.state[1], null);
button(invalidRead.render(), "Retry loading website").props.onClick();
await invalidRead.reply({ website: ownerState, bundled: website });
invalidRead.edit(editedWebsite);
button(invalidRead.render(), "Reload saved draft").props.onClick();
button(invalidRead.render(), "Replace local edits").props.onClick();
assert.equal(button(invalidRead.render(), "Keep editing").props.disabled, true);
await invalidRead.reply({
  website: { ...savedState, draft: { ...savedState.draft, id: "wrong" } },
  bundled: website,
});
assert.equal(invalidRead.life.state[1].identity.tagline, editedWebsite.identity.tagline);
assert.ok(invalidRead.life.state[2].length, "failed reload retains undo history");
assert.ok(button(invalidRead.render(), "Replace local edits"));
button(invalidRead.render(), "Replace local edits").props.onClick();
await invalidRead.reply({ website: savedState, bundled: website });
assert.deepEqual(invalidRead.life.state[1], website);
assert.equal(invalidRead.life.state[13], false);
invalidRead.close();

const staleRead = ownerHarness();
staleRead.render();
const firstSignal = staleRead.requests[0].options.signal;
staleRead.close();
assert.equal(firstSignal.aborted, true);
const secondCleanup = staleRead.life.effects[0]();
await staleRead.reply({ website: savedState, bundled: website });
assert.equal(
  staleRead.life.state[1],
  null,
  "aborted strict-mode read cannot replace the newer read",
);
assert.equal(staleRead.life.state[10], true, "old finally cannot unlock the newer read");
await staleRead.reply({ website: ownerState, bundled: website });
assert.deepEqual(staleRead.life.state[1], website);
secondCleanup();

const lateSave = await readyOwner();
lateSave.edit(editedWebsite);
button(lateSave.render(), "Save draft").props.onClick();
const lateReceipt = receiptFor(lateSave);
lateSave.close();
const leftState = JSON.stringify(lateSave.life.state);
await lateSave.reply({ receipt: lateReceipt });
assert.equal(
  JSON.stringify(lateSave.life.state),
  leftState,
  "a departed editor ignores late save receipts",
);

for (const leave of [false, true]) {
  const owner = await readyOwner();
  owner.edit(editedWebsite);
  let finishFile;
  const input = find(owner.render(), (node) => node.type === "input" && node.props.type === "file");
  const importTask = input.props.onChange({
    target: {
      value: "fixture.json",
      files: [
        {
          size: 100,
          text: () =>
            new Promise((resolve) => {
              finishFile = resolve;
            }),
        },
      ],
    },
  });
  assert.equal(find(owner.render(), (node) => node.type === "fieldset").props.disabled, true);
  assert.equal(button(owner.render(), "Undo").props.disabled, true);
  button(owner.render(), "Working…").props.onClick();
  assert.equal(owner.requests.length, 0, "save cannot start during file reading");
  if (leave) owner.close();
  const prior = JSON.stringify(owner.life.state);
  finishFile(JSON.stringify(website));
  await importTask;
  await tick();
  if (leave)
    assert.equal(
      JSON.stringify(owner.life.state),
      prior,
      "late imports cannot alter a departed editor",
    );
  else {
    assert.deepEqual(owner.life.state[1], website);
    assert.equal(owner.life.state[2].at(-1).identity.tagline, editedWebsite.identity.tagline);
    assert.match(owner.life.state[12], /Imported into local edits/);
    assert.equal(owner.life.state[10], false);
    owner.close();
  }
}
console.log(
  "Website recovery passed: AI cancellation and page identity; serialized save/reload/import; aborted and strict-mode late reads; verified publication receipts; exact retries; local edit and undo preservation.",
);
