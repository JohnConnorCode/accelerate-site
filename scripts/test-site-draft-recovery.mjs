import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";
import * as documents from "../src/lib/site-studio/document.ts";
import * as templates from "../src/lib/site-studio/templates.ts";
import * as assets from "../src/lib/site-studio/assets.ts";
import * as models from "../src/lib/site-studio/models.ts";

const require = createRequire(import.meta.url);
const stub = () => null;
const document = templates.servicePageTemplate({
  serviceName: "Roof inspection",
  audience: "Property owners",
  outcome: "Review the report",
});
const draft = documents.siteDraftSchema.parse({
  id: "a495116e-4cba-4976-bfb1-0739d8282745",
  title: document.metadata.title,
  slug: document.metadata.slug,
  document,
  source: "template",
  status: "draft",
  version: 1,
  checksum: "a".repeat(64),
  createdAt: "2026-10-05T12:00:00.000Z",
  updatedAt: "2026-10-05T12:00:00.000Z",
});
function harness(path) {
  const slots = [],
    pendingEffects = [],
    requests = [],
    navigation = [];
  let index = 0,
    currentPath = `/admin/site/${draft.id}`,
    mounted = true;
  const react = {
    ...React,
    use: (value) => value,
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [
        slots[slot],
        (value) => {
          slots[slot] = typeof value === "function" ? value(slots[slot]) : value;
        },
      ];
    },
    useRef(initial) {
      const slot = index++;
      return (slots[slot] ??= { current: initial });
    },
    useCallback(callback, dependencies) {
      const slot = index++,
        previous = slots[slot];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i])))
        slots[slot] = { callback, dependencies };
      return slots[slot].callback;
    },
    useEffect(callback, dependencies) {
      const slot = index++,
        previous = slots[slot];
      if (
        !previous ||
        dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))
      ) {
        previous?.cleanup?.();
        slots[slot] = { dependencies };
        pendingEffects.push(() => {
          slots[slot].cleanup = callback();
        });
      }
    },
  };
  const fetch = (url, options = {}) =>
    new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }));
  const mocks = {
    react,
    "next/navigation": { usePathname: () => currentPath },
    "@/components/admin/AdminLink": {
      __esModule: true,
      default: stub,
      useAdminNavigation: () => ({ push: (url) => navigation.push(url) }),
    },
    "@/lib/site-studio/document": documents,
    "@/lib/site-studio/assets": assets,
    "@/lib/site-studio/models": { ...models.default, ...models },
  };
  const compiled = { exports: {} };
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", "fetch", output)(
    (name) =>
      mocks[name] ?? (name.startsWith("@/") ? new Proxy({}, { get: () => stub }) : require(name)),
    compiled,
    compiled.exports,
    fetch,
  );
  return {
    requests,
    navigation,
    wrapper(id = draft.id) {
      return compiled.exports.default({ params: { id } });
    },
    setPath(value) {
      currentPath = value;
    },
    render() {
      assert(mounted);
      index = 0;
      const child = this.wrapper();
      const tree = child.type(child.props);
      for (const effect of pendingEffects.splice(0)) effect();
      return tree;
    },
    unmount() {
      mounted = false;
      slots.forEach((slot) => slot?.cleanup?.());
    },
    async reply(body, status = 200) {
      const request = requests.shift();
      assert(request, "expected a real source request");
      request.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
      await new Promise(setImmediate);
      await new Promise(setImmediate);
      return request;
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
const input = (tree) =>
  find(tree, (node) => node.type === "input" && node.props["aria-label"] === "Draft title");
const alerts = (tree) => find(tree, (node) => node.props?.role === "alert");
const detailPath = "src/app/admin/site/[id]/page.tsx";
const page = harness(detailPath);
page.render();
assert.equal(page.requests[0].options.cache, "no-store");
await page.reply({ error: "unavailable" }, 503);
assert(alerts(page.render()));
button(page.render(), "Retry").props.onClick();
page.render();
await page.reply({ draft });
assert.equal(input(page.render()).props.maxLength, 120);
assert.equal(
  button(page.render(), "Save title").props.disabled,
  true,
  "unchanged titles cannot be saved",
);
input(page.render()).props.onChange({ target: { value: "My reviewed title" } });
button(page.render(), "Save title").props.onClick();
assert.equal(input(page.render()).props.disabled, true, "pending title fields are locked");
assert.equal(JSON.parse(page.requests[0].options.body).expectedChecksum, draft.checksum);
await page.reply({ error: "stale" }, 409);
assert.equal(page.requests.length, 0, "conflicts never pretend to have reloaded");
assert.equal(input(page.render()).props.value, "My reviewed title");
assert.equal(button(page.render(), "Save title").props.disabled, true);
assert.equal(button(page.render(), "Discard draft").props.disabled, true);
button(page.render(), "Load latest draft").props.onClick();
page.render();
await page.reply({ error: "unavailable" }, 503);
assert.equal(
  input(page.render()).props.value,
  "My reviewed title",
  "failed refresh preserves the draft and typed title",
);
assert.equal(button(page.render(), "Save title").props.disabled, true);
button(page.render(), "Load latest draft").props.onClick();
page.render();
const latest = {
  ...draft,
  title: "Another editor's title",
  document: { ...document, metadata: { ...document.metadata, title: "Another editor's title" } },
  checksum: "b".repeat(64),
  version: 2,
};
await page.reply({ draft: latest });
assert.equal(input(page.render()).props.value, "My reviewed title");
assert.equal(button(page.render(), "Save title").props.disabled, false);
button(page.render(), "Save title").props.onClick();
assert.equal(JSON.parse(page.requests[0].options.body).expectedChecksum, latest.checksum);
const saved = {
  ...latest,
  title: "My reviewed title",
  document: {
    ...latest.document,
    metadata: { ...latest.document.metadata, title: "My reviewed title" },
  },
  checksum: "c".repeat(64),
  version: 3,
};
await page.reply({ draft: saved });
assert(
  find(
    page.render(),
    (node) => node.props?.role === "status" && node.props.children === "Title saved.",
  ),
);
assert.equal(button(page.render(), "Save title").props.disabled, true);
button(page.render(), "Discard draft").props.onClick();
assert.equal(page.requests.length, 0, "discard requires confirmation");
button(page.render(), "Keep draft").props.onClick();
assert(button(page.render(), "Discard draft"));
button(page.render(), "Discard draft").props.onClick();
button(page.render(), `Click again to discard ${saved.title}`).props.onClick();
assert.equal(page.requests[0].options.headers["If-Match"], saved.checksum);
await page.reply({ discarded: true });
assert.deepEqual(page.navigation, [], "malformed discard receipts cannot navigate away");
assert.equal(button(page.render(), "Discard draft").props.disabled, true);
button(page.render(), "Load latest draft").props.onClick();
page.render();
await page.reply({ draft: saved });
button(page.render(), "Discard draft").props.onClick();
button(page.render(), `Click again to discard ${saved.title}`).props.onClick();
page.unmount();
await page.reply({ discarded: { id: draft.id, title: saved.title, slug: saved.slug } });
assert.deepEqual(page.navigation, [], "late discard responses cannot redirect another page");

const removed = harness(detailPath);
removed.render();
await removed.reply({ draft });
input(removed.render()).props.onChange({ target: { value: "Keep this title" } });
button(removed.render(), "Load latest draft").props.onClick();
removed.render();
await removed.reply({ error: "gone" }, 404);
assert(
  find(
    removed.render(),
    (node) =>
      node.type === "textarea" && node.props.readOnly && node.props.value === "Keep this title",
  ),
  "a removed draft exposes the unsaved title for copying",
);

for (const invalid of [
  { ...draft, id: "ba95116e-4cba-4976-bfb1-0739d8282745" },
  { ...draft, checksum: "invalid" },
  {},
]) {
  const bad = harness(detailPath);
  bad.render();
  await bad.reply({ draft: invalid });
  assert(
    alerts(bad.render()),
    "malformed or mismatched reads recover instead of showing a spinner",
  );
  bad.unmount();
}
const oldRead = harness(detailPath);
oldRead.render();
const signal = oldRead.requests[0].options.signal;
const originalKey = oldRead.wrapper().key;
assert.notEqual(oldRead.wrapper("ba95116e-4cba-4976-bfb1-0739d8282745").key, originalKey);
oldRead.setPath(`/app/other-workspace/site/${draft.id}`);
assert.notEqual(oldRead.wrapper().key, originalKey, "draft state is scoped to workspace and ID");
oldRead.unmount();
assert(signal.aborted);
await oldRead.reply({ draft });

const indexPage = harness("src/app/admin/site/page.tsx");
indexPage.render();
await indexPage.reply({ drafts: undefined });
assert(alerts(indexPage.render()), "malformed lists cannot masquerade as an empty workspace");
button(indexPage.render(), "Retry").props.onClick();
await indexPage.reply({ drafts: [] });
for (const [placeholder, value, maxLength] of [
  ["Bookkeeping automation", "Roof inspection", 120],
  ["Home service owners", "Property owners", 160],
  ["The office runs while the crew builds", "Review the report", 500],
  ["bookkeeping-automation", " Custom-Address ", 120],
  ["Emphasize evening admin relief; keep three sections", "Extra direction", 1000],
]) {
  const field = find(
    indexPage.render(),
    (node) => node.type === "input" && node.props.placeholder === placeholder,
  );
  assert.equal(field.props.maxLength, maxLength);
  field.props.onChange({ target: { value } });
}
const submit = () =>
  find(indexPage.render(), (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
submit();
submit();
assert.equal(
  indexPage.requests.length,
  1,
  "Enter or repeated clicks submit only one create request",
);
assert.equal(
  JSON.parse(indexPage.requests[0].options.body).slug,
  "custom-address",
  "custom addresses retain existing normalization",
);
assert(
  find(indexPage.render(), (node) => node.type === "fieldset" && node.props.disabled === true),
);
await indexPage.reply({ draft: { id: "bad-receipt" } }, 201);
assert.deepEqual(indexPage.navigation, []);
assert.equal(
  button(indexPage.render(), "Create draft").props.disabled,
  true,
  "uncertain creation requires a fresh list before retrying",
);
submit();
assert.equal(indexPage.requests.length, 0);
button(indexPage.render(), "Refresh drafts").props.onClick();
await indexPage.reply({ error: "offline" }, 503);
assert.equal(button(indexPage.render(), "Create draft").props.disabled, true);
button(indexPage.render(), "Retry").props.onClick();
await indexPage.reply({
  drafts: [
    (({ id, slug, title, source, updatedAt, checksum }) => ({
      id,
      slug,
      title,
      source,
      updatedAt,
      checksum,
    }))(draft),
  ],
});
assert.equal(button(indexPage.render(), "Create draft").props.disabled, false);
assert(!alerts(indexPage.render()));
submit();
indexPage.unmount();
await indexPage.reply({ draft }, 201);
assert.deepEqual(indexPage.navigation, [], "late creation cannot move another page or workspace");

const confirmed = harness("src/app/admin/site/page.tsx");
confirmed.render();
await confirmed.reply({ drafts: [] });
for (const placeholder of [
  "Bookkeeping automation",
  "Home service owners",
  "The office runs while the crew builds",
]) {
  find(
    confirmed.render(),
    (node) => node.type === "input" && node.props.placeholder === placeholder,
  ).props.onChange({ target: { value: "A valid brief" } });
}
find(confirmed.render(), (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
await confirmed.reply({ draft }, 201);
assert.deepEqual(confirmed.navigation, [`/admin/site/${draft.id}`]);
confirmed.unmount();

const overlapping = harness("src/app/admin/site/page.tsx");
overlapping.render();
await overlapping.reply({ error: "offline" }, 503);
for (const placeholder of [
  "Bookkeeping automation",
  "Home service owners",
  "The office runs while the crew builds",
]) {
  find(
    overlapping.render(),
    (node) => node.type === "input" && node.props.placeholder === placeholder,
  ).props.onChange({ target: { value: "Valid brief" } });
}
find(overlapping.render(), (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
assert.equal(button(overlapping.render(), "Retry").props.disabled, true);
button(overlapping.render(), "Retry").props.onClick();
assert.equal(
  overlapping.requests.length,
  1,
  "a list retry cannot race a pending creation and unlock an uncertain write",
);
await overlapping.reply({ error: "uncertain" }, 503);
assert.equal(button(overlapping.render(), "Create draft").props.disabled, true);
overlapping.unmount();

const uncertainTitle = harness(detailPath);
uncertainTitle.render();
await uncertainTitle.reply({ draft });
input(uncertainTitle.render()).props.onChange({ target: { value: "Title I need" } });
button(uncertainTitle.render(), "Save title").props.onClick();
await uncertainTitle.reply({ draft: { ...draft, title: "Wrong receipt" } });
assert.equal(input(uncertainTitle.render()).props.value, "Title I need");
assert.equal(button(uncertainTitle.render(), "Save title").props.disabled, true);
button(uncertainTitle.render(), "Load latest draft").props.onClick();
uncertainTitle.render();
await uncertainTitle.reply({
  draft: {
    ...draft,
    title: "Title I need",
    document: { ...document, metadata: { ...document.metadata, title: "Title I need" } },
    checksum: "d".repeat(64),
  },
});
assert.equal(input(uncertainTitle.render()).props.value, "Title I need");
assert.equal(
  button(uncertainTitle.render(), "Save title").props.disabled,
  true,
  "a confirmed prior save is not repeated",
);
button(uncertainTitle.render(), "Discard draft").props.onClick();
button(uncertainTitle.render(), "Click again to discard Title I need").props.onClick();
await uncertainTitle.reply({
  discarded: { id: draft.id, title: "Title I need", slug: draft.slug },
});
assert.deepEqual(uncertainTitle.navigation, ["/admin/site"]);
uncertainTitle.unmount();

console.log(
  "PASS: private Site Studio read/write recovery, receipt validation, checksum review, title retention, route isolation and create form limits (actual component source).",
);
