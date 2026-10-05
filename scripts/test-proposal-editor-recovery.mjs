import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const record = (id) => ({
  id,
  title: `Proposal ${id}`,
  client_name: `Client ${id}`,
  status: "draft",
  share_token: `share-${id}`,
  total_monthly: 25,
  total_one_time: 100,
  content: { sections: [] },
});
const first = record("first"),
  second = record("second"),
  successor = record("successor");
const passthrough = ({ children }) => React.createElement("div", null, children);
const Editor = () => null;
const find = (node, predicate) => {
  if (Array.isArray(node)) return node.map((item) => find(item, predicate)).find(Boolean);
  if (!node || typeof node !== "object") return null;
  return predicate(node) ? node : find(node.props?.children, predicate);
};
function compile(path, mocks, window, navigator = {}) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiled = { exports: {} };
  const localRequire = (name) =>
    mocks[name] ||
    (name === "react/jsx-runtime" ? require(name) : new Proxy({}, { get: () => passthrough }));
  new Function("require", "module", "exports", "window", "navigator", output)(
    localRequire,
    compiled,
    compiled.exports,
    window,
    navigator,
  );
  return compiled.exports;
}
function pageHarness(patch, failRead = false) {
  const state = [[first, second], 0, 0, false, "all", first, false];
  let index = 0;
  const calls = [],
    notices = [],
    navigation = [],
    cache = [];
  const window = { location: { pathname: "/admin/proposals", search: "?proposal=first" } };
  const mocks = {
    react: {
      ...React,
      useState: () => {
        const slot = index++;
        return [
          state[slot],
          (value) => {
            state[slot] = typeof value === "function" ? value(state[slot]) : value;
          },
        ];
      },
      useEffect: () => {},
      useCallback: (callback) => callback,
    },
    "next/navigation": { useSearchParams: () => new URLSearchParams(window.location.search) },
    "framer-motion": { motion: new Proxy({}, { get: (_, tag) => tag }) },
    "@tanstack/react-query": {
      useQueryClient: () => ({ setQueryData: (...args) => cache.push(args) }),
    },
    "@/lib/admin/navigation": { adminPageName: () => "Proposals" },
    "@/lib/admin/useAdminQuery": { useAdminQuery: () => ({ data: undefined, isLoading: false }) },
    "@/components/admin/AdminLink": {
      useAdminNavigation: () => ({
        replace: (url) => {
          navigation.push(url);
          window.location.search = new URL(url, "http://fixture").search;
        },
        push: () => {},
      }),
    },
    "@/components/admin/ProposalEditor": { ProposalEditor: Editor },
    "@/lib/admin/useToast": {
      toast: new Proxy({}, { get: (_, kind) => (message) => notices.push({ kind, message }) }),
    },
    "@/lib/admin/fetchJson": {
      fetchJson: async (url, options) => {
        calls.push({ url, method: options?.method });
        if (options?.method === "PATCH") return patch();
        if (failRead) throw new Error("Read unavailable");
        return { proposals: [first, second], totalOneTime: 0, totalMonthly: 0 };
      },
    },
  };
  const Page = compile("src/app/admin/proposals/page.tsx", mocks, window).default;
  const editor = find(Page(), (node) => node.type === Editor);
  assert.equal(
    editor.key,
    first.id,
    "record changes must remount the form, not retain another proposal's inputs",
  );
  return { save: editor.props.onSave, state, calls, notices, navigation, cache, window };
}

const rejected = pageHarness(() => {
  throw new Error("Controlled write rejection");
});
await assert.rejects(rejected.save({ id: first.id }), /Controlled write rejection/);
assert.equal(
  rejected.calls.length,
  1,
  "failed writes must not start refreshes or announce success",
);
assert.deepEqual(rejected.notices, []);

const revised = pageHarness(() => ({ proposal: successor }));
await revised.save({ id: first.id });
assert.equal(revised.state[5].id, successor.id);
assert.equal(revised.navigation[0], "/admin/proposals?proposal=successor");
assert.deepEqual(revised.cache[0], [
  ["proposals", "detail", successor.id],
  { proposal: successor },
]);
assert(
  !revised.calls.some(({ url }) => url.includes("?id=")),
  "use the mutation receipt instead of rereading the old version",
);

const refreshFailure = pageHarness(() => ({ proposal: first }), true);
await refreshFailure.save({ id: first.id });
assert.equal(refreshFailure.notices[0].kind, "warning");
assert.match(refreshFailure.notices[0].message, /changes are saved/);

let finish;
const late = pageHarness(
  () =>
    new Promise((resolve) => {
      finish = resolve;
    }),
);
const pending = late.save({ id: first.id });
late.state[5] = second;
late.window.location.search = "?proposal=second";
finish({ proposal: successor });
await pending;
assert.equal(late.state[5].id, second.id);
assert.deepEqual(late.navigation, []);
assert.deepEqual(late.cache, []);

const incomplete = pageHarness(() => ({ proposal: null }));
await assert.rejects(incomplete.save({ id: first.id }), /save response is incomplete/);
assert.equal(incomplete.state[5].id, first.id);

// Execute the actual editor's clipboard handler with delayed/rejected browser promises.
const notices = [],
  selected = [];
let finishCopy;
const clipboard = {
  writeText: () =>
    new Promise((resolve, reject) => {
      finishCopy = { resolve, reject };
    }),
};
const refs = {
  current: { focus: () => selected.push("focus"), select: () => selected.push("select") },
};
const editorMocks = {
  react: { ...React, useState: (value) => [value, () => {}], useRef: () => refs },
  "next/navigation": { usePathname: () => "/t/test/admin/proposals" },
  "@/lib/admin/useToast": {
    toast: new Proxy({}, { get: (_, kind) => (message) => notices.push({ kind, message }) }),
  },
};
const { ProposalEditor } = compile(
  "src/components/admin/ProposalEditor.tsx",
  editorMocks,
  { location: { origin: "http://fixture" } },
  { clipboard },
);
const tree = ProposalEditor({ proposal: first, onSave: async () => {} });
const link = find(tree, (node) => node.props?.["aria-label"] === "Proposal share link");
assert.equal(link.props.value, "http://fixture/t/test/proposal/share-first");
const copy = find(tree, (node) => node.type === "button" && node.props.children === "Copy");
const failedCopy = copy.props.onClick();
assert.deepEqual(
  notices,
  [],
  "do not claim clipboard success while the browser promise is pending",
);
finishCopy.reject(new Error("Clipboard blocked"));
await failedCopy;
assert.deepEqual(selected, ["focus", "select"]);
assert.equal(notices[0].kind, "error");
const successfulCopy = copy.props.onClick();
finishCopy.resolve();
await successfulCopy;
assert.equal(notices[1].kind, "success");
assert.equal(notices[1].message, "Link copied");
console.log(
  "Proposal recovery passed: record identity, write rejection, successor receipt, late completion, read warning, incomplete receipt and clipboard pending/failure/success.",
);
