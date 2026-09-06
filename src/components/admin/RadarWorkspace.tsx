"use client";
import { useRef, useState } from "react";
import {
  RadarEditorDialog,
  EMPTY_RADAR_EDITOR,
  type RadarEditorKind,
  type RadarEditorFields,
} from "./RadarEditorDialog";
import { RadarReviewDialog, type RadarReview } from "./RadarReviewDialog";
import { RadarOverview } from "./RadarOverview";
import { RadarOpportunityDetail } from "./RadarOpportunityDetail";
import { button, primary, words, Pill } from "./RadarUI";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, History, Plus, RefreshCw, X } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { AdminSurface } from "./AdminSurface";
import { AdminAsyncRegion } from "./AdminAsyncRegion";
import { AdminDialog } from "./AdminDialog";
import AdminLink from "./AdminLink";
import { DemoBusinessNotice } from "./DemoBusinessNotice";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { type RadarStoreChange } from "@/lib/revenue-os/radar-store-contract";
import { RADAR_FACTORS, type RadarAssessment } from "@/lib/revenue-os/radar-ranking-contract";
import type {
  RadarWorkspaceData,
  RadarSourceView,
} from "@/lib/revenue-os/radar-workspace-contract";
const command = <T,>(kind: string, input: unknown) =>
  fetchJson<T>("/api/admin/radar/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, input }),
  });
