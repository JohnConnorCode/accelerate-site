"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Pin, RefreshCw, Sparkles, X } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { AdminDialog } from "./AdminDialog";
import { AdminAsyncRegion } from "./AdminAsyncRegion";
import { ActionReviewDialog, type ActionRow } from "./ActionReviewDialog";
import { TodayViewEditor } from "./TodayViewEditor";
import { useAdminAI } from "./AdminAIProvider";
import LegacyToday from "./LegacyToday";
import Link, { useAdminNavigation } from "./AdminLink";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { cn } from "@/lib/utils";
import {
  defaultTodayViews,
  defaultTodayView,
  attentionKey,
  attentionFingerprint,
  filterTodayItems,
  TODAY_MODULES,
  type TodayModule,
  type TodayView,
  type TodayViews,
  type TodayScope,
  type TodayDocument,
  type TodaySavedState,
} from "@/lib/admin/today-workspace";
import type { TodaySnapshot, TodayFact, TodayRegion } from "@/lib/admin/today-data";
import type { OperatorAttentionItem } from "@/lib/revenue-os/operator-attention";
import styles from "./TodayWorkspace.module.css";

function dateLabel(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Time unavailable";
  return new Date(value).toLocaleDateString(
    undefined,
    options ?? { month: "short", day: "numeric" },
  );
}
function Card({
  module,
  count,
  children,
  footer,
}: {
  module: TodayModule;
  count?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className={styles.card} data-today-module={module.type}>
      <header className={styles.cardHeader}>
        <h2>{TODAY_MODULES.find((m) => m.id === module.type)?.name}</h2>
        {count !== undefined && <span className={styles.count}>{count}</span>}
      </header>
      {children}
      {footer && <footer className={styles.cardFooter}>{footer}</footer>}
    </section>
  );
}
function SourceState({ region }: { region: TodayRegion<unknown> }) {
  return region.state === "unavailable" || region.state === "partial" ? (
    <div className={styles.quiet}>
      <p className={styles.muted}>
        {region.message || "Some context is unavailable. Refresh to try again."}
      </p>
    </div>
  ) : null;
}

