"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, Plus, RefreshCw, Sparkles } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { AdminDialog } from "./AdminDialog";
import { EmptyState } from "./EmptyState";
import { useAdminAI } from "./AdminAIProvider";
import Link, { useAdminNavigation } from "./AdminLink";
import { LazyCanvasView } from "@/components/canvas/LazyCanvasView";
import { CanvasComposer } from "@/components/canvas/CanvasComposer";
import { DeskCanvasContent } from "@/components/canvas/DeskCanvasContent";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { commandBoardCanvasNodes, commandBoardStations } from "@/lib/admin/command-board-canvas";
import type { DeskDatum } from "@/lib/admin/canvas-desk";
import type { CanvasNode } from "@/lib/admin/canvas-model";
import type { CommandBoardSnapshot } from "@/lib/revenue-os/command-board-contract";
import {
  COMMAND_BOARD_MODES,
  COMMAND_BOARD_MODE_KEYS,
  type CommandBoardModeKey,
} from "@/lib/revenue-os/command-board-modes";
import { adminSearchHref } from "@/lib/admin/search-href";
import { usePendingParam } from "@/hooks/usePendingParam";
import type { ActionRow } from "@/lib/admin/approval-presentation";
import { ApprovalCard } from "./ApprovalCard";

const MODES = COMMAND_BOARD_MODE_KEYS.map((id) => ({ id, ...COMMAND_BOARD_MODES[id] }));

const STATUS_LABELS = {
  ok: "On track",
  attention: "Needs you",
  blocked: "Blocked",
  idle: "Nothing open",
} as const;

const boardKeyFor = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "business";

