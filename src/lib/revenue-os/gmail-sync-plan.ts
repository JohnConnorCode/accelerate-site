/**
 * Pure planning for bounded Gmail thread synchronization.
 *
 * Gmail returns history entries in cursor order, while thread-list responses
 * are newest-first.  Keeping that provider detail here means the sync adapter
 * can focus on fetching and storing records; the cursor/backlog contract stays
 * deterministic and easy to test.
 */

export type GmailSyncMode = "initial" | "incremental" | "recovery";

export interface GmailHistoryPage {
  history?: Array<{
    messagesAdded?: Array<{ message?: { threadId?: string | null } | null }>;
  }>;
  nextPageToken?: string | null;
}

export interface GmailThreadListPage {
  threads?: Array<{ id?: string | null } | null>;
  resultSizeEstimate?: number | null;
  nextPageToken?: string | null;
}

export interface GmailSyncPlanInput {
  /** The last successful history cursor, if one exists. */
  cursor?: string | null;
  /** A history page fetched with `cursor`, when the cursor is usable. */
  history?: GmailHistoryPage | null;
  /** A bounded thread-list page used for initial sync or recovery. */
  list?: GmailThreadListPage | null;
  /** Gmail's cursor request failed because the cursor is stale/expired. */
  cursorExpired?: boolean;
  /** Maximum number of threads the caller may fetch/store in this run. */
  maxThreads?: number;
}

export interface GmailSyncPlan {
  mode: GmailSyncMode;
  threadIds: string[];
  deferred: boolean;
  /** A cursor can advance only when this bounded page has no remainder. */
  cursorAdvanceSafe: boolean;
  deferReason: "history_page" | "list_page" | null;
}

function boundedLimit(maxThreads: number | undefined): number {
  if (!Number.isFinite(maxThreads)) return 75;
  return Math.max(1, Math.min(100, Math.floor(maxThreads as number)));
}

function uniqueBounded(ids: Array<string | null | undefined>, limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of ids) {
    const id = typeof candidate === "string" ? candidate.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= limit) break;
  }
  return result;
}

export function gmailThreadIdsFromHistoryPage(history: GmailHistoryPage | null | undefined, maxThreads = 100): string[] {
  const ids = history?.history?.flatMap((entry) =>
    (entry.messagesAdded ?? []).map((added) => added.message?.threadId),
  ) ?? [];
  return uniqueBounded(ids, boundedLimit(maxThreads));
}

export function gmailThreadIdsFromListPage(list: GmailThreadListPage | null | undefined, maxThreads = 100): string[] {
  // Gmail's list endpoint is newest-first. Process oldest first so a partial
  // run makes steady progress through the backlog and keeps operator history
  // chronological.
  const ids = (list?.threads ?? []).map((thread) => thread?.id).reverse();
  return uniqueBounded(ids, boundedLimit(maxThreads));
}

export function planGmailThreadSync(input: GmailSyncPlanInput): GmailSyncPlan {
  const limit = boundedLimit(input.maxThreads);
  const hasCursor = Boolean(input.cursor?.trim());
  const recovery = hasCursor && Boolean(input.cursorExpired);
  const incremental = hasCursor && !recovery && Boolean(input.history);
  const mode: GmailSyncMode = recovery ? "recovery" : incremental ? "incremental" : "initial";

  if (incremental) {
    const threadIds = gmailThreadIdsFromHistoryPage(input.history, limit);
    const deferred = Boolean(input.history?.nextPageToken);
    return {
      mode,
      threadIds,
      deferred,
      cursorAdvanceSafe: !deferred,
      deferReason: deferred ? "history_page" : null,
    };
  }

  const threadIds = gmailThreadIdsFromListPage(input.list, limit);
  const listCount = input.list?.threads?.filter((thread) => Boolean(thread?.id)).length ?? 0;
  const estimateExceedsPage = Number(input.list?.resultSizeEstimate ?? 0) > listCount;
  // A caller can intentionally bound a response below the provider page. The
  // truncation itself is backlog, even when Gmail omitted a next-page token.
  const boundedByRunLimit = listCount > limit;
  const deferred = Boolean(input.list?.nextPageToken) || estimateExceedsPage || boundedByRunLimit;
  return {
    mode,
    threadIds,
    deferred,
    cursorAdvanceSafe: !deferred,
    deferReason: deferred ? "list_page" : null,
  };
}
