"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileJson,
  FileSpreadsheet,
  FileUp,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { PageHeader } from "@/components/admin/PageHeader";
import { ContactIntakeNav } from "@/components/admin/ContactIntakeNav";
import { Pagination } from "@/components/admin/Pagination";
import { StatCard } from "@/components/admin/StatCard";
import { cn } from "@/lib/utils";
import {
  CONTACT_IMPORT_COLUMNS,
  prepareContactImportColumns,
  validateContactImportMapping,
  type ContactImportMapping,
  type ContactImportColumn,
} from "@/lib/revenue-os/contact-import-source";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";

type Action = "create" | "update" | "skip";
type Confidence = "high" | "medium" | "low";
type ContactFields = {
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  role: string | null;
  website: string | null;
  industry: string | null;
  source: string | null;
  notes: string | null;
};
type ImportRow = {
  id: string;
  row_index: number;
  raw_data: Record<string, string>;
  status: string;
  action: Action;
  included: boolean;
  confidence: Confidence;
  reviewed_data: ContactFields;
  warnings: string[];
  errors: string[];
  match_reason: string | null;
  matched_contact_id: string | null;
  imported_contact_id: string | null;
  error: string | null;
};
type ImportBatch = {
  id: string;
  status: string;
  source_type: string;
  original_filename: string | null;
  source_row_count: number;
  proposed_row_count: number;
  selected_row_count: number;
  review_digest: string | null;
  approval_digest: string | null;
  ai_provider?: "openrouter" | "none";
  ai_model: string | null;
  summary: Record<string, unknown>;
  error: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  rows?: ImportRow[];
};

const EMPTY_SAMPLE = `Jane Martinez, jane@martinezroofing.com, 512-555-0142, Martinez Roofing, Owner\nSam Lee — Operations Director at Northstar HVAC — sam@northstarhvac.com\nPriya Shah | priya@example.com | met at Austin builders meetup; interested in faster estimate follow-up`;
const COLUMN_SAMPLE = `fullName,email,companyName\nAlex Morgan,alex@example.test,Example Company\nJamie Chen,jamie@example.test,Example Company`;

function statusTone(status: string) {
  if (["completed", "imported"].includes(status))
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["failed", "partial", "needs_review"].includes(status))
    return "bg-amber-500/12 text-amber-800 dark:text-amber-300";
  if (["approved", "executing"].includes(status))
    return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]";
}

function labelStatus(status: string) {
  return status.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

async function api(body?: Record<string, unknown>, id?: string) {
  const response = await fetch(
    id
      ? `/api/admin/revenue-os/contact-imports?id=${encodeURIComponent(id)}`
      : "/api/admin/revenue-os/contact-imports",
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Contact Import request failed"), {
      schemaReady: data.schemaReady,
      batchId: data.batchId,
    });
  return data;
}