function SetupForm({
  onInstalled,
  existingKeys,
}: {
  onInstalled(): Promise<void>;
  existingKeys: readonly string[];
}) {
  const [mode, setMode] = useState<CommandBoardModeKey>("service");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const boardKey = boardKeyFor(label);
  return (
    <form
      className="admin-content-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!label.trim() || busy) return;
        setBusy(true);
        setError("");
        try {
          await fetchJson("/api/admin/board/install", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, label: label.trim(), boardKey, requestId }),
          });
          await onInstalled();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "The mode could not be installed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="admin-field-label mb-2">Mode</legend>
        {MODES.map((option) => (
          <label
            key={option.id}
            className="admin-surface admin-surface--flat flex cursor-pointer gap-3 p-4"
            data-selected={mode === option.id || undefined}
          >
            <input
              type="radio"
              name="mode"
              value={option.id}
              checked={mode === option.id}
              onChange={() => setMode(option.id)}
            />
            <span>
              <span className="block text-sm font-semibold text-[var(--admin-ink)]">
                {option.label}
              </span>
              <span className="admin-copy mt-1 block text-xs">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="admin-field-label">
        Business name
        <input
          className="admin-field"
          value={label}
          maxLength={60}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Northline Roofing"
          required
        />
      </label>
      {existingKeys.includes(boardKey) && label.trim() && (
        <p className="admin-copy text-xs" role="status">
          A board already uses this name. Installing the same mode again changes nothing.
        </p>
      )}
      {error && (
        <p className="text-sm text-[var(--admin-danger)]" role="alert">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          className="admin-button admin-button--primary"
          disabled={busy || !label.trim()}
        >
          {busy ? "Setting up…" : "Set up board"}
        </button>
      </div>
    </form>
  );
}

export function CommandBoardWorkspace() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useAdminNavigation();
  const ai = useAdminAI();
  const scopeKey = pathname.replace(/\/board$/, "");
  const query = useAdminQuery<CommandBoardSnapshot>(
    ["admin", "command-board", scopeKey],
    "/api/admin/board",
    { refetchInterval: 60000, refetchOnWindowFocus: true, placeholderData: undefined },
  );
  const [adding, setAdding] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const snapshot = query.data;
  const nodes = useMemo(() => (snapshot ? commandBoardCanvasNodes(snapshot) : []), [snapshot]);
  const firstAnchor = nodes.find((node) => node.parentId === null)?.id ?? null;
  const scopeParam = search.get("scope");
  const scope = scopeParam === null ? firstAnchor : scopeParam || null;
  // A station opens at once; the URL records it a moment later.
  const [stationId, requestStation] = usePendingParam(search.get("station"));
  const station = (() => {
    if (!snapshot || !stationId) return null;
    for (const board of snapshot.boards)
      for (const entry of commandBoardStations(board.boardKey, board.document))
        if (entry.id === stationId) return { ...entry, board };
    return null;
  })();
  const summary = stationId ? snapshot?.summaries[stationId] : undefined;
  // Approval records render as approval cards; the shared queue read fills them.
  const actionsQuery = useAdminQuery<{ actions: ActionRow[] }>(
    ["today", "actions"],
    "/api/admin/revenue-os/actions",
    { enabled: Boolean(summary?.records.some((record) => record.sourceType === "approvals")) },
  );
  const approvals = new Map((actionsQuery.data?.actions ?? []).map((row) => [row.id, row]));
  const href = (change: (params: URLSearchParams) => void) =>
    adminSearchHref("/admin/board", search, change);
  const refresh = async () => {
    await query.refetch();
    window.dispatchEvent(new Event("admin:priority-refresh"));
  };
  const scopeLabel = nodes.find((node) => node.id === scope)?.label;

  return (
    <div className="admin-content-stack">
      <PageHeader
        title="Command Board"
        subtitle=""
        compact
        utilityActions={
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Refresh Command Board"
            disabled={query.isFetching || interacting}
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} className={query.isFetching ? "animate-spin" : undefined} />
          </button>
        }
        actions={
          snapshot?.boards.length ? (
            <button
              type="button"
              className="admin-button admin-button--secondary"
              onClick={() => setAdding(true)}
            >
              <Plus size={15} aria-hidden="true" /> Add a business
            </button>
          ) : undefined
        }
      />
      {snapshot && !snapshot.boards.length ? (
        <div className="admin-surface admin-surface--flat admin-content-stack p-6">
          <EmptyState
            title="Set up your first board"
            message="Choose a mode for a business. Its phases and stations then summarize your live tasks, opportunities, conversations, approvals and balances."
          />
          <SetupForm onInstalled={refresh} existingKeys={[]} />
        </div>
      ) : (
        <LazyCanvasView<DeskDatum>
          label="Command Board canvas"
          nodes={nodes}
          visibility="path"
          maxFrameZoom={1.5}
          renderNode={DeskCanvasContent}
          selectedId={station?.id ?? null}
          scopeId={scope}
          homeLabel="Home"
          hrefFor={({ scopeId }) =>
            href((params) => {
              params.delete("station");
              params.set("scope", scopeId ?? "");
            })
          }
          onOpen={(node: CanvasNode<DeskDatum>) => {
            requestStation(node.id);
            router.push(
              href((params) => params.set("station", node.id)),
              "preserve",
            );
          }}
          onInteractingChange={setInteracting}
          read={{
            loading: query.isPending,
            hasData: Boolean(snapshot),
            error: snapshot ? undefined : query.error?.message,
            refreshing: query.isFetching,
            onRetry: () => void refresh(),
          }}
          notice={query.error && snapshot ? query.error.message : undefined}
          empty={null}
          detail={
            station && summary
              ? {
                  title: station.station.label,
                  // Closing replaces the entry, so Back returns to the previous scope.
                  onClose: () => {
                    requestStation(null);
                    router.replace(
                      href((params) => params.delete("station")),
                      "preserve",
                    );
                  },
                  content: (
                    <div className="admin-content-stack">
                      <p className="admin-eyebrow">
                        {[station.board.document.anchor.label, ...station.path].join(" · ")}
                      </p>
                      {station.station.subtitle && (
                        <p className="admin-copy">{station.station.subtitle}</p>
                      )}
                      <p className="admin-canvas-status-pill" data-status={summary.status}>
                        {STATUS_LABELS[summary.status]}
                      </p>
                      <dl className="space-y-2">
                        {summary.rows.map((row) => (
                          <div key={row.label}>
                            <dt className="admin-field-label">{row.label}</dt>
                            <dd className="text-sm text-[var(--admin-ink)]">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                      {summary.unavailable.length > 0 && (
                        <p className="admin-copy text-xs" role="status">
                          Unavailable right now: {summary.unavailable.join(", ")}. Counts may be
                          incomplete.
                        </p>
                      )}
                      {summary.records.length > 0 && (
                        <section aria-label="Matching records">
                          <h3 className="admin-field-label mb-2">Matching records</h3>
                          <ul className="space-y-1">
                            {summary.records.map((record) => {
                              const approval =
                                record.sourceType === "approvals"
                                  ? approvals.get(record.sourceId)
                                  : undefined;
                              return (
                                <li key={`${record.sourceType}:${record.sourceId}`}>
                                  <Link
                                    href={record.href}
                                    aria-label={approval ? `Review ${approval.title}` : undefined}
                                    className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--admin-radius-control)] px-3 text-sm text-[var(--admin-ink)] hover:bg-[var(--admin-surface-subtle)] data-[approval]:py-2.5"
                                    data-approval={approval ? "" : undefined}
                                  >
                                    {approval ? (
                                      <ApprovalCard action={approval} />
                                    ) : (
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium">
                                          {record.title}
                                        </span>
                                        {record.detail && (
                                          <span className="block truncate text-xs text-[var(--admin-muted)]">
                                            {record.detail}
                                          </span>
                                        )}
                                      </span>
                                    )}
                                    <ArrowRight size={14} aria-hidden="true" className="shrink-0" />
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      )}
                      {station.station.skills.length > 0 && (
                        <section aria-label="Skills">
                          <h3 className="admin-field-label mb-2">Skills</h3>
                          <ul className="flex flex-wrap gap-2">
                            {station.station.skills.map((skill) => (
                              <li
                                key={skill}
                                className="rounded-[var(--admin-radius-pill)] px-3 py-1 text-xs shadow-[var(--admin-shadow-border)]"
                              >
                                {skill} · {snapshot?.skills[skill] ? "Ready" : "Not set up"}
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                      <button
                        type="button"
                        className="admin-button admin-button--secondary"
                        onClick={() =>
                          ai.openWithPrompt(
                            `Help me with the ${station.station.label} station on the ${station.board.document.anchor.label} board. It shows: ${summary.rows.map((row) => `${row.label}: ${row.value}`).join("; ")}. Read the matching records and suggest the next step for my review.`,
                          )
                        }
                      >
                        <Sparkles size={14} aria-hidden="true" /> Ask AI about this station
                      </button>
                    </div>
                  ),
                }
              : null
          }
          overlay={
            <CanvasComposer
              label="Ask about this board"
              placeholder="Ask your data..."
              onSubmit={(text) =>
                ai.openWithPrompt(
                  scopeLabel ? `About ${scopeLabel} on the Command Board: ${text}` : text,
                )
              }
            />
          }
        />
      )}
      <AdminDialog open={adding} onClose={() => setAdding(false)} title="Add a business">
        <div className="admin-surface admin-surface--flat admin-content-stack p-6">
          <h2 className="text-lg font-semibold text-[var(--admin-ink)]">Add a business</h2>
          <SetupForm
            existingKeys={snapshot?.boards.map((board) => board.boardKey) ?? []}
            onInstalled={async () => {
              setAdding(false);
              await refresh();
            }}
          />
        </div>
      </AdminDialog>
    </div>
  );
}
