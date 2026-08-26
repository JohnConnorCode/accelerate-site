"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronRight, FileJson,
  FileSpreadsheet, FileUp, History, Loader2, RefreshCw, ShieldCheck, Sparkles,
  UserRoundCheck, UsersRound, X,
} from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { PageHeader } from "@/components/admin/PageHeader";
import { ContactIntakeNav } from "@/components/admin/ContactIntakeNav";
import { adminListItemVariants, adminListVariants, adminSectionVariants } from "@/lib/admin/motion";
import { cn } from "@/lib/utils";

type Action = "create" | "update" | "skip";
type Confidence = "high" | "medium" | "low";
type ContactFields = {
  fullName: string; email: string | null; phone: string | null; companyName: string | null;
  role: string | null; website: string | null; industry: string | null; source: string | null; notes: string | null;
};
type ImportRow = {
  id: string; row_index: number; status: string; action: Action; included: boolean; confidence: Confidence;
  reviewed_data: ContactFields; warnings: string[]; errors: string[]; match_reason: string | null;
  matched_contact_id: string | null; imported_contact_id: string | null; error: string | null;
};
type ImportBatch = {
  id: string; status: string; source_type: string; original_filename: string | null; source_row_count: number;
  proposed_row_count: number; selected_row_count: number; review_digest: string | null; approval_digest: string | null;
  ai_model: string | null; summary: Record<string, number>; error: string | null; approved_by: string | null;
  approved_at: string | null; completed_at: string | null; created_at: string; updated_at: string; rows?: ImportRow[];
};

const EMPTY_SAMPLE = `Jane Martinez, jane@martinezroofing.com, 512-555-0142, Martinez Roofing, Owner\nSam Lee — Operations Director at Northstar HVAC — sam@northstarhvac.com\nPriya Shah | priya@example.com | met at Austin builders meetup; interested in faster estimate follow-up`;

function statusTone(status: string) {
  if (["completed", "imported"].includes(status)) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["failed", "partial", "needs_review"].includes(status)) return "bg-amber-500/12 text-amber-800 dark:text-amber-300";
  if (["approved", "executing"].includes(status)) return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]";
}

function labelStatus(status: string) { return status.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }

async function api(body?: Record<string, unknown>, id?: string) {
  const response = await fetch(id ? `/api/admin/revenue-os/contact-imports?id=${encodeURIComponent(id)}` : "/api/admin/revenue-os/contact-imports", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || "Contact Import request failed"), { schemaReady: data.schemaReady, batchId: data.batchId });
  return data;
}