export function TodayWorkspace() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useAdminNavigation();
  const ai = useAdminAI();
  const scopeKey = pathname.replace(/\/today$/, "");
  const query = useAdminQuery<TodaySnapshot>(
    ["today-workspace", scopeKey],
    "/api/admin/revenue-os/today",
    {
      placeholderData: undefined,
      refetchInterval: 60000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  );
  const viewsQuery = useAdminQuery<TodayViews>(
    ["today-views", scopeKey],
    "/api/admin/revenue-os/today/views",
    { placeholderData: undefined, refetchOnWindowFocus: true },
  );
  const actionsQuery = useAdminQuery<{ actions: ActionRow[] }>(
    ["today", "actions"],
    "/api/admin/revenue-os/actions",
    { refetchInterval: 60000, refetchOnWindowFocus: true },
  );
  const views = viewsQuery.data ?? defaultTodayViews();
  const [chosenView, setChosenView] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TodaySnapshot | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [editor, setEditor] = useState<{
    view: TodayView;
    scope: TodayScope;
    session: number;
  } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<OperatorAttentionItem | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [fact, setFact] = useState<TodayFact | null>(null);
  const [factOpen, setFactOpen] = useState(false);
  const [reviewing, setReviewing] = useState<ActionRow | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [allAttention, setAllAttention] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dismissedAction = useRef<string | null>(null);
  const pendingSave = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const editing = editorOpen || inspectorOpen || reviewOpen || factOpen || busy;
  useEffect(() => {
    if (query.data && (!snapshot || (!editing && !interacting))) setSnapshot(query.data);
  }, [query.data, editing, interacting, snapshot]);
  useEffect(() => {
    setSnapshot(null);
    setChosenView(null);
    setSelected(null);
    setInspectorOpen(false);
    setEditorOpen(false);
    setFactOpen(false);
    setReviewOpen(false);
    dismissedAction.current = null;
  }, [scopeKey]);
  const choices = useMemo(
    () => [
      ...views.personal.document.views.map((view) => ({
        view,
        scope: "personal" as const,
        key: "personal:" + view.id,
      })),
      ...views.workspace.document.views.map((view) => ({
        view,
        scope: "workspace" as const,
        key: "workspace:" + view.id,
      })),
    ],
    [views],
  );
  const defaultId = views.personal.document.defaultViewId;
  const current = choices.find((entry) => entry.key === chosenView) ??
    choices.find((entry) => entry.key === defaultId) ??
    choices.find((entry) => entry.key === "workspace:" + views.workspace.document.defaultViewId) ??
    choices[0] ?? {
      key: "workspace:business",
      scope: "workspace" as const,
      view: defaultTodayView(),
    };
  const preferences = views.personal.document;
  const items = snapshot?.attention.data ?? [];
  const focus = search.get("focus");
  const focusKinds =
    focus === "approvals" || focus === "approval"
      ? ["decision"]
      : focus === "commitments"
        ? ["work", "upcoming"]
        : [];
  const pendingActions = (actionsQuery.data?.actions ?? []).filter(
    (action) =>
      action.status === "pending" &&
      (!action.expires_at || Date.parse(action.expires_at) > Date.now()),
  );
  useEffect(() => {
    const id = search.get("action");
    // A local open can precede its URL transition. Retain an explicit dismissal
    // while that navigation is pending so a late action query cannot reopen it.
    if (!id) return;
    if (dismissedAction.current === id) return;
    const action = pendingActions.find((row) => row.id === id);
    if (action) {
      setReviewing(action);
      setReviewOpen(true);
    }
  }, [search, pendingActions]);
  const closeReview = () => {
    dismissedAction.current = reviewing?.id ?? search.get("action");
    setReviewOpen(false);
    router.replace("/admin/today?focus=approval", "preserve");
  };
  async function refresh() {
    const [next] = await Promise.all([query.refetch(), actionsQuery.refetch()]);
    if (next.data && !editing) setSnapshot(next.data);
  }
  async function saveDocument(scope: TodayScope, document: TodayDocument) {
    if (!viewsQuery.data || viewsQuery.error)
      throw new Error("Reload your saved views before making changes.");
    const revision = viewsQuery.data[scope].revision;
    const fingerprint = JSON.stringify({ scope, revision, document });
    if (pendingSave.current?.fingerprint !== fingerprint)
      pendingSave.current = { fingerprint, requestId: crypto.randomUUID() };
    const saved = await fetchJson<TodaySavedState>("/api/admin/revenue-os/today/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, revision, document, requestId: pendingSave.current.requestId }),
    });
    pendingSave.current = null;
    await viewsQuery.refetch();
    setNotice("View saved.");
    return saved;
  }
  async function saveView(view: TodayView, scope: TodayScope, makeDefault: boolean) {
    const document = views[scope].document;
    const savedView =
      current.scope !== scope && view.id === current.view.id
        ? { ...view, id: crypto.randomUUID() }
        : view;
    await saveDocument(scope, {
      ...document,
      views: [...document.views.filter((v) => v.id !== savedView.id), savedView],
      defaultViewId: makeDefault
        ? scope === "personal"
          ? "personal:" + savedView.id
          : savedView.id
        : document.defaultViewId,
    });
    setChosenView(scope + ":" + savedView.id);
  }
  function customize(view: TodayView = current.view, scope: TodayScope = current.scope) {
    setEditor({ view: structuredClone(view), scope, session: Date.now() });
    setEditorOpen(true);
  }
  async function mutate(action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setNotice(message);
      await refresh();
      window.dispatchEvent(new Event("admin:priority-refresh"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "This change could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  function review(item: OperatorAttentionItem) {
    const action = pendingActions.find((row) => row.id === item.sourceId);
    if (!action) {
      setError("This approval is no longer pending. Refresh to check its current state.");
      return;
    }
    dismissedAction.current = null;
    setReviewing(action);
    setReviewOpen(true);
    router.push("/admin/today?focus=approval&action=" + encodeURIComponent(action.id), "preserve");
  }
  function inspect(item: OperatorAttentionItem) {
    setSelected(item);
    setSnoozeDate("");
    setInspectorOpen(true);
  }
  function ask(prompt: string) {
    ai.openWithPrompt(prompt);
  }
  function rows(module: TodayModule, kind: "attention" | "upcoming" | "changes") {
    const base =
      allAttention && kind === "attention"
        ? items
        : items.filter((item) =>
            kind === "upcoming"
              ? item.attentionKind === "upcoming"
              : kind === "changes"
                ? item.attentionKind === "watch"
                : ["decision", "work"].includes(item.attentionKind),
          );
    const unfiltered = allAttention && kind === "attention";
    const filtered = (
      unfiltered ? base : filterTodayItems(base, module, preferences, new Date())
    ).filter((item) => unfiltered || !focusKinds.length || focusKinds.includes(item.attentionKind));
    return { filtered, displayed: filtered.slice(0, unfiltered ? filtered.length : module.limit) };
  }
  function renderRows(module: TodayModule, kind: "attention" | "upcoming" | "changes") {
    const { filtered, displayed } = rows(module, kind);
    return (
      <Card
        module={module}
        count={filtered.length}
        footer={
          filtered.length > module.limit ? (
            <Link
              className={styles.textLink}
              href={kind === "upcoming" ? "/admin/bookings" : "/admin/work"}
            >
              View more <ArrowRight size={13} />
            </Link>
          ) : undefined
        }
      >
        {snapshot && <SourceState region={snapshot.attention} />}
        {displayed.length ? (
          <div className={styles.rows}>
            {displayed.map((item) => {
              return (
                <article
                  key={attentionKey(item)}
                  className={styles.row}
                  data-attention-kind={item.attentionKind}
                  data-source-type={item.sourceType}
                  data-source-id={item.sourceId}
                >
                  <button
                    className={styles.rowMain}
                    onClick={() => inspect(item)}
                    aria-label={"Inspect " + item.title}
                  >
                    <strong>{item.title}</strong>
                    <p>{item.priorityReason}</p>
                    <span className={styles.rowMeta}>
                      <span
                        className={cn(
                          styles.badge,
                          ["critical", "high"].includes(item.urgency) && styles.urgent,
                        )}
                      >
                        {item.attentionKind === "decision"
                          ? "Decision"
                          : item.urgency === "critical"
                            ? "Urgent"
                            : item.attentionKind === "work"
                              ? "Your work"
                              : item.sourceType.replaceAll("_", " ")}
                      </span>
                      {item.dueAt && <span>{dateLabel(item.dueAt)}</span>}
                      {preferences.pins.includes(attentionKey(item)) && <Pin size={11} />}
                    </span>
                  </button>
                  <button
                    className={cn(styles.textLink, styles.rowAction)}
                    aria-label={
                      (item.attentionKind === "decision" ? "Review " : "Open ") + item.title
                    }
                    onClick={() =>
                      item.attentionKind === "decision" ? review(item) : inspect(item)
                    }
                  >
                    {item.attentionKind === "decision" ? "Review" : "Open"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : kind === "attention" ? (
          <div className={styles.quietHero}>
            <h3>
              {snapshot?.attention.state === "unavailable"
                ? "Queue unavailable"
                : "No attention items in this view"}
            </h3>
            <p>
              {snapshot?.attention.state === "unavailable"
                ? "We couldn’t read the queue. You can still open your work or retry the connection."
                : "Open your work or choose a next step."}
            </p>
            <div className={styles.toolbarGroup}>
              <Link href="/admin/work" className={styles.button}>
                Open work <ArrowRight size={14} />
              </Link>
              <button
                className={styles.textLink}
                onClick={() =>
                  ask(
                    "Help me choose the most useful next step from the available business context.",
                  )
                }
              >
                Plan my next step <Sparkles size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.quiet}>
            <p className={styles.muted}>
              {kind === "upcoming"
                ? "No upcoming commitments in this view."
                : "No new signals in this view."}
            </p>
          </div>
        )}
      </Card>
    );
  }
  function moduleContent(module: TodayModule) {
    if (!snapshot) return null;
    if (module.type === "attention" || module.type === "changes" || module.type === "upcoming")
      return renderRows(module, module.type);
    if (module.type === "brief") {
      const interpretations = snapshot.brief.data?.interpretations ?? [];
      return (
        <section className={cn(styles.card, styles.brief)} data-today-module="brief">
          <div className={styles.briefTop}>
            <h2>Business snapshot</h2>
            <span className={styles.muted}>
              Updated{" "}
              {new Date(snapshot.generatedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          <SourceState region={snapshot.attention} />
          <SourceState region={snapshot.metrics} />
          <div className={styles.briefFacts}>
            <Link className={styles.factButton} href="/admin/today?focus=approval">
              <span>Awaiting your decision</span>
              <strong>
                {snapshot.attention.state === "unavailable"
                  ? "—"
                  : items.filter((item) => item.attentionKind === "decision").length}
              </strong>
              <span>Review approvals</span>
            </Link>
            <Link className={styles.factButton} href="/admin/work">
              <span>Needs follow-up</span>
              <strong>
                {snapshot.attention.state === "unavailable"
                  ? "—"
                  : items.filter((item) => item.attentionKind === "work").length}
              </strong>
              <span>Open work</span>
            </Link>
            <Link className={styles.factButton} href="/admin/pipeline">
              <span>Open opportunities</span>
              <strong>{snapshot.metrics.data?.openOpportunities ?? "—"}</strong>
              <span>View pipeline</span>
            </Link>
            <Link className={styles.factButton} href="/admin/pipeline">
              <span>Pipeline value</span>
              <strong>
                {snapshot.metrics.data
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                      notation: "compact",
                    }).format(snapshot.metrics.data.pipelineValue)
                  : "—"}
              </strong>
              <span>Explore opportunities</span>
            </Link>
          </div>
          {interpretations.map((entry, i) => (
            <div key={i} className={styles.sourceBox}>
              <p className={styles.eyebrow}>AI INTERPRETATION</p>
              <strong>{entry.title}</strong>
              <p className={styles.muted}>{entry.explanation}</p>
              {entry.sourceIds.map((id) => (
                <button
                  key={id}
                  className={styles.textLink}
                  onClick={() => {
                    setFact(snapshot.facts.data.find((f) => f.id === id) ?? null);
                    setFactOpen(true);
                  }}
                >
                  View supporting source
                </button>
              ))}
            </div>
          ))}
        </section>
      );
    }
    if (module.type === "handling") {
      const work = snapshot.handling.data.slice(0, module.limit);
      return (
        <Card module={module} count={work.length}>
          <SourceState region={snapshot.handling} />
          {work.length ? (
            <div className={styles.rows}>
              {work.map((item) => (
                <article className={styles.row} key={item.id}>
                  <div className={styles.rowMain}>
                    <Link href={item.href}>
                      <strong>{item.title}</strong>
                    </Link>
                    <span className={styles.rowMeta}>
                      <span>{item.owner}</span>
                      <span className={styles.badge}>{item.status.replaceAll("_", " ")}</span>
                    </span>
                    {item.nextCheckAt && (
                      <p>
                        Next check {dateLabel(item.nextCheckAt)}
                        {item.nextCheckReason ? " · " + item.nextCheckReason : ""}
                      </p>
                    )}
                    {item.outcome && !item.outcome.startsWith("{") && (
                      <p>{item.outcome.slice(0, 180)}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.quiet}>
              <p className={styles.muted}>No delegated work or results to show.</p>
            </div>
          )}
        </Card>
      );
    }
    if (module.type === "activity")
      return (
        <Card module={module}>
          <SourceState region={snapshot.activity} />
          {snapshot.activity.data.length ? (
            <div className={styles.rows}>
              {snapshot.activity.data.slice(0, module.limit).map((item) => (
                <Link key={item.id} href={item.href} className={styles.row}>
                  <div className={styles.rowMain}>
                    <strong>{item.title}</strong>
                    <span className={styles.rowMeta}>{dateLabel(item.at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.quiet}>
              <p className={styles.muted}>Your next completed action starts the story here.</p>
            </div>
          )}
        </Card>
      );
    if (module.type === "apps")
      return (
        <Card module={module}>
          <SourceState region={snapshot.apps} />
          {snapshot.apps.data.length ? (
            <div className={styles.rows}>
              {snapshot.apps.data.map((app) => (
                <div key={app.id}>
                  <div className={styles.cardFooter}>
                    <Link className={styles.textLink} href={app.href}>
                      {app.name}
                    </Link>
                    <span>
                      {app.state === "unavailable"
                        ? "Unavailable"
                        : app.items.length + " to review"}
                    </span>
                  </div>
                  {app.items.slice(0, module.limit).map((item) => (
                    <Link key={item.id} className={styles.row} href={item.href}>
                      <div className={styles.rowMain}>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.quiet}>
              <div>
                <p className={styles.muted}>Bring follow-up from your business Apps into Today.</p>
                <Link href="/admin/integrations" className={styles.textLink}>
                  Explore Apps <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}
        </Card>
      );
    if (module.type === "metrics")
      return (
        <Card module={module}>
          <SourceState region={snapshot.metrics} />
          {snapshot.metrics.data && (
            <>
              <dl className={styles.stats}>
                <div>
                  <dt>Open opportunities</dt>
                  <dd>{snapshot.metrics.data.openOpportunities}</dd>
                </div>
                <div>
                  <dt>Pipeline value</dt>
                  <dd>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                      notation: "compact",
                    }).format(snapshot.metrics.data.pipelineValue)}
                  </dd>
                </div>
              </dl>
              <div className={styles.cardFooter}>
                Up to 1,000 inspected records{" "}
                <Link href="/admin/pipeline" className={styles.textLink}>
                  Pipeline <ArrowRight size={12} />
                </Link>
              </div>
            </>
          )}
        </Card>
      );
    return (
      <Card module={module}>
        <div className={styles.quietHero}>
          <div className={styles.toolbarGroup}>
            {["What should I focus on?", "Prepare a follow-up", "What changed recently?"].map(
              (prompt) => (
                <button key={prompt} className={styles.button} onClick={() => ask(prompt)}>
                  {prompt}
                </button>
              ),
            )}
          </div>
        </div>
      </Card>
    );
  }
  if (viewsQuery.data && !views.workspace.document.enabled)
    return (
      <>
        <div className={styles.notice}>
          <span>Classic Today is enabled for this workspace.</span>
          <button
            className={styles.button}
            onClick={() =>
              void mutate(
                () => saveDocument("workspace", { ...views.workspace.document, enabled: true }),
                "New workspace enabled.",
              )
            }
          >
            Use new Today
          </button>
        </div>
        <LegacyToday />
      </>
    );
  return (
    <div
      className={cn(styles.workspace, current.view.density === "compact" && styles.compact)}
      data-today-workspace
    >
      <PageHeader
        title="Today"
        subtitle=""
        eyebrow={false}
        compact
        utilityActions={
          <button
            className={styles.iconButton}
            aria-label="Refresh Today"
            disabled={query.isFetching}
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} />
          </button>
        }
        actions={
          <>
            <select
              className={styles.viewSelect}
              aria-label="Today view"
              value={current.key}
              onChange={(e) => {
                setChosenView(e.target.value);
                setAllAttention(false);
              }}
            >
              {choices.length ? (
                choices.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.view.name}
                    {entry.scope === "personal" ? " · Personal" : ""}
                  </option>
                ))
              ) : (
                <option value={current.key}>Business overview</option>
              )}
            </select>
            <button
              className={styles.button}
              disabled={!viewsQuery.data}
              onClick={() => customize()}
            >
              Customize
            </button>
            <select
              className={styles.viewActions}
              aria-label="View actions"
              value=""
              disabled={!viewsQuery.data}
              onChange={(event) => {
                if (event.target.value === "new")
                  customize(
                    { ...defaultTodayView(), id: crypto.randomUUID(), name: "My day" },
                    "personal",
                  );
                if (event.target.value === "duplicate")
                  customize(
                    {
                      ...current.view,
                      id: crypto.randomUUID(),
                      name: (current.view.name + " copy").slice(0, 60),
                    },
                    "personal",
                  );
                if (event.target.value === "delete") setConfirmDelete(true);
                if (event.target.value === "all") {
                  setAllAttention(true);
                  if (focus) router.replace("/admin/today", "preserve");
                }
              }}
            >
              <option value="" disabled>
                More
              </option>
              <option value="new">New view</option>
              <option value="duplicate">Duplicate view</option>
              <option
                value="delete"
                disabled={current.scope === "workspace" && !views.canManageWorkspace}
              >
                Delete view
              </option>
              <option value="all">Show all attention</option>
            </select>
          </>
        }
      />
      {(error || query.error || viewsQuery.error) && (
        <div className={styles.error} role="alert">
          {error || query.error?.message || viewsQuery.error?.message}{" "}
          <button
            className={styles.textLink}
            onClick={() => {
              setError("");
              void refresh();
              void viewsQuery.refetch();
            }}
          >
            Retry <RefreshCw size={12} />
          </button>
        </div>
      )}
      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <button
            className={styles.iconButton}
            aria-label="Dismiss notice"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {snapshot && query.data && query.data !== snapshot && (
        <div className={styles.notice}>
          <span>New context is available. Your current work is held in place.</span>
          <button
            className={styles.button}
            disabled={editing}
            onClick={() => setSnapshot(query.data!)}
          >
            Show updates
          </button>
        </div>
      )}
      {(allAttention || focus) && (
        <div className={styles.notice}>
          <span>
            {allAttention
              ? "Showing all attention, including hidden and muted items."
              : "Showing the requested focus."}
          </span>
          <button
            className={styles.textLink}
            onClick={() => {
              setAllAttention(false);
              router.replace("/admin/today", "preserve");
            }}
          >
            Clear
          </button>
        </div>
      )}
      <AdminAsyncRegion
        loading={query.isPending}
        hasData={Boolean(snapshot)}
        label="Loading Today"
        loadingFallback={<div className={styles.skeleton} />}
      >
        {snapshot && (
          <div
            className={styles.grid}
            onPointerEnter={() => setInteracting(true)}
            onPointerLeave={() => setInteracting(false)}
            onFocusCapture={() => setInteracting(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setInteracting(false);
            }}
          >
            {allAttention && (
              <div className={styles.full} id="today-attention">
                {renderRows(
                  { ...defaultTodayView().modules[1]!, limit: items.length || 1 },
                  "attention",
                )}
              </div>
            )}
            {current.view.modules
              .filter((m) => !allAttention || m.type !== "attention")
              .map((module) => (
                <div key={module.id} className={styles[module.width]}>
                  {moduleContent(module)}
                </div>
              ))}
          </div>
        )}
      </AdminAsyncRegion>
      {viewsQuery.data && (
        <footer className={styles.cardFooter}>
          <div className={styles.toolbarGroup}>
            {preferences.muted.length > 0 && (
              <button
                className={styles.textLink}
                onClick={() =>
                  void mutate(
                    () => saveDocument("personal", { ...preferences, muted: [] }),
                    "Muted findings restored.",
                  )
                }
              >
                Restore muted findings
              </button>
            )}
            {views.canManageWorkspace && (
              <button
                className={styles.textLink}
                onClick={() =>
                  void mutate(
                    () =>
                      saveDocument("workspace", { ...views.workspace.document, enabled: false }),
                    "Classic Today enabled.",
                  )
                }
              >
                Use classic Today
              </button>
            )}
          </div>
        </footer>
      )}
      {editor && (
        <TodayViewEditor
          key={editor.session}
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          initial={editor.view}
          scope={editor.scope}
          canManageWorkspace={views.canManageWorkspace}
          onSave={saveView}
          userId={views.userId}
          sources={Array.from(new Set(items.map((item) => item.sourceType)))}
        />
      )}
      <AdminDialog
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        title="Work context"
        align="right"
        maxWidth="md"
      >
        <div className={styles.inspector}>
          {selected && (
            <>
              <div className={styles.toolbarGroup}>
                <span className={styles.eyebrow}>{selected.sourceType.replaceAll("_", " ")}</span>
                <button
                  className={cn(styles.iconButton, "ml-auto")}
                  aria-label="Close work context"
                  onClick={() => setInspectorOpen(false)}
                >
                  <X size={19} />
                </button>
              </div>
              <h2>{selected.title}</h2>
              <p>{selected.summary}</p>
              <h3>Why this matters</h3>
              <p>{selected.priorityReason}</p>
              <h3>Suggested next step</h3>
              <p>{selected.recommendedNextAction}</p>
              <div className={styles.sourceBox}>
                Source observed {dateLabel(selected.sourceTimestamp)}
                {selected.dueAt && " · Due " + dateLabel(selected.dueAt)}
                <br />
                <Link className={styles.textLink} href={selected.href}>
                  Open original record <ArrowRight size={13} />
                </Link>
              </div>
              {selected.entityId && (
                <>
                  <h3>Related context</h3>
                  {items
                    .filter(
                      (item) =>
                        item.entityId === selected.entityId &&
                        item.entityType === selected.entityType &&
                        attentionKey(item) !== attentionKey(selected),
                    )
                    .map((item) => (
                      <button
                        key={item.id}
                        className={styles.textLink}
                        onClick={() => setSelected(item)}
                      >
                        {item.title}
                      </button>
                    ))}
                </>
              )}
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <div className={styles.inspectorActions}>
                {selected.attentionKind === "decision" && (
                  <button className={styles.primaryButton} onClick={() => review(selected)}>
                    Review exact change <ArrowRight size={14} />
                  </button>
                )}
                {selected.sourceType === "task" && (
                  <button
                    className={styles.primaryButton}
                    disabled={busy}
                    onClick={() =>
                      void mutate(async () => {
                        await fetchJson("/api/admin/revenue-os/tasks", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: selected.sourceId, action: "complete" }),
                        });
                        setInspectorOpen(false);
                      }, "Task completed.")
                    }
                  >
                    <Check size={14} /> Complete task
                  </button>
                )}
                <button
                  className={styles.button}
                  onClick={() =>
                    ask(
                      `Help me prepare the next step for ${selected.title}. Read the canonical ${selected.sourceType} with ID ${selected.sourceId}, inspect related context, and prepare any supported changes for my approval.`,
                    )
                  }
                >
                  <Sparkles size={14} /> Prepare next step
                </button>
                <button
                  className={styles.button}
                  disabled={busy || !viewsQuery.data}
                  onClick={() =>
                    void mutate(
                      () =>
                        saveDocument("personal", {
                          ...preferences,
                          pins: preferences.pins.includes(attentionKey(selected))
                            ? preferences.pins.filter((key) => key !== attentionKey(selected))
                            : [...preferences.pins, attentionKey(selected)],
                        }),
                      "Priority preference saved.",
                    )
                  }
                >
                  <Pin size={14} />{" "}
                  {preferences.pins.includes(attentionKey(selected)) ? "Unpin" : "Pin"}
                </button>
                {selected.attentionKind === "watch" && (
                  <button
                    className={styles.button}
                    disabled={busy || !viewsQuery.data}
                    onClick={() =>
                      void mutate(async () => {
                        await saveDocument("personal", {
                          ...preferences,
                          muted: [
                            ...preferences.muted.filter((m) => m.key !== attentionKey(selected)),
                            {
                              key: attentionKey(selected),
                              fingerprint: attentionFingerprint(selected),
                            },
                          ],
                        });
                        setInspectorOpen(false);
                      }, "Finding muted until its evidence changes.")
                    }
                  >
                    Mute this finding
                  </button>
                )}
              </div>
              {selected.sourceType === "task" && (
                <div className="mt-6">
                  <label className={styles.field}>
                    Reschedule to
                    <input
                      aria-label="Snooze until"
                      type="date"
                      value={snoozeDate}
                      onChange={(e) => setSnoozeDate(e.target.value)}
                    />
                  </label>
                  <button
                    className={styles.textLink}
                    disabled={busy || !snoozeDate}
                    onClick={() =>
                      void mutate(async () => {
                        await fetchJson("/api/admin/revenue-os/tasks", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            id: selected.sourceId,
                            action: "snooze",
                            until: snoozeDate,
                          }),
                        });
                        setInspectorOpen(false);
                      }, "Task rescheduled.")
                    }
                  >
                    Save new date <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </AdminDialog>
      <AdminDialog
        open={factOpen}
        onClose={() => setFactOpen(false)}
        title="Business context"
        align="right"
        maxWidth="md"
      >
        <div className={styles.inspector}>
          {fact && (
            <>
              <button
                className={styles.iconButton}
                aria-label="Close business context"
                onClick={() => setFactOpen(false)}
              >
                <X size={18} />
              </button>
              <p className={styles.eyebrow}>BUSINESS CONTEXT</p>
              <h2>{fact.title}</h2>
              <p>{fact.detail}</p>
              <h3>Next step</h3>
              <p>{fact.nextStep}</p>
              <div className={styles.sourceBox}>
                {fact.sourceType.replaceAll("_", " ")} · observed {dateLabel(fact.observedAt)}
                <br />
                <Link href={fact.href} className={styles.textLink}>
                  Inspect source <ArrowRight size={13} />
                </Link>
              </div>
              <button
                className={styles.primaryButton}
                onClick={() =>
                  ask(
                    `Inspect ${fact.sourceType} ${fact.sourceId} about "${fact.title}". Explain the context and prepare the next useful action for approval.`,
                  )
                }
              >
                <Sparkles size={14} /> Work through this
              </button>
            </>
          )}
        </div>
      </AdminDialog>
      <ActionReviewDialog
        open={reviewOpen}
        action={reviewing}
        busy={busy}
        error={error}
        onClose={closeReview}
        onApprove={() => {
          if (reviewing)
            void mutate(async () => {
              await fetchJson("/api/admin/revenue-os/actions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: reviewing.id, decision: "approve" }),
              });
              closeReview();
              setInspectorOpen(false);
            }, "Approval processed. Check the recorded result.");
        }}
        onReject={() => {
          if (reviewing)
            void mutate(async () => {
              await fetchJson("/api/admin/revenue-os/actions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: reviewing.id, decision: "reject" }),
              });
              closeReview();
            }, "Proposal rejected.");
        }}
      />
      <AdminDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete view">
        <div className={cn(styles.card, "p-6")}>
          <h2>Delete “{current.view.name}”?</h2>
          <p className={cn(styles.muted, "mt-2")}>
            This removes the saved arrangement. Business records and work stay available.
          </p>
          <div className={cn(styles.toolbarGroup, "mt-5")}>
            <button className={styles.button} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button
              className={styles.primaryButton}
              disabled={busy}
              onClick={() =>
                void mutate(async () => {
                  const doc = views[current.scope].document;
                  await saveDocument(current.scope, {
                    ...doc,
                    views: doc.views.filter((v) => v.id !== current.view.id),
                    defaultViewId: null,
                  });
                  setChosenView(null);
                  setConfirmDelete(false);
                }, "View deleted.")
              }
            >
              Delete view
            </button>
          </div>
        </div>
      </AdminDialog>
    </div>
  );
}
