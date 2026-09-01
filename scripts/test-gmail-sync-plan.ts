import assert from "node:assert/strict";
import {
  gmailThreadIdsFromHistoryPage,
  gmailThreadIdsFromListPage,
  planGmailThreadSync,
} from "../src/lib/revenue-os/gmail-sync-plan";

assert.deepEqual(
  gmailThreadIdsFromHistoryPage({
    history: [
      { messagesAdded: [{ message: { threadId: "oldest" } }, { message: { threadId: "shared" } }] },
      { messagesAdded: [{ message: { threadId: "shared" } }, { message: { threadId: "newest" } }] },
    ],
  }),
  ["oldest", "shared", "newest"],
);

assert.deepEqual(
  gmailThreadIdsFromListPage({
    threads: [{ id: "newest" }, { id: "shared" }, { id: "shared" }, { id: "oldest" }],
  }),
  ["oldest", "shared", "newest"],
);

assert.deepEqual(
  planGmailThreadSync({
    cursor: "history-1",
    history: { history: [{ messagesAdded: [{ message: { threadId: "t1" } }] }] },
  }),
  {
    mode: "incremental",
    threadIds: ["t1"],
    deferred: false,
    cursorAdvanceSafe: true,
    deferReason: null,
  },
);

assert.deepEqual(
  planGmailThreadSync({ cursor: "history-1", history: { nextPageToken: "page-2", history: [] } }),
  {
    mode: "incremental",
    threadIds: [],
    deferred: true,
    cursorAdvanceSafe: false,
    deferReason: "history_page",
  },
);

assert.deepEqual(
  planGmailThreadSync({
    list: { threads: [{ id: "newest" }, { id: "oldest" }], resultSizeEstimate: 2 },
    maxThreads: 1,
  }),
  {
    mode: "initial",
    threadIds: ["oldest"],
    deferred: true,
    cursorAdvanceSafe: false,
    deferReason: "list_page",
  },
);

assert.deepEqual(
  planGmailThreadSync({
    cursor: "expired",
    cursorExpired: true,
    list: { threads: [{ id: "newest" }], resultSizeEstimate: 4 },
  }),
  {
    mode: "recovery",
    threadIds: ["newest"],
    deferred: true,
    cursorAdvanceSafe: false,
    deferReason: "list_page",
  },
);

assert.deepEqual(
  planGmailThreadSync({
    cursor: "history-1",
    cursorExpired: true,
    history: { history: [{ messagesAdded: [{ message: { threadId: "ignored" } }] }] },
    list: { threads: [{ id: "fallback" }] },
  }),
  {
    mode: "recovery",
    threadIds: ["fallback"],
    deferred: false,
    cursorAdvanceSafe: true,
    deferReason: null,
  },
);

console.log(JSON.stringify({ cases: 6, result: "gmail sync planning passed" }));