export default function ContactImportsPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [sourceText, setSourceText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"analyze" | "save" | "execute" | "history" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saved, setSaved] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api();
      setSchemaReady(data.schemaReady !== false);
      setHistory(data.batches || []);
    } catch (cause) {
      const value = cause as Error & { schemaReady?: boolean };
      if (value.schemaReady === false) setSchemaReady(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);
  const rows = useMemo(() => batch?.rows ?? [], [batch?.rows]);
  const activeRow = rows.find((row) => row.id === activeRowId) ?? rows[0] ?? null;
  const selectedRows = rows.filter((row) => row.included && row.action !== "skip");
  const summary = useMemo(() => ({
    create: selectedRows.filter((row) => row.action === "create").length,
    update: selectedRows.filter((row) => row.action === "update").length,
    needsReview: rows.filter((row) => row.errors.length || row.confidence === "low").length,
    excluded: rows.filter((row) => !row.included || row.action === "skip").length,
  }), [rows, selectedRows]);

  async function analyze() {
    setError(null); setBusy("analyze");
    try {
      const data = await api({ action: "analyze", sourceText, filename, instructions });
      setBatch(data.batch); setActiveRowId(data.batch?.rows?.[0]?.id ?? null); setSaved(true); setSchemaReady(true);
      await loadHistory();
    } catch (cause) {
      const value = cause as Error & { schemaReady?: boolean };
      setError(value.message); if (value.schemaReady === false) setSchemaReady(false);
    } finally { setBusy(null); }
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    setError(null);
    if (file.size > 250_000) { setError("Choose a UTF-8 text file smaller than 250 KB."); return; }
    if (!/\.(csv|tsv|json|txt)$/i.test(file.name)) { setError("Use CSV, TSV, JSON, or TXT. Spreadsheet binaries are not read silently."); return; }
    try { setSourceText(await file.text()); setFilename(file.name); }
    catch { setError("This file could not be read as UTF-8 text."); }
  }

  function patchRow(id: string, patch: Partial<ImportRow>) {
    setBatch((current) => current ? { ...current, rows: current.rows?.map((row) => row.id === id ? { ...row, ...patch } : row) } : current);
    setSaved(false);
  }

  function patchField(id: string, key: keyof ContactFields, value: string) {
    setBatch((current) => current ? { ...current, rows: current.rows?.map((row) => row.id === id ? { ...row, reviewed_data: { ...row.reviewed_data, [key]: value || null } } : row) } : current);
    setSaved(false);
  }

  async function saveReview() {
    if (!batch) return;
    setError(null); setBusy("save");
    try {
      const data = await api({ action: "save_review", batchId: batch.id, rows: rows.map((row) => ({ id: row.id, included: row.included, action: row.action, data: row.reviewed_data })) });
      setBatch(data.batch); setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save review"); }
    finally { setBusy(null); }
  }

  async function approveAndExecute() {
    if (!batch?.review_digest) return;
    setError(null); setBusy("execute"); setConfirmOpen(false);
    try {
      if (!saved) throw new Error("Save the current edits before approving this batch.");
      await api({ action: "approve", batchId: batch.id, expectedDigest: batch.review_digest });
      const data = await api({ action: "execute", batchId: batch.id });
      setBatch(data.batch); await loadHistory();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not execute import"); }
    finally { setBusy(null); }
  }

  async function retryPartial() {
    if (!batch) return;
    setError(null); setBusy("execute");
    try { const data = await api({ action: "execute", batchId: batch.id }); setBatch(data.batch); await loadHistory(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not retry failed rows"); }
    finally { setBusy(null); }
  }

  async function openBatch(id: string) {
    setBusy("history"); setError(null);
    try { const data = await api(undefined, id); setBatch(data.batch); setActiveRowId(data.batch?.rows?.[0]?.id ?? null); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open import"); }
    finally { setBusy(null); }
  }

  const finished = batch && ["completed", "partial"].includes(batch.status);

  return (
    <div>
      <PageHeader
        title="Contact intake"
        subtitle="Review website inquiries and bring external contact lists into the same controlled intake workflow."
        actions={batch && !finished ? <button type="button" onClick={() => { setBatch(null); setSourceText(""); setFilename(null); setError(null); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-[var(--admin-muted)] transition-[background-color,color,scale] duration-150 hover:bg-black/[0.045] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.06]"><X className="size-4" /> Start over</button> : undefined}
      />
      <ContactIntakeNav active="import" />

      <AnimatePresence initial={false} mode="wait">
        {!batch ? (
          <motion.div key="source" variants={adminSectionVariants} initial="hidden" animate="visible" exit={{ opacity: 0, y: -8 }} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <AdminSurface padding="lg" className="overflow-hidden">
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><Sparkles className="size-4" /></span>
                  <div><h2 className="text-balance font-display text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">Give it whatever contact data you have</h2><p className="admin-copy mt-1 text-sm">OpenRouter identifies fields and cleans formatting. The importer then validates and checks existing identities before showing a preview.</p></div>
                </div>
                <label className="admin-field-label">
                  <span>Paste names, notes, rows, or exported data</span>
                  <textarea value={sourceText} onChange={(event) => { setSourceText(event.target.value); setFilename(null); }} placeholder={EMPTY_SAMPLE} className="admin-field !min-h-40 resize-y py-3 font-mono text-[12px] leading-6" data-testid="contact-import-source" />
                </label>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="admin-field-label"><span>Optional context for the cleanup</span><input value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Example: these came from the Austin builders meetup" className="admin-field" /></label>
                  <input ref={fileInput} className="sr-only" type="file" accept=".csv,.tsv,.json,.txt,text/csv,text/tab-separated-values,application/json,text/plain" onChange={(event) => void chooseFile(event.target.files?.[0])} />
                  <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[var(--admin-surface-subtle)] px-4 text-sm font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,scale] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"><FileUp className="size-4" /> Choose file</button>
                </div>
                {filename && <p className="flex items-center gap-2 text-xs font-medium text-[var(--admin-muted)]"><FileSpreadsheet className="size-3.5" /> {filename}</p>}
                <button type="button" disabled={!sourceText.trim() || busy === "analyze" || !schemaReady} onClick={() => void analyze()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0b0b0b] pl-5 pr-[18px] text-sm font-semibold text-white shadow-[var(--admin-shadow)] transition-[box-shadow,scale,opacity] duration-150 hover:shadow-[var(--admin-shadow-hover)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-black" data-testid="contact-import-analyze">
                  {busy === "analyze" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Analyze and build review <ArrowRight className="size-4" />
                </button>
              </div>
            </AdminSurface>
            <div className="space-y-5">
              <AdminSurface tone="subtle" padding="lg"><span className="grid size-10 place-items-center rounded-full bg-[var(--admin-surface)] text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)]"><ShieldCheck className="size-4" /></span><h2 className="mt-4 text-balance font-display text-lg font-semibold text-[var(--admin-ink)]">Nothing imports on analysis</h2><ul className="admin-copy mt-3 space-y-2 text-pretty text-sm"><li>AI can propose fields; it cannot approve or write contacts.</li><li>Low-confidence and ambiguous rows start excluded.</li><li>You approve the exact edited snapshot.</li><li>No opportunities, campaigns, or messages are created.</li></ul></AdminSurface>
              <ImportHistory history={history} busy={busy === "history"} onOpen={(id) => void openBatch(id)} />
            </div>
          </motion.div>
        ) : (
          <motion.div key={batch.id} variants={adminSectionVariants} initial="hidden" animate="visible" exit={{ opacity: 0, y: -8 }}>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Selected" value={selectedRows.length} detail={`${rows.length} proposed`} icon={UsersRound} />
              <Metric label="New contacts" value={summary.create} detail="Will create" icon={UserRoundCheck} />
              <Metric label="Existing" value={summary.update} detail="Fill blank fields" icon={RefreshCw} />
              <Metric label="Needs attention" value={summary.needsReview} detail={`${summary.excluded} excluded`} icon={AlertTriangle} attention={summary.needsReview > 0} />
            </div>

            {error && <ErrorNotice message={error} />}
            {finished ? (
              <ResultPanel batch={batch} onRetry={batch.status === "partial" ? () => void retryPartial() : undefined} busy={busy === "execute"} />
            ) : (
              <div className="grid min-h-[620px] gap-5 lg:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
                <AdminSurface padding="none" className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-4 shadow-[0_1px_0_var(--admin-rule)] sm:px-5"><div><h2 className="font-display text-lg font-semibold text-[var(--admin-ink)]">Review rows</h2><p className="admin-copy text-xs">Select a row to edit its approved values.</p></div><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]", statusTone(batch.status))}>{labelStatus(batch.status)}</span></div>
                  <motion.div variants={adminListVariants} initial="hidden" animate="visible" className="max-h-[690px] divide-y divide-[var(--admin-rule)] overflow-y-auto">
                    {rows.map((row) => <RowListItem key={row.id} row={row} active={activeRow?.id === row.id} onSelect={() => setActiveRowId(row.id)} onToggle={() => patchRow(row.id, { included: !row.included })} />)}
                  </motion.div>
                </AdminSurface>
                <AdminSurface padding="lg" className="h-fit lg:sticky lg:top-6">
                  {activeRow ? <RowEditor row={activeRow} onPatch={(patch) => patchRow(activeRow.id, patch)} onField={(field, value) => patchField(activeRow.id, field, value)} /> : <p className="admin-copy py-20 text-center text-sm">No rows were extracted.</p>}
                </AdminSurface>
              </div>
            )}

            {!finished && <div data-contact-import-actions className="sticky bottom-3 z-20 mt-5 flex items-center justify-between gap-2 rounded-2xl bg-[#0b0b0b] p-3 text-white shadow-[0_24px_70px_-24px_rgba(0,0,0,.65)] sm:bottom-4 sm:gap-3 sm:p-4"><div className="min-w-0 px-1"><p className="truncate text-xs font-semibold sm:text-sm">{saved ? "Review saved" : "Unsaved changes"}</p><p className="mt-0.5 hidden text-pretty text-xs text-white/55 sm:block">{selectedRows.length} selected · {summary.create} create · {summary.update} enrich · no email will be sent</p></div><div className="flex shrink-0 gap-2"><button type="button" disabled={busy !== null || saved} onClick={() => void saveReview()} className="min-h-10 rounded-xl px-3 text-xs font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,.18)] transition-[background-color,scale,opacity] duration-150 hover:bg-white/8 active:scale-[0.96] disabled:opacity-40 sm:px-4 sm:text-sm">{busy === "save" ? "Saving…" : "Save"}</button><button type="button" disabled={busy !== null || !saved || !selectedRows.length || batch.status !== "ready"} onClick={() => setConfirmOpen(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white pl-3 pr-2.5 text-xs font-bold text-black transition-[scale,opacity] duration-150 active:scale-[0.96] disabled:opacity-40 sm:gap-2 sm:pl-4 sm:pr-3.5 sm:text-sm" data-testid="contact-import-approve"><span className="sm:hidden">Approve</span><span className="hidden sm:inline">Review approval</span><ChevronRight className="size-4" /></button></div></div>}
          </motion.div>
        )}
      </AnimatePresence>

      {!schemaReady && <ErrorNotice message="Contact Import is not activated yet. Apply migrations/20260816-contact-importer.sql, then refresh this page." />}
      {error && !batch && <ErrorNotice message={error} />}

      <AdminDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Approve contact import" maxWidth="md">
        <AdminSurface padding="none" className="admin-dialog-surface overflow-hidden rounded-2xl">
          <div className="p-5 sm:p-6"><span className="grid size-11 place-items-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><ShieldCheck className="size-5" /></span><h2 className="admin-dialog-title mt-5">Approve this exact import snapshot?</h2><p className="admin-copy mt-2 text-sm">This approval covers {selectedRows.length} reviewed rows: {summary.create} new contacts and {summary.update} existing contacts enriched only where fields are blank.</p><div className="mt-5 rounded-xl bg-[var(--admin-surface-subtle)] p-4 text-sm"><p className="flex items-center gap-2 font-semibold text-[var(--admin-ink)]"><Check className="size-4 text-emerald-600" /> Contact and company records only</p><p className="mt-2 flex items-center gap-2 font-semibold text-[var(--admin-ink)]"><Check className="size-4 text-emerald-600" /> Row-level receipts and audit history</p><p className="mt-2 flex items-center gap-2 font-semibold text-[var(--admin-ink)]"><X className="size-4 text-[var(--admin-muted)]" /> No email, campaign, task, or opportunity</p></div></div>
          <div className="flex flex-col-reverse gap-2 bg-[var(--admin-surface-subtle)] p-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setConfirmOpen(false)} className="min-h-10 rounded-xl px-4 text-sm font-semibold text-[var(--admin-muted)] transition-[background-color,scale] duration-150 hover:bg-black/[0.05] active:scale-[0.96] dark:hover:bg-white/[0.06]">Keep reviewing</button><button type="button" onClick={() => void approveAndExecute()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0b0b0b] pl-4 pr-3.5 text-sm font-semibold text-white transition-[scale] duration-150 active:scale-[0.96] dark:bg-white dark:text-black" data-testid="contact-import-confirm"><ShieldCheck className="size-4" /> Approve and import</button></div>
        </AdminSurface>
      </AdminDialog>
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon, attention = false }: { label: string; value: number; detail: string; icon: typeof UsersRound; attention?: boolean }) {
  return <motion.div variants={adminListItemVariants}><AdminSurface padding="md" tone={attention ? "attention" : "default"}><div className="flex items-start justify-between"><div><p className="admin-eyebrow">{label}</p><p className="admin-number mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--admin-ink)]">{value}</p><p className="admin-copy mt-1 text-xs">{detail}</p></div><span className="grid size-9 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]"><Icon className="size-4" /></span></div></AdminSurface></motion.div>;
}

function RowListItem({ row, active, onSelect, onToggle }: { row: ImportRow; active: boolean; onSelect: () => void; onToggle: () => void }) {
  return <motion.div variants={adminListItemVariants} className={cn("flex min-h-[76px] items-center gap-2 px-3 py-2 transition-[background-color] duration-150", active ? "bg-black/[0.045] dark:bg-white/[0.055]" : "hover:bg-black/[0.022] dark:hover:bg-white/[0.025]")}>
    <button type="button" aria-label={`${row.included ? "Exclude" : "Include"} ${row.reviewed_data.fullName}`} onClick={onToggle} className="relative grid size-10 shrink-0 place-items-center rounded-xl transition-[background-color,scale] duration-150 hover:bg-black/[0.05] active:scale-[0.96] dark:hover:bg-white/[0.06]"><span className={cn("grid size-5 place-items-center rounded-md shadow-[0_0_0_1px_var(--admin-border)]", row.included ? "bg-[#0b0b0b] text-white dark:bg-white dark:text-black" : "bg-[var(--admin-surface)] text-transparent")}><Check className="size-3" /></span></button>
    <button type="button" onClick={onSelect} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-[scale] duration-150 active:scale-[0.98]"><span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", statusTone(row.status))}>{row.errors.length ? <AlertTriangle className="size-4" /> : row.action === "update" ? <RefreshCw className="size-4" /> : <UserRoundCheck className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--admin-ink)]">{row.reviewed_data.fullName || "Unnamed contact"}</span><span className="admin-copy mt-0.5 block truncate text-xs">{row.reviewed_data.email || row.reviewed_data.phone || "Missing contact method"}</span></span><span className="hidden rounded-full bg-black/[0.045] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--admin-muted)] dark:bg-white/[0.06] sm:block">{row.action}</span><ChevronRight className="size-4 shrink-0 text-[var(--admin-muted)]" /></button>
  </motion.div>;
}

function RowEditor({ row, onPatch, onField }: { row: ImportRow; onPatch: (patch: Partial<ImportRow>) => void; onField: (field: keyof ContactFields, value: string) => void }) {
  const fields: Array<{ key: keyof ContactFields; label: string; placeholder: string }> = [
    { key: "fullName", label: "Full name", placeholder: "Required before import" }, { key: "email", label: "Email", placeholder: "Not provided" },
    { key: "phone", label: "Phone", placeholder: "Not provided" }, { key: "companyName", label: "Company", placeholder: "Not provided" },
    { key: "role", label: "Role", placeholder: "Not provided" }, { key: "website", label: "Website", placeholder: "Not provided" },
    { key: "industry", label: "Industry", placeholder: "Not provided" }, { key: "source", label: "Source", placeholder: "Not provided" },
  ];
  return <div>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="admin-eyebrow">Row {row.row_index + 1}</p><h2 className="text-balance font-display text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">Edit approved values</h2></div><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]", row.confidence === "low" ? statusTone("needs_review") : statusTone("ready"))}>{row.confidence} confidence</span></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map((field) => <label key={field.key} className="admin-field-label"><span>{field.label}</span><input className="admin-field" value={row.reviewed_data[field.key] ?? ""} placeholder={field.placeholder} onChange={(event) => onField(field.key, event.target.value)} /></label>)}</div>
    <label className="admin-field-label mt-4"><span>Notes</span><textarea className="admin-field min-h-24 resize-y py-3" value={row.reviewed_data.notes ?? ""} placeholder="No source-backed notes provided" onChange={(event) => onField("notes", event.target.value)} /></label>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]"><label className="admin-field-label"><span>Import decision</span><select className="admin-field" value={row.action} onChange={(event) => onPatch({ action: event.target.value as Action, included: event.target.value !== "skip" })}><option value="create">Create new contact</option><option value="update">Enrich matched contact</option><option value="skip">Skip this row</option></select></label><div className="rounded-xl bg-[var(--admin-surface-subtle)] p-3"><p className="text-xs font-semibold text-[var(--admin-ink)]">Identity decision</p><p className="admin-copy mt-1 text-pretty text-xs leading-5">{row.match_reason || "No match evidence"}</p></div></div>
    {(row.errors.length > 0 || row.warnings.length > 0 || row.error) && <div className="mt-4 space-y-2">{[...row.errors, ...(row.error ? [row.error] : [])].map((message) => <p key={message} className="flex items-start gap-2 rounded-xl bg-red-500/8 p-3 text-xs text-red-700 dark:text-red-300"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{message}</p>)}{row.warnings.map((message) => <p key={message} className="flex items-start gap-2 rounded-xl bg-amber-500/9 p-3 text-xs text-amber-800 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{message}</p>)}</div>}
  </div>;
}

function ResultPanel({ batch, onRetry, busy }: { batch: ImportBatch; onRetry?: () => void; busy: boolean }) {
  const imported = batch.rows?.filter((row) => row.status === "imported").length ?? Number(batch.summary.imported || 0);
  const failed = batch.rows?.filter((row) => row.status === "failed").length ?? Number(batch.summary.failed || 0);
  return <AdminSurface padding="lg" tone={failed ? "attention" : "default"} className="mx-auto max-w-3xl text-center"><span className={cn("mx-auto grid size-14 place-items-center rounded-2xl", failed ? "bg-amber-500/12 text-amber-700 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>{failed ? <AlertTriangle className="size-6" /> : <CheckCircle2 className="size-6" />}</span><h2 className="mt-5 text-balance font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--admin-ink)]">{failed ? "Import completed with rows to review" : "Contacts imported with receipts"}</h2><p className="admin-copy mx-auto mt-2 max-w-xl text-pretty text-sm">{imported} row{imported === 1 ? "" : "s"} reached canonical contacts. {failed ? `${failed} failed row${failed === 1 ? "" : "s"} kept their approved data and can be retried safely.` : "The completed batch can be reopened from history at any time."}</p><div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3"><div className="rounded-xl bg-[var(--admin-surface-subtle)] p-4"><p className="admin-number text-2xl font-semibold text-[var(--admin-ink)]">{imported}</p><p className="admin-copy text-xs">Imported</p></div><div className="rounded-xl bg-[var(--admin-surface-subtle)] p-4"><p className="admin-number text-2xl font-semibold text-[var(--admin-ink)]">{failed}</p><p className="admin-copy text-xs">Needs attention</p></div></div>{onRetry && <button type="button" disabled={busy} onClick={onRetry} className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0b0b0b] px-4 text-sm font-semibold text-white transition-[scale,opacity] duration-150 active:scale-[0.96] disabled:opacity-50 dark:bg-white dark:text-black">{busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Retry failed rows</button>}</AdminSurface>;
}

function ImportHistory({ history, busy, onOpen }: { history: ImportBatch[]; busy: boolean; onOpen: (id: string) => void }) {
  return <AdminSurface padding="none" className="overflow-hidden"><div className="flex items-center gap-2 px-4 py-4 shadow-[0_1px_0_var(--admin-rule)]"><History className="size-4 text-[var(--admin-muted)]" /><h2 className="text-sm font-semibold text-[var(--admin-ink)]">Recent imports</h2></div><div className="divide-y divide-[var(--admin-rule)]">{history.slice(0, 6).map((item) => <button key={item.id} type="button" disabled={busy} onClick={() => onOpen(item.id)} className="flex min-h-16 w-full items-center gap-3 px-4 text-left transition-[background-color,scale] duration-150 hover:bg-black/[0.025] active:scale-[0.99] disabled:opacity-50 dark:hover:bg-white/[0.03]"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]">{item.source_type === "json" ? <FileJson className="size-4" /> : <FileSpreadsheet className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[var(--admin-ink)]">{item.original_filename || `${item.source_type.toUpperCase()} paste`}</span><span className="admin-copy admin-number mt-0.5 block text-[10px]">{item.proposed_row_count} rows · {new Date(item.created_at).toLocaleString()}</span></span><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em]", statusTone(item.status))}>{labelStatus(item.status)}</span></button>)}{!history.length && <p className="admin-copy px-4 py-8 text-center text-xs">Completed and reviewable batches will appear here.</p>}</div></AdminSurface>;
}

function ErrorNotice({ message }: { message: string }) {
  return <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl bg-red-500/8 p-4 text-sm text-red-800 shadow-[0_0_0_1px_rgba(185,28,28,.13)] dark:text-red-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p className="text-pretty">{message}</p></div>;
}