export default function ContactImportsPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const sourceGeneration = useRef(0);
  const [sourceText, setSourceText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [method, setMethod] = useState<"columns" | "ai">("columns");
  const [columnSource, setColumnSource] = useState<ReturnType<
    typeof prepareContactImportColumns
  > | null>(null);
  const [mapping, setMapping] = useState<ContactImportMapping>({});
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const historyQuery = useAdminQuery<{ schemaReady: boolean; batches: ImportBatch[] }>(
    ["contact-imports", "history"],
    "/api/admin/revenue-os/contact-imports",
  );
  const history = historyQuery.data?.batches ?? [];
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [busy, setBusy] = useState<"analyze" | "save" | "execute" | "history" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saved, setSaved] = useState(true);

  const rows = useMemo(() => batch?.rows ?? [], [batch?.rows]);
  const pageSize = 50;
  const pageRows = rows.slice((reviewPage - 1) * pageSize, reviewPage * pageSize);
  const activeRow = rows.find((row) => row.id === activeRowId) ?? rows[0] ?? null;
  const selectedRows = rows.filter((row) => row.included && row.action !== "skip");
  const summary = useMemo(
    () => ({
      create: selectedRows.filter((row) => row.action === "create").length,
      update: selectedRows.filter((row) => row.action === "update").length,
      needsReview: rows.filter((row) => row.errors.length || row.confidence === "low").length,
      excluded: rows.filter((row) => !row.included || row.action === "skip").length,
    }),
    [rows, selectedRows],
  );

  async function analyze() {
    setError(null);
    setBusy("analyze");
    const generation = sourceGeneration.current;
    try {
      if (method === "columns" && !columnSource) {
        const prepared = prepareContactImportColumns(sourceText, filename);
        setColumnSource(prepared);
        setMapping(prepared.mapping);
        return;
      }
      const reviewedMapping =
        method === "columns"
          ? validateContactImportMapping(mapping, columnSource!.columns)
          : undefined;
      const data = await api({
        action: "analyze",
        sourceText,
        filename,
        method,
        mapping: reviewedMapping,
        ...(method === "ai" ? { instructions } : {}),
      });
      if (generation !== sourceGeneration.current) return;
      setBatch(data.batch);
      setReviewPage(1);
      setActiveRowId(data.batch?.rows?.[0]?.id ?? null);
      setSaved(true);
      setSchemaReady(true);
      await historyQuery.refetch();
    } catch (cause) {
      const value = cause as Error & { schemaReady?: boolean };
      setError(value.message);
      if (value.schemaReady === false) setSchemaReady(false);
    } finally {
      setBusy(null);
    }
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    const generation = ++sourceGeneration.current;
    setColumnSource(null);
    setError(null);
    if (file.size > 250_000) {
      setError("Choose a UTF-8 text file smaller than 250 KB.");
      return;
    }
    if (!/\.(csv|tsv|json|txt)$/i.test(file.name)) {
      setError("Use CSV, TSV, JSON, or TXT. Spreadsheet binaries are not read silently.");
      return;
    }
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      if (generation !== sourceGeneration.current) return;
      setSourceText(text);
      setFilename(file.name);
    } catch {
      if (generation !== sourceGeneration.current) return;
      setError(
        "This file could not be read as UTF-8 text. Save it with UTF-8 encoding and try again.",
      );
    }
  }

  function patchRow(id: string, patch: Partial<ImportRow>) {
    setBatch((current) =>
      current
        ? {
            ...current,
            rows: current.rows?.map((row) => (row.id === id ? { ...row, ...patch } : row)),
          }
        : current,
    );
    setSaved(false);
  }

  function patchField(id: string, key: keyof ContactFields, value: string) {
    setBatch((current) =>
      current
        ? {
            ...current,
            rows: current.rows?.map((row) =>
              row.id === id
                ? { ...row, reviewed_data: { ...row.reviewed_data, [key]: value || null } }
                : row,
            ),
          }
        : current,
    );
    setSaved(false);
  }

  async function saveReview() {
    if (!batch) return;
    setError(null);
    setBusy("save");
    try {
      const data = await api({
        action: "save_review",
        batchId: batch.id,
        expectedRevision: batch.updated_at,
        rows: rows.map((row) => ({
          id: row.id,
          included: row.included,
          action: row.action,
          data: row.reviewed_data,
        })),
      });
      setBatch(data.batch);
      setSaved(true);
      void historyQuery.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save review");
    } finally {
      setBusy(null);
    }
  }

  async function approveAndExecute() {
    if (!batch?.review_digest) return;
    setError(null);
    setBusy("execute");
    setConfirmOpen(false);
    try {
      if (!saved) throw new Error("Save the current edits before approving this batch.");
      await api({ action: "approve", batchId: batch.id, expectedDigest: batch.review_digest });
      const data = await api({ action: "execute", batchId: batch.id });
      setBatch(data.batch);
      await historyQuery.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not execute import");
    } finally {
      setBusy(null);
    }
  }

  async function retryPartial() {
    if (!batch) return;
    setError(null);
    setBusy("execute");
    try {
      const data = await api({ action: "execute", batchId: batch.id });
      setBatch(data.batch);
      await historyQuery.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not retry failed rows");
    } finally {
      setBusy(null);
    }
  }

  async function openBatch(id: string) {
    setBusy("history");
    setError(null);
    try {
      const data = await api(undefined, id);
      setBatch(data.batch);
      setReviewPage(1);
      setActiveRowId(data.batch?.rows?.[0]?.id ?? null);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open import");
    } finally {
      setBusy(null);
    }
  }

  const finished = batch && ["completed", "partial"].includes(batch.status);

  return (
    <div>
      <PageHeader
        title="Import contacts"
        subtitle="Review website inquiries and bring external contact lists into the same controlled intake workflow."
        actions={
          batch && !finished ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                sourceGeneration.current += 1;
                setColumnSource(null);
                setBatch(null);
                setSourceText("");
                setFilename(null);
                setError(null);
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-[var(--admin-muted)] transition-[background-color,color,scale] duration-150 hover:bg-black/[0.045] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.06]"
            >
              <X className="size-4" /> Start over
            </button>
          ) : undefined
        }
      />
      <ContactIntakeNav active="import" />

      {!batch ? (
        <section key="source" aria-label="Contact import source" className="admin-split">
          <AdminSurface padding="lg" className="overflow-hidden">
            <div className="flex flex-col gap-5">
              <fieldset disabled={busy !== null} className="grid gap-2 sm:grid-cols-2">
                <legend className="admin-field-label mb-2">Preparation</legend>
                {(
                  [
                    ["columns", "Map columns", "CSV, TSV or flat JSON. No AI request."],
                    ["ai", "AI-assisted", "For free-form lists. Uses your model and budget."],
                  ] as const
                ).map(([value, label, detail]) => (
                  <label
                    key={value}
                    className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl p-3 shadow-[var(--admin-shadow-border)]"
                  >
                    <input
                      type="radio"
                      name="import-method"
                      value={value}
                      checked={method === value}
                      onChange={() => {
                        setMethod(value);
                        setColumnSource(null);
                        setError(null);
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="admin-copy mt-1 block text-xs">{detail}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="admin-field-label">
                <span>
                  {method === "columns"
                    ? "Paste CSV, TSV or flat JSON"
                    : "Paste names, notes, rows, or exported data"}
                </span>
                <textarea
                  value={sourceText}
                  disabled={busy !== null}
                  onChange={(event) => {
                    sourceGeneration.current += 1;
                    setColumnSource(null);
                    setSourceText(event.target.value);
                    setFilename(null);
                    setError(null);
                  }}
                  placeholder={method === "columns" ? COLUMN_SAMPLE : EMPTY_SAMPLE}
                  className="admin-field !min-h-40 resize-y py-3 font-mono text-[12px] leading-6"
                  data-testid="contact-import-source"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                {method === "ai" && (
                  <label className="admin-field-label">
                    <span>Optional context for the cleanup</span>
                    <input
                      value={instructions}
                      disabled={busy !== null}
                      onChange={(event) => setInstructions(event.target.value)}
                      placeholder="Example: these came from the Austin builders meetup"
                      className="admin-field"
                    />
                  </label>
                )}
                <input
                  ref={fileInput}
                  className="sr-only"
                  type="file"
                  aria-label="Upload contacts file"
                  accept=".csv,.tsv,.json,.txt,text/csv,text/tab-separated-values,application/json,text/plain"
                  onChange={(event) => {
                    void chooseFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[var(--admin-surface-subtle)] px-4 text-sm font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,scale] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"
                >
                  <FileUp className="size-4" /> Choose file
                </button>
              </div>
              {filename && (
                <p className="flex items-center gap-2 text-xs font-medium text-[var(--admin-muted)]">
                  <FileSpreadsheet className="size-3.5" /> {filename}
                </p>
              )}
              {method === "columns" && columnSource && (
                <fieldset
                  disabled={busy !== null}
                  className="space-y-3"
                  aria-label="Match contact columns"
                >
                  <legend className="font-semibold">Match columns</legend>
                  <p className="admin-copy text-sm">
                    Choose a full name, or separate first and last names, plus email or phone.
                    Unmapped columns remain available in Original source.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {columnSource.columns.map((column) => (
                      <label key={column} className="admin-field-label min-w-0 self-start">
                        <span>{column}</span>
                        <select
                          className="admin-field"
                          aria-label={`${column} contact field`}
                          value={
                            CONTACT_IMPORT_COLUMNS.find((field) => mapping[field.key] === column)
                              ?.key ?? ""
                          }
                          onChange={(event) => {
                            const next = { ...mapping };
                            for (const field of CONTACT_IMPORT_COLUMNS)
                              if (next[field.key] === column) delete next[field.key];
                            const target = event.target.value as ContactImportColumn;
                            if (target) next[target] = column;
                            setMapping(next);
                            setError(null);
                          }}
                        >
                          <option value="">Do not import</option>
                          {CONTACT_IMPORT_COLUMNS.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                        <span className="block truncate text-xs font-normal normal-case tracking-normal text-[var(--admin-muted)]">
                          Example: {columnSource.rows[0]?.[column] || "(empty)"}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="admin-copy text-xs tabular-nums">
                    {columnSource.rows.length} source rows. Validation and existing-contact checks
                    follow.
                  </p>
                </fieldset>
              )}
              <button
                type="button"
                disabled={!sourceText.trim() || busy === "analyze" || !schemaReady}
                onClick={() => void analyze()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0b0b0b] pl-5 pr-[18px] text-sm font-semibold text-white shadow-[var(--admin-shadow)] transition-[box-shadow,scale,opacity] duration-150 hover:shadow-[var(--admin-shadow-hover)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-black"
                data-testid="contact-import-analyze"
              >
                {busy === "analyze" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : method === "ai" ? (
                  <Sparkles className="size-4" />
                ) : (
                  <FileSpreadsheet className="size-4" />
                )}{" "}
                {method === "ai"
                  ? "Analyze with AI"
                  : columnSource
                    ? "Build contact review"
                    : "Review columns"}{" "}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </AdminSurface>
          <div className="space-y-5">
            <AdminSurface tone="subtle" padding="lg">
              <span className="grid size-10 place-items-center rounded-full bg-[var(--admin-surface)] text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)]">
                <ShieldCheck className="size-4" />
              </span>
              <h2 className="mt-4 text-balance font-display text-lg font-semibold text-[var(--admin-ink)]">
                Approval comes before import
              </h2>
              <ul className="admin-copy mt-3 space-y-2 text-pretty text-sm">
                <li>Preparing a review creates no customer records.</li>
                <li>Low-confidence and ambiguous rows start excluded.</li>
                <li>You approve the exact edited snapshot.</li>
                <li>No opportunities, campaigns, or messages are created.</li>
              </ul>
            </AdminSurface>
            <ImportHistory
              history={history}
              busy={busy !== null}
              loading={historyQuery.isPending}
              failed={historyQuery.isError}
              onRetry={() => void historyQuery.refetch()}
              onOpen={(id) => void openBatch(id)}
            />
          </div>
        </section>
      ) : (
        <section key={batch.id} aria-label="Contact import review">
          <div className="mb-5 admin-grid admin-grid--metrics">
            <StatCard
              label="Selected"
              value={selectedRows.length}
              note={`${rows.length} proposed`}
              icon={UsersRound}
            />
            <StatCard
              label="New contacts"
              value={summary.create}
              note="Will create"
              icon={UserRoundCheck}
            />
            <StatCard
              label="Existing"
              value={summary.update}
              note="Fill blank fields"
              icon={RefreshCw}
            />
            <StatCard
              label="Needs attention"
              value={summary.needsReview}
              note={`${summary.excluded} excluded`}
              icon={AlertTriangle}
              tone={summary.needsReview > 0 ? "attention" : "default"}
            />
          </div>

          {error && <ErrorNotice message={error} />}
          {finished ? (
            <ResultPanel
              batch={batch}
              onRetry={batch.status === "partial" ? () => void retryPartial() : undefined}
              busy={busy === "execute"}
            />
          ) : (
            <div className="admin-split admin-split--master">
              <AdminSurface padding="none" className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-4 shadow-[0_1px_0_var(--admin-rule)] sm:px-5">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-[var(--admin-ink)]">
                      Review rows
                    </h2>
                    <p className="admin-copy text-xs">Select a row to edit its proposed values.</p>
                    {batch.ai_provider === "none" && (
                      <p className="mt-1 text-xs font-medium">Mapped columns · No AI used</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                      statusTone(batch.status),
                    )}
                  >
                    {labelStatus(batch.status)}
                  </span>
                </div>
                <div
                  key={reviewPage}
                  className="max-h-[690px] divide-y divide-[var(--admin-rule)] overflow-y-auto"
                >
                  {pageRows.map((row) => (
                    <RowListItem
                      key={row.id}
                      row={row}
                      active={activeRow?.id === row.id}
                      disabled={busy !== null}
                      onSelect={() => setActiveRowId(row.id)}
                      onToggle={() => patchRow(row.id, { included: !row.included })}
                    />
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <Pagination
                    page={reviewPage}
                    pageSize={pageSize}
                    total={rows.length}
                    totalPages={Math.ceil(rows.length / pageSize)}
                    onPageChange={(page) => {
                      setReviewPage(page);
                      setActiveRowId(rows[(page - 1) * pageSize]?.id ?? null);
                    }}
                  />
                </div>
              </AdminSurface>
              <AdminSurface padding="lg" className="h-fit lg:sticky lg:top-6">
                {activeRow ? (
                  <RowEditor
                    row={activeRow}
                    disabled={busy !== null}
                    onPatch={(patch) => patchRow(activeRow.id, patch)}
                    onField={(field, value) => patchField(activeRow.id, field, value)}
                  />
                ) : (
                  <p className="admin-copy py-20 text-center text-sm">No rows were extracted.</p>
                )}
              </AdminSurface>
            </div>
          )}

          {!finished && (
            <div
              data-contact-import-actions
              className="sticky bottom-3 z-20 mt-5 flex items-center justify-between gap-2 rounded-2xl bg-[#0b0b0b] p-3 text-white shadow-[0_24px_70px_-24px_rgba(0,0,0,.65)] sm:bottom-4 sm:gap-3 sm:p-4"
            >
              <div className="min-w-0 px-1">
                <p className="truncate text-xs font-semibold sm:text-sm">
                  {saved ? "Review saved" : "Unsaved changes"}
                </p>
                <p className="mt-0.5 hidden text-pretty text-xs text-white/55 sm:block">
                  {selectedRows.length} selected · {summary.create} create · {summary.update} enrich
                  · no email will be sent
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busy !== null || saved}
                  onClick={() => void saveReview()}
                  className="min-h-10 rounded-xl px-3 text-xs font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,.18)] transition-[background-color,scale,opacity] duration-150 hover:bg-white/8 active:scale-[0.96] disabled:opacity-40 sm:px-4 sm:text-sm"
                >
                  {busy === "save" ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={
                    busy !== null || !saved || !selectedRows.length || batch.status !== "ready"
                  }
                  onClick={() => setConfirmOpen(true)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white pl-3 pr-2.5 text-xs font-bold text-black transition-[scale,opacity] duration-150 active:scale-[0.96] disabled:opacity-40 sm:gap-2 sm:pl-4 sm:pr-3.5 sm:text-sm"
                  data-testid="contact-import-approve"
                >
                  <span className="sm:hidden">Approve</span>
                  <span className="hidden sm:inline">Review approval</span>
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {(!schemaReady || historyQuery.data?.schemaReady === false) && (
        <ErrorNotice message="Contact imports are unavailable for this workspace. Open Setup Center to finish setup, then try again." />
      )}
      {error && !batch && <ErrorNotice message={error} />}

      <AdminDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Approve contact import"
        maxWidth="md"
      >
        <AdminSurface padding="none" className="admin-dialog-surface overflow-hidden rounded-2xl">
          <div className="p-5 sm:p-6">
            <span className="grid size-11 place-items-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <ShieldCheck className="size-5" />
            </span>
            <h2 className="admin-dialog-title mt-5">Approve this exact import snapshot?</h2>
            <p className="admin-copy mt-2 text-sm">
              This approval covers {selectedRows.length} reviewed rows: {summary.create} new
              contacts and {summary.update} existing contacts enriched only where fields are blank.
            </p>
            <div className="mt-5 rounded-xl bg-[var(--admin-surface-subtle)] p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-[var(--admin-ink)]">
                <Check className="size-4 text-emerald-600" /> Contact and company records only
              </p>
              <p className="mt-2 flex items-center gap-2 font-semibold text-[var(--admin-ink)]">
                <Check className="size-4 text-emerald-600" /> Row-level receipts and audit history
              </p>
              <p className="mt-2 flex items-center gap-2 font-semibold text-[var(--admin-ink)]">
                <X className="size-4 text-[var(--admin-muted)]" /> No email, campaign, task, or
                opportunity
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 bg-[var(--admin-surface-subtle)] p-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="min-h-10 rounded-xl px-4 text-sm font-semibold text-[var(--admin-muted)] transition-[background-color,scale] duration-150 hover:bg-black/[0.05] active:scale-[0.96] dark:hover:bg-white/[0.06]"
            >
              Keep reviewing
            </button>
            <button
              type="button"
              onClick={() => void approveAndExecute()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0b0b0b] pl-4 pr-3.5 text-sm font-semibold text-white transition-[scale] duration-150 active:scale-[0.96] dark:bg-white dark:text-black"
              data-testid="contact-import-confirm"
            >
              <ShieldCheck className="size-4" /> Approve and import
            </button>
          </div>
        </AdminSurface>
      </AdminDialog>
    </div>
  );
}

function RowListItem({
  row,
  active,
  disabled,
  onSelect,
  onToggle,
}: {
  row: ImportRow;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      data-contact-import-row={row.row_index}
      className={cn(
        "flex min-h-[76px] items-center gap-2 px-3 py-2 transition-[background-color] duration-150",
        active
          ? "bg-black/[0.045] dark:bg-white/[0.055]"
          : "hover:bg-black/[0.022] dark:hover:bg-white/[0.025]",
      )}
    >
      <button
        type="button"
        aria-label={`${row.included ? "Exclude" : "Include"} row ${row.row_index + 1}: ${row.reviewed_data.fullName || "Unnamed contact"}`}
        aria-pressed={row.included}
        disabled={disabled}
        onClick={onToggle}
        className="relative grid size-10 shrink-0 place-items-center rounded-xl transition-[background-color,scale] duration-150 hover:bg-black/[0.05] active:scale-[0.96] dark:hover:bg-white/[0.06]"
      >
        <span
          className={cn(
            "grid size-5 place-items-center rounded-md shadow-[0_0_0_1px_var(--admin-border)]",
            row.included
              ? "bg-[#0b0b0b] text-white dark:bg-white dark:text-black"
              : "bg-[var(--admin-surface)] text-transparent",
          )}
        >
          <Check className="size-3" />
        </span>
      </button>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-[scale] duration-150 active:scale-[0.98]"
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            statusTone(row.status),
          )}
        >
          {row.errors.length ? (
            <AlertTriangle className="size-4" />
          ) : row.action === "update" ? (
            <RefreshCw className="size-4" />
          ) : (
            <UserRoundCheck className="size-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[var(--admin-ink)]">
            <span className="admin-number mr-2 text-xs font-normal text-[var(--admin-muted)]">
              {row.row_index + 1}
            </span>
            {row.reviewed_data.fullName || "Unnamed contact"}
          </span>
          <span className="admin-copy mt-0.5 block truncate text-xs">
            {row.reviewed_data.email || row.reviewed_data.phone || "Missing contact method"}
          </span>
        </span>
        <span className="hidden rounded-full bg-black/[0.045] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--admin-muted)] dark:bg-white/[0.06] sm:block">
          {row.action}
        </span>
        <ChevronRight className="size-4 shrink-0 text-[var(--admin-muted)]" />
      </button>
    </div>
  );
}

function RowEditor({
  row,
  disabled,
  onPatch,
  onField,
}: {
  row: ImportRow;
  disabled: boolean;
  onPatch: (patch: Partial<ImportRow>) => void;
  onField: (field: keyof ContactFields, value: string) => void;
}) {
  const fields: Array<{ key: keyof ContactFields; label: string; placeholder: string }> = [
    { key: "fullName", label: "Full name", placeholder: "Required before import" },
    { key: "email", label: "Email", placeholder: "Not provided" },
    { key: "phone", label: "Phone", placeholder: "Not provided" },
    { key: "companyName", label: "Company", placeholder: "Not provided" },
    { key: "role", label: "Role", placeholder: "Not provided" },
    { key: "website", label: "Website", placeholder: "Not provided" },
    { key: "industry", label: "Industry", placeholder: "Not provided" },
    { key: "source", label: "Source", placeholder: "Not provided" },
  ];
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="admin-eyebrow">Row {row.row_index + 1}</p>
          <h2 className="text-balance font-display text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">
            Edit approved values
          </h2>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
            row.confidence === "low" ? statusTone("needs_review") : statusTone("ready"),
          )}
        >
          {row.confidence} confidence
        </span>
      </div>
      <details
        key={row.id}
        open={row.status === "needs_review"}
        className="mt-5 rounded-xl bg-[var(--admin-surface-subtle)] p-3"
        data-testid="contact-import-original"
      >
        <summary className="min-h-10 cursor-pointer content-center text-sm font-semibold text-[var(--admin-ink)]">
          Original source · row {row.row_index + 1}
        </summary>
        <p className="admin-copy mt-2 text-xs">
          Use these original values to check or correct the proposed contact.
        </p>
        <dl className="mt-3 space-y-3 text-xs">
          {Object.entries(row.raw_data ?? {}).map(([key, value]) => (
            <div key={key}>
              <dt className="font-semibold text-[var(--admin-muted)] [overflow-wrap:anywhere]">
                {key}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-[var(--admin-ink)] [overflow-wrap:anywhere]">
                {value || "(empty)"}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="admin-field-label">
            <span>{field.label}</span>
            <input
              className="admin-field"
              value={row.reviewed_data[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) => onField(field.key, event.target.value)}
            />
          </label>
        ))}
      </div>
      <label className="admin-field-label mt-4">
        <span>Notes</span>
        <textarea
          className="admin-field min-h-24 resize-y py-3"
          value={row.reviewed_data.notes ?? ""}
          placeholder="No source-backed notes provided"
          onChange={(event) => onField("notes", event.target.value)}
        />
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
        <label className="admin-field-label">
          <span>Import decision</span>
          <select
            className="admin-field"
            value={row.action}
            onChange={(event) =>
              onPatch({
                action: event.target.value as Action,
                included: event.target.value !== "skip",
              })
            }
          >
            <option value="create">Create new contact</option>
            <option value="update">Enrich matched contact</option>
            <option value="skip">Skip this row</option>
          </select>
        </label>
        <div className="rounded-xl bg-[var(--admin-surface-subtle)] p-3">
          <p className="text-xs font-semibold text-[var(--admin-ink)]">Identity decision</p>
          <p className="admin-copy mt-1 text-pretty text-xs leading-5">
            {row.match_reason || "No match evidence"}
          </p>
        </div>
      </div>
      {(row.errors.length > 0 || row.warnings.length > 0 || row.error) && (
        <div className="mt-4 space-y-2">
          {[...row.errors, ...(row.error ? [row.error] : [])].map((message) => (
            <p
              key={message}
              className="flex items-start gap-2 rounded-xl bg-red-500/8 p-3 text-xs text-red-700 dark:text-red-300"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {message}
            </p>
          ))}
          {row.warnings.map((message) => (
            <p
              key={message}
              className="flex items-start gap-2 rounded-xl bg-amber-500/9 p-3 text-xs text-amber-800 dark:text-amber-300"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {message}
            </p>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function ResultPanel({
  batch,
  onRetry,
  busy,
}: {
  batch: ImportBatch;
  onRetry?: () => void;
  busy: boolean;
}) {
  const imported =
    batch.rows?.filter((row) => row.status === "imported").length ??
    Number(batch.summary.imported || 0);
  const failed =
    batch.rows?.filter((row) => row.status === "failed").length ??
    Number(batch.summary.failed || 0);
  return (
    <AdminSurface
      padding="lg"
      tone={failed ? "attention" : "default"}
      className="mx-auto max-w-3xl text-center"
    >
      <span
        className={cn(
          "mx-auto grid size-14 place-items-center rounded-2xl",
          failed
            ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        )}
      >
        {failed ? <AlertTriangle className="size-6" /> : <CheckCircle2 className="size-6" />}
      </span>
      <h2 className="mt-5 text-balance font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--admin-ink)]">
        {failed ? "Import completed with rows to review" : "Contacts imported with receipts"}
      </h2>
      <p className="admin-copy mx-auto mt-2 max-w-xl text-pretty text-sm">
        {imported} row{imported === 1 ? "" : "s"} reached canonical contacts.{" "}
        {failed
          ? `${failed} failed row${failed === 1 ? "" : "s"} kept their approved data and can be retried safely.`
          : "The completed batch can be reopened from history at any time."}
      </p>
      <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
        <div className="rounded-xl bg-[var(--admin-surface-subtle)] p-4">
          <p className="admin-number text-2xl font-semibold text-[var(--admin-ink)]">{imported}</p>
          <p className="admin-copy text-xs">Imported</p>
        </div>
        <div className="rounded-xl bg-[var(--admin-surface-subtle)] p-4">
          <p className="admin-number text-2xl font-semibold text-[var(--admin-ink)]">{failed}</p>
          <p className="admin-copy text-xs">Needs attention</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          disabled={busy}
          onClick={onRetry}
          className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0b0b0b] px-4 text-sm font-semibold text-white transition-[scale,opacity] duration-150 active:scale-[0.96] disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{" "}
          Retry failed rows
        </button>
      )}
    </AdminSurface>
  );
}

function ImportHistory({
  history,
  busy,
  loading,
  failed,
  onRetry,
  onOpen,
}: {
  history: ImportBatch[];
  busy: boolean;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <AdminSurface padding="none" className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-4 shadow-[0_1px_0_var(--admin-rule)]">
        <History className="size-4 text-[var(--admin-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--admin-ink)]">Recent imports</h2>
      </div>
      <div className="divide-y divide-[var(--admin-rule)]">
        {history.slice(0, 6).map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busy}
            onClick={() => onOpen(item.id)}
            className="flex min-h-16 w-full items-center gap-3 px-4 text-left transition-[background-color,scale] duration-150 hover:bg-black/[0.025] active:scale-[0.99] disabled:opacity-50 dark:hover:bg-white/[0.03]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]">
              {item.source_type === "json" ? (
                <FileJson className="size-4" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-[var(--admin-ink)]">
                {item.original_filename || `${item.source_type.toUpperCase()} paste`}
              </span>
              <span className="admin-copy admin-number mt-0.5 block text-[10px]">
                {item.proposed_row_count} rows · {new Date(item.created_at).toLocaleString()}
                {item.ai_provider === "none" ? " · No AI used" : ""}
              </span>
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em]",
                statusTone(item.status),
              )}
            >
              {labelStatus(item.status)}
            </span>
          </button>
        ))}
        {failed && (
          <div className="p-4" role="alert">
            <p className="admin-copy text-xs">
              Recent imports could not be loaded. Your current review is still available.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 min-h-10 rounded-xl px-3 text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-surface-subtle)]"
            >
              Retry history
            </button>
          </div>
        )}
        {loading && (
          <p className="admin-copy p-4 text-xs" role="status">
            Loading recent imports…
          </p>
        )}
        {!history.length && !loading && !failed && (
          <p className="admin-copy px-4 py-8 text-center text-xs">
            Completed and reviewable batches will appear here.
          </p>
        )}
      </div>
    </AdminSurface>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-2xl bg-red-500/8 p-4 text-sm text-red-800 shadow-[0_0_0_1px_rgba(185,28,28,.13)] dark:text-red-300"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p className="text-pretty">{message}</p>
    </div>
  );
}