type Reader = {
  title: string;
  text: string;
  id: string;
  kind: "sourceVersionId" | "assetId";
  nextOffset: number | null;
  sourceUrls: string[];
};
export function RadarWorkspace({
  opportunityId,
  historyOnly = false,
}: {
  opportunityId?: string;
  historyOnly?: boolean;
}) {
  const query = useAdminQuery<RadarWorkspaceData>(
      ["admin", "radar", opportunityId ?? "today"],
      `/api/admin/radar/workspace${opportunityId ? `?opportunityId=${opportunityId}` : ""}`,
    ),
    cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [editor, setEditor] = useState<RadarEditorKind>(null),
    [review, setReview] = useState<RadarReview | null>(null),
    [reader, setReader] = useState<Reader | null>(null);
  const [form, setForm] = useState<RadarEditorFields>(EMPTY_RADAR_EDITOR);
  const { title, summary, nextAction, body, url, draftKind, selectedSources, assessment } = form;
  const briefOperations = useRef(new Map<string, string>());
  const operation = useRef(crypto.randomUUID()),
    inFlight = useRef(false);
  const data = query.data,
    packet = data?.packet,
    opp = packet?.opportunity,
    canWrite = Boolean(data?.enabled && !historyOnly);
  async function perform(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Radar request could not be completed");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ["admin"] });
  }
  const library = useAdminQuery<RadarWorkspaceData>(
    ["admin", "radar", "today"],
    "/api/admin/radar/workspace",
    { enabled: Boolean(opportunityId && (editor === "citations" || editor === "create")) },
  );
  const sourceOptions = [
    ...new Map(
      [...(library.data?.sources ?? []), ...(data?.sources ?? [])].map((source) => [
        source.id,
        source,
      ]),
    ).values(),
  ];
  function openEditor(kind: RadarEditorKind, source?: RadarSourceView) {
    operation.current = crypto.randomUUID();
    setError("");
    setReview(null);
    setEditor(kind);
    const currentIds = packet?.sources.map((s) => s.id) ?? [];
    const existing = packet?.assessment;
    const initialAssessment: RadarAssessment = existing
      ? {
          ...existing,
          estimates: Object.fromEntries(
            RADAR_FACTORS.map((key) => [
              key,
              {
                ...existing.estimates[key],
                sourceVersionIds: existing.estimates[key].sourceVersionIds.filter((id) =>
                  currentIds.includes(id),
                ),
              },
            ]),
          ) as RadarAssessment["estimates"],
        }
      : {
          classification: "unknown",
          classificationReason: "",
          topicKey: "business-opportunity",
          estimates: Object.fromEntries(
            RADAR_FACTORS.map((key) => [
              key,
              { value: null, confidence: "low", rationale: "", sourceVersionIds: currentIds },
            ]),
          ) as RadarAssessment["estimates"],
          effort: 2,
          timeToValue: "week",
          nextAction: opp?.recommended_action ?? "",
          alternatives: ["Review more source material"],
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        };
    setForm({
      ...EMPTY_RADAR_EDITOR,
      title:
        kind === "source"
          ? ""
          : kind === "create"
            ? `Explore ${source?.title ?? "an opportunity"}`
            : kind === "draft"
              ? `${opp?.title ?? "Opportunity"} brief`
              : (opp?.title ?? ""),
      summary: kind === "create" ? "" : (opp?.summary ?? ""),
      nextAction: kind === "create" ? "" : (opp?.recommended_action ?? ""),
      selectedSources: source
        ? [source.id]
        : (packet?.sources ?? [])
            .filter((s) => s.verification !== "retracted")
            .map((s) => s.id)
            .slice(0, kind === "draft" ? 5 : 10),
      observations: Object.fromEntries(
        (packet?.citations ?? []).map((c) => [c.source_version_id, c.observation]),
      ),
      assessment: initialAssessment,
    });
  }
  async function previewEditor() {
    const citations = selectedSources.map((id) => ({
      sourceVersionId: id,
      observation: form.observations[id] ?? "",
    }));
    if (editor === "assessment" && assessment && opp) {
      const input = {
        operationId: operation.current,
        opportunityId: opp.id,
        expectedRevision: opp.revision,
        assessment,
      };
      const p = await command<{ digest: string }>("assessment_preview", input);
      setReview({ kind: "assessment", input, digest: p.digest, assessment });
    } else if (editor === "source")
      await previewChange({ operation: "ingest_source", url, title, bodyText: body });
    else if (editor === "create")
      await previewChange({
        operation: "create_opportunity",
        title,
        summary,
        recommendedAction: nextAction,
        kind: form.opportunityKind,
        citations,
      });
    else if (editor === "citations" && opp)
      await previewChange({
        operation: "replace_citations",
        opportunityId: opp.id,
        expectedRevision: opp.revision,
        citations,
        reason: "Operator corrects the source packet after reviewing current evidence",
      });
    else if (editor === "draft" && opp)
      await previewChange({
        operation: "add_asset",
        opportunityId: opp.id,
        expectedRevision: opp.revision,
        kind: draftKind,
        title,
        bodyText: body,
        sourceVersionIds: selectedSources,
      });
    else if (opp)
      await previewChange({
        operation: "update_opportunity",
        opportunityId: opp.id,
        expectedRevision: opp.revision,
        patch: { title, summary, recommendedAction: nextAction },
        reason: "Operator edits the opportunity after reviewing current evidence",
      });
  }
  async function generateBrief() {
    const key = JSON.stringify([opp!.id, opp!.revision, [...selectedSources].sort()]);
    const id = briefOperations.current.get(key) ?? crypto.randomUUID();
    briefOperations.current.set(key, id);
    const r = await command<{ bodyText: string | null; reason?: string; status: string }>(
      "prepare_brief",
      {
        operationId: id,
        opportunityId: opp!.id,
        expectedRevision: opp!.revision,
        sourceVersionIds: selectedSources,
      },
    );
    if (!r.bodyText)
      throw new Error(r.reason ?? `Drafting ${r.status}. Check model settings and receipts.`);
    setForm((old) => ({ ...old, body: r.bodyText! }));
    setNotice("A source-linked AI draft is ready for review. It has not been saved or sent.");
  }
  async function previewChange(change: RadarStoreChange) {
    const input = { operationId: operation.current, change };
    const result = await command<{ digest: string }>("store_preview", input);
    setReview({ kind: "store", input, digest: result.digest, change });
  }
  async function queue(approve: boolean) {
    if (!review) return;
    const proposed = await command<{ id: string }>(
      review.kind === "store" ? "store_propose" : "assessment_propose",
      { ...review.input, digest: review.digest },
    );
    if (approve)
      await fetchJson("/api/admin/revenue-os/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposed.id, decision: "approve" }),
      });
    setReview(null);
    setEditor(null);
    setNotice(
      approve
        ? "Change approved and recorded. The workspace has been refreshed."
        : "Saved for approval. Review the pending action in Today.",
    );
    operation.current = crypto.randomUUID();
    await refresh();
  }
  async function readRecord(id: string, kind: Reader["kind"], offset = 0) {
    const result = await command<{
      record: { title: string; canonicalUrl?: string };
      sources?: Array<{ canonical_url: string }>;
      text: string;
      nextOffset: number | null;
    }>("read_record", { [kind]: id, offset });
    setReader((previous) => ({
      id,
      kind,
      title: result.record.title,
      sourceUrls:
        result.sources?.map((s) => s.canonical_url) ??
        (result.record.canonicalUrl ? [result.record.canonicalUrl] : []),
      text: offset && previous?.id === id ? previous.text + result.text : result.text,
      nextOffset: result.nextOffset,
    }));
  }
  function sourceCard(source: RadarSourceView) {
    return (
      <div key={source.id} className="rounded-xl bg-[var(--admin-surface-subtle)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{source.title}</h3>
          <Pill>
            {source.verification === "verified" ? "Source reviewed" : words(source.verification)}
          </Pill>
        </div>
        <p className="mt-1 break-all text-xs text-[var(--admin-muted)]">
          {source.canonicalUrl ?? `Source version ${source.version}`}
        </p>
        {packet?.citations
          .filter((c) => c.source_version_id === source.id)
          .map((c, i) => (
            <p key={i} className="mt-3 text-pretty text-sm leading-6">
              {c.observation}
            </p>
          ))}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={button}
            onClick={() => void perform(() => readRecord(source.id, "sourceVersionId"))}
          >
            <BookOpen size={15} aria-hidden />
            Read source
          </button>
          {canWrite && !opp && (
            <button className={button} onClick={() => openEditor("create", source)}>
              Develop opportunity
            </button>
          )}
          {canWrite && (
            <button
              className={button}
              onClick={() =>
                void perform(async () => {
                  operation.current = crypto.randomUUID();
                  await previewChange({
                    operation: "review_source",
                    sourceVersionId: source.id,
                    expectedRevision: source.revision,
                    verification: source.verification === "verified" ? "retracted" : "verified",
                    reason:
                      source.verification === "verified"
                        ? "Operator withdraws this source after review"
                        : "Operator reviewed the supplied source text",
                  });
                })
              }
            >
              {source.verification === "verified" ? "Withdraw review" : "Review source"}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow={data?.organization ?? "Business opportunities"}
        title={historyOnly ? "Radar history" : (opp?.title ?? "Opportunity Radar")}
        subtitle={
          opp
            ? "Evidence, judgments and the next useful action."
            : "Choose useful business opportunities from sourced, reviewed information."
        }
        actions={
          <>
            {opp ? (
              <AdminLink
                className={button}
                href={historyOnly ? "/admin/radar/history" : "/admin/radar/today"}
              >
                <ArrowLeft size={15} aria-hidden />
                Back to Radar
              </AdminLink>
            ) : (
              <AdminLink
                className={button}
                href={historyOnly ? "/admin/radar/today" : "/admin/radar/history"}
              >
                <History size={15} aria-hidden />
                {historyOnly ? "Open Radar" : "History"}
              </AdminLink>
            )}
            <button
              className={button}
              disabled={busy}
              onClick={() => void perform(refresh)}
              aria-label="Refresh Radar"
            >
              <RefreshCw size={15} aria-hidden />
            </button>
            {canWrite && !opp && (
              <button className={primary} onClick={() => openEditor("source")}>
                <Plus size={15} aria-hidden />
                Add source
              </button>
            )}
          </>
        }
      />
      <DemoBusinessNotice />
      {error && (
        <AdminSurface tone="attention">
          <p role="alert" className="break-words text-sm">
            {error}
          </p>
          <button className={button + " mt-3"} onClick={() => void perform(refresh)}>
            Refresh current records
          </button>
        </AdminSurface>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-[var(--admin-surface-subtle)] p-4 text-sm">
          {notice}{" "}
          <AdminLink href="/admin/today" className="underline">
            Open approval queue
          </AdminLink>
        </p>
      )}
      <AdminAsyncRegion
        loading={query.isPending}
        hasData={Boolean(data)}
        loadingFallback={
          <AdminSurface>
            <p className="text-sm text-[var(--admin-muted)]">Loading Radar evidence…</p>
          </AdminSurface>
        }
      >
        {query.isError && !data ? (
          <AdminSurface tone="attention">
            <h2 className="font-semibold">Radar could not be loaded</h2>
            <p className="mt-2 text-sm">Check the installation and workspace access, then retry.</p>
            <button className={button + " mt-4"} onClick={() => void query.refetch()}>
              Try again
            </button>
          </AdminSurface>
        ) : (
          data && (
            <>
              {(!data.enabled || historyOnly) && (
                <AdminSurface tone="subtle">
                  <p className="text-sm">
                    {data.enabled
                      ? "Retained records are shown without write controls."
                      : "Radar is turned off. Retained records remain available; new execution is blocked."}{" "}
                    <AdminLink href="/admin/integrations" className="font-semibold underline">
                      Open settings
                    </AdminLink>
                  </p>
                </AdminSurface>
              )}
              {data.warnings.map((w) => (
                <p
                  key={w}
                  role="status"
                  className="rounded-xl bg-[var(--admin-surface-subtle)] p-4 text-sm"
                >
                  {w}
                </p>
              ))}
              {!opp ? (
                <RadarOverview data={data} historyOnly={historyOnly} sourceCard={sourceCard} />
              ) : (
                <RadarOpportunityDetail
                  data={data}
                  canWrite={canWrite}
                  busy={busy}
                  openEditor={openEditor}
                  sourceCard={sourceCard}
                  onReadAsset={(id) => void perform(() => readRecord(id, "assetId"))}
                  onTransition={(state) =>
                    void perform(async () => {
                      operation.current = crypto.randomUUID();
                      await previewChange({
                        operation: "transition_opportunity",
                        opportunityId: opp!.id,
                        expectedRevision: opp!.revision,
                        state,
                        reason: `Operator requests ${words(state)} after reviewing this opportunity`,
                      });
                    })
                  }
                />
              )}
            </>
          )
        )}
      </AdminAsyncRegion>
      <RadarEditorDialog
        kind={editor}
        open={Boolean(editor) && !review}
        values={form}
        onChange={setForm}
        sources={
          editor === "assessment" || editor === "draft" ? (packet?.sources ?? []) : sourceOptions
        }
        model={data?.model}
        busy={busy}
        error={error}
        onClose={() => setEditor(null)}
        onPreview={() => void perform(previewEditor)}
        onGenerate={() => void perform(generateBrief)}
      />
      <RadarReviewDialog
        review={review}
        sources={sourceOptions}
        opportunityTitle={opp?.title}
        error={error}
        busy={busy}
        onQueue={(approve) => void perform(() => queue(approve))}
        onClose={() => setReview(null)}
        onReadSource={(id) => void perform(() => readRecord(id, "sourceVersionId"))}
      />
      <AdminDialog
        open={Boolean(reader)}
        onClose={() => setReader(null)}
        title={reader?.title ?? "Source text"}
        maxWidth="lg"
      >
        <div className="max-h-[85dvh] overflow-y-auto rounded-2xl bg-[var(--admin-surface)] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-base font-semibold">{reader?.title}</h2>
            <button className={button} aria-label="Close source" onClick={() => setReader(null)}>
              <X size={16} />
            </button>
          </div>
          {reader?.sourceUrls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block break-all text-xs text-[var(--admin-accent)] underline"
            >
              {url}
            </a>
          ))}
          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          )}
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{reader?.text}</p>
          {reader?.nextOffset !== null && reader && (
            <button
              className={button + " mt-5"}
              disabled={busy}
              onClick={() =>
                void perform(() => readRecord(reader.id, reader.kind, reader.nextOffset!))
              }
            >
              Read more
            </button>
          )}
        </div>
      </AdminDialog>
    </>
  );
}
