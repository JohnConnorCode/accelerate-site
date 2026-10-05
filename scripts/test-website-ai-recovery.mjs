import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";
import { fictionalWebsite } from "../src/lib/admin/demo/website-runtime.ts";
import * as authoring from "../src/lib/site-studio/website-authoring.ts";
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
  new Function("require", "module", "exports", "fetch", output)(
    (name) =>
      mocks[name] ??
      (name.startsWith(".") || name.startsWith("@/")
        ? new Proxy({}, { get: () => stub })
        : require(name)),
    compiled,
    compiled.exports,
    (...args) => mocks.fetch(...args),
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
    cleanups = [];
  let stateIndex = 0,
    refIndex = 0,
    mounted = false;
  return {
    state,
    cleanups,
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
        if (!mounted) cleanups.push(callback());
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
console.log(
  "Website AI recovery passed: custom addresses, section limit, page identity, cancellation/late replies, stale review, apply, unmount and gateway/route abort propagation.",
);
