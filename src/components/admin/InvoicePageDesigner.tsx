"use client";
import { useAdminDemo } from "./AdminDemoBoundary";
import { useId, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import styles from "./InvoicePageDesigner.module.css";
import { Copy, ExternalLink, Monitor, Redo2, Smartphone, Sparkles, Undo2, X } from "lucide-react";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import AdminLink from "@/components/admin/AdminLink";
import { AdminSurface } from "./AdminSurface";
import {
  InvoiceDocument,
  defaultInvoiceDesign,
  type InvoiceDesign,
  type InvoiceDocumentData,
} from "@/components/business/InvoiceDocument";
import type { WorkspaceBrand } from "@/lib/revenue-os/branding-contract";
const button = "admin-button admin-button--secondary";
const primary = "admin-button admin-button--primary";
const field = "admin-field mt-2";
type Preview = {
  brand: WorkspaceBrand;
  design: InvoiceDesign;
  document: InvoiceDocumentData;
  digest: string;
  testMode: boolean;
};
type Pages = {
  tenantSlug: string;
  preview?: Preview;
  pages: {
    id: string;
    token: string | null;
    revokedAt: string | null;
    expiresAt: string;
    design?: InvoiceDesign;
  }[];
};
export function InvoicePageDesigner({
  creationActionId,
  onClose,
  onProposed,
}: {
  creationActionId: string;
  onClose: () => void;
  onProposed: () => Promise<void>;
}) {
  const demo = useAdminDemo();
  const motionId = useId();
  const reducedMotion = useReducedMotion();
  const [history, setHistory] = useState<{
    current: InvoiceDesign | null;
    past: InvoiceDesign[];
    future: InvoiceDesign[];
    field: string | null;
  }>({ current: null, past: [], future: [], field: null });
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "phone">("desktop");
  const [brief, setBrief] = useState(
      "A clean, warm and professional invoice for an ongoing business relationship.",
    ),
    [preview, setPreview] = useState<Preview | null>(null),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const pages = useAdminQuery<Pages>(
    ["admin", "invoice-pages", creationActionId, "designer"],
    `/api/admin/invoicing/pages?creationActionId=${creationActionId}&view=designer`,
  );
  const design = history.current || pages.data?.preview?.design || defaultInvoiceDesign;
  const documentPreview = preview || pages.data?.preview;
  const unavailable = busy || pages.isPending || !documentPreview;
  function customerUrl(token: string) {
    return demo
      ? `/demo/command-center/${demo.scenarioId}/invoicing?demoInvoice=${token}`
      : `/t/${encodeURIComponent(pages.data!.tenantSlug)}/invoice/${token}`;
  }
  async function request(body: Record<string, unknown>) {
    return fetchJson<Preview>("/api/admin/invoicing/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creationActionId, ...body }),
    });
  }
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Page design request failed");
    } finally {
      setBusy(false);
    }
  }
  function invalidateReview() {
    setReviewed(false);
    setError("");
    setNotice("");
  }
  function edit(next: InvoiceDesign, field: string | null = null) {
    if (JSON.stringify(next) === JSON.stringify(design)) return;
    setHistory((previous) => ({
      current: next,
      past:
        field && previous.field === field ? previous.past : [...previous.past, design].slice(-40),
      future: [],
      field,
    }));
    invalidateReview();
  }
  function travel(direction: "undo" | "redo") {
    setHistory((previous) => {
      const source = direction === "undo" ? previous.past : previous.future;
      const target = direction === "undo" ? source.at(-1) : source[0];
      if (!target) return previous;
      return direction === "undo"
        ? {
            current: target,
            past: source.slice(0, -1),
            future: [design, ...previous.future],
            field: null,
          }
        : {
            current: target,
            past: [...previous.past, design].slice(-40),
            future: source.slice(1),
            field: null,
          };
    });
    invalidateReview();
  }
  function finishField() {
    setHistory((previous) => ({ ...previous, field: null }));
  }
  return (
    <AdminSurface padding="lg" className={styles.studio}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={styles.title}>Customer invoice page</h2>
          <p className="admin-copy mt-2 text-sm">
            Edit wording, layout, typography, and color. Stripe supplies the billing details.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close invoice page designer"
          className={button}
          disabled={busy}
          onClick={onClose}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm">
          {error}
        </p>
      )}
      <AnimatePresence initial={false}>
        {notice && (
          <motion.p
            key={notice}
            role="status"
            className="mt-4 text-sm"
            initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
          >
            {demo ? "Simulated · " : ""}
            {notice}
          </motion.p>
        )}
      </AnimatePresence>
      <LayoutGroup id={motionId}>
        <div className="mt-6 grid items-start gap-7 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <fieldset
            disabled={unavailable}
            className={`${styles.controls} min-w-0 space-y-5`}
            aria-busy={busy}
          >
            <legend className="sr-only">Invoice page presentation</legend>
            <div>
              <p className="text-sm font-medium">Style starters</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      name: "Workspace",
                      layout: "classic",
                      font: "workspace",
                      spacing: "comfortable",
                    },
                    {
                      name: "Editorial",
                      layout: "editorial",
                      font: "serif",
                      spacing: "comfortable",
                    },
                    { name: "Minimal", layout: "classic", font: "sans", spacing: "compact" },
                  ] as const
                ).map((style) => (
                  <button
                    type="button"
                    key={style.name}
                    className={styles.starter}
                    aria-label={`Use ${style.name.toLowerCase()} style`}
                    aria-pressed={
                      design.layout === style.layout &&
                      (design.font || "workspace") === style.font &&
                      (design.spacing || "comfortable") === style.spacing
                    }
                    onClick={() =>
                      edit({
                        ...design,
                        layout: style.layout,
                        font: style.font,
                        spacing: style.spacing,
                      })
                    }
                  >
                    {design.layout === style.layout &&
                      (design.font || "workspace") === style.font &&
                      (design.spacing || "comfortable") === style.spacing && (
                        <motion.span
                          aria-hidden="true"
                          layoutId="style-selection"
                          className={styles.starterSelection}
                          transition={{
                            type: "spring",
                            duration: reducedMotion ? 0 : 0.3,
                            bounce: 0,
                          }}
                        />
                      )}
                    <span
                      aria-hidden="true"
                      className={`${styles.miniature} ${style.name === "Editorial" ? styles.miniatureEditorial : ""}`}
                    >
                      <span
                        className="h-1 w-full"
                        style={{
                          backgroundColor: design.accentColor || documentPreview?.brand.accentColor,
                        }}
                      />
                      <span className={styles.miniatureHeading}>
                        {style.name === "Editorial"
                          ? "Aa"
                          : style.name === "Minimal"
                            ? "01"
                            : "Invoice"}
                      </span>
                      <span className="h-px w-full bg-current/20" />
                      <span className="h-px w-full bg-current/20" />
                    </span>
                    <span className="relative">{style.name}</span>
                  </button>
                ))}
              </div>
              <p className="admin-copy mt-2 text-xs">Keeps your wording and accent color.</p>
            </div>
            <div className={styles.aiPanel}>
              <label className="text-sm font-medium">
                Describe your changes
                <textarea
                  className={field}
                  value={brief}
                  maxLength={1000}
                  rows={3}
                  onChange={(event) => setBrief(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={`${primary} mt-3 w-full`}
                disabled={!brief.trim() || !design.heading.trim()}
                onClick={() =>
                  void perform(async () => {
                    const result = await fetchJson<{ design: InvoiceDesign }>(
                      "/api/admin/invoicing/pages",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          mode: "generate",
                          creationActionId,
                          brief,
                          currentDesign: design,
                        }),
                      },
                    );
                    edit(result.design);
                    setNotice(
                      "AI changes applied to this draft. Preview the page before requesting publication.",
                    );
                  })
                }
              >
                <Sparkles className="size-4" aria-hidden="true" />
                {busy ? "Working…" : "Apply AI changes"}
              </button>
              <p className="admin-copy mt-3 text-xs leading-5">
                {demo
                  ? "Simulated AI presentation from this fictional business. No AI provider is called."
                  : "Uses your workspace’s AI connection."}
              </p>
            </div>
            <label className="block text-sm font-medium">
              Layout
              <select
                className={field}
                value={design.layout}
                onChange={(event) =>
                  edit({ ...design, layout: event.target.value as InvoiceDesign["layout"] })
                }
              >
                <option value="classic">Classic · Quiet and structured</option>
                <option value="editorial">Editorial · Bold heading</option>
              </select>
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Typography
                <select
                  className={field}
                  value={design.font || "workspace"}
                  onChange={(event) =>
                    edit({ ...design, font: event.target.value as InvoiceDesign["font"] })
                  }
                >
                  <option value="workspace">Workspace font</option>
                  <option value="sans">Modern sans serif</option>
                  <option value="serif">Editorial serif</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Spacing
                <select
                  className={field}
                  value={design.spacing || "comfortable"}
                  onChange={(event) =>
                    edit({ ...design, spacing: event.target.value as InvoiceDesign["spacing"] })
                  }
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium">
                Invoice accent color
                <input
                  type="color"
                  className={`${field} min-h-11 w-full`}
                  value={design.accentColor || documentPreview?.brand.accentColor || "#2563eb"}
                  onChange={(event) => edit({ ...design, accentColor: event.target.value })}
                />
              </label>
              {design.accentColor && (
                <button
                  type="button"
                  className={`${button} mt-2`}
                  onClick={() => edit({ ...design, accentColor: undefined })}
                >
                  Use workspace color
                </button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium">
                Heading
                <input
                  className={field}
                  value={design.heading}
                  maxLength={80}
                  onChange={(event) => edit({ ...design, heading: event.target.value }, "heading")}
                  onBlur={finishField}
                  aria-invalid={!design.heading.trim()}
                  aria-describedby={!design.heading.trim() ? `${motionId}-heading-help` : undefined}
                />
              </label>
              {!design.heading.trim() && (
                <p id={`${motionId}-heading-help`} className="admin-copy mt-2 block text-xs">
                  Enter a heading before using AI or reviewing this page.
                </p>
              )}
            </div>
            <label className="block text-sm font-medium">
              Introduction
              <textarea
                className={field}
                rows={3}
                maxLength={500}
                value={design.introduction}
                onChange={(event) =>
                  edit({ ...design, introduction: event.target.value }, "introduction")
                }
                onBlur={finishField}
              />
            </label>
            <label className="block text-sm font-medium">
              Closing note
              <textarea
                className={field}
                rows={2}
                maxLength={300}
                value={design.closing}
                onChange={(event) => edit({ ...design, closing: event.target.value }, "closing")}
                onBlur={finishField}
              />
            </label>
            <AdminLink
              className="inline-flex min-h-11 items-center text-sm underline"
              href="/admin/branding"
            >
              Manage workspace logo and colors
            </AdminLink>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={button}
                disabled={!design.heading.trim()}
                onClick={() =>
                  void perform(async () => {
                    const result = await request({ mode: "preview", design });
                    setPreview(result);
                    setHistory((previous) => ({
                      ...previous,
                      current: result.design,
                      field: null,
                    }));
                    setReviewed(true);
                    setRequestId(crypto.randomUUID());
                  })
                }
              >
                Preview page
              </button>
              {reviewed && preview && (
                <motion.button
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.15 }}
                  type="button"
                  className={primary}
                  disabled={!["open", "paid"].includes(preview.document.status)}
                  onClick={() =>
                    void perform(async () => {
                      await request({
                        mode: "propose",
                        design,
                        digest: preview.digest,
                        requestId,
                      });
                      setNotice(
                        "Publication is awaiting approval in Invoice operations. No link has been published or emailed.",
                      );
                      await onProposed();
                      setReviewed(false);
                    })
                  }
                >
                  Request publication approval
                </motion.button>
              )}
            </div>
            {documentPreview?.document.status === "draft" && (
              <p className="admin-copy text-xs">
                Complete the reviewed sending workflow to finalize this invoice before publishing
                its customer page.
              </p>
            )}
          </fieldset>
          <div
            className={`${styles.canvas} min-w-0`}
            role="region"
            aria-label="Invoice preview canvas"
            tabIndex={0}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className={styles.segment} role="group" aria-label="Preview width">
                <button
                  type="button"
                  className={styles.segmentButton}
                  aria-pressed={previewWidth === "desktop"}
                  onClick={() => setPreviewWidth("desktop")}
                >
                  {previewWidth === "desktop" && (
                    <motion.span
                      aria-hidden="true"
                      className={styles.segmentSelection}
                      layoutId="preview-selection"
                      transition={{ type: "spring", duration: reducedMotion ? 0 : 0.3, bounce: 0 }}
                    />
                  )}
                  <span className="relative inline-flex items-center gap-2">
                    <Monitor className="size-4" aria-hidden="true" />
                    Full width
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.segmentButton}
                  aria-pressed={previewWidth === "phone"}
                  onClick={() => setPreviewWidth("phone")}
                >
                  {previewWidth === "phone" && (
                    <motion.span
                      aria-hidden="true"
                      className={styles.segmentSelection}
                      layoutId="preview-selection"
                      transition={{ type: "spring", duration: reducedMotion ? 0 : 0.3, bounce: 0 }}
                    />
                  )}
                  <span className="relative inline-flex items-center gap-2">
                    <Smartphone className="size-4" aria-hidden="true" />
                    Phone
                  </span>
                </button>
              </div>
              <div className="flex gap-2" role="group" aria-label="Design history">
                <button
                  type="button"
                  className={button}
                  disabled={unavailable || !history.past.length}
                  onClick={() => travel("undo")}
                >
                  <Undo2 className="size-4" aria-hidden="true" />
                  Undo changes
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={unavailable || !history.future.length}
                  onClick={() => travel("redo")}
                >
                  <Redo2 className="size-4" aria-hidden="true" />
                  Redo changes
                </button>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs admin-copy">
              <span>Live preview · {documentPreview?.document.number || "Loading invoice"}</span>
              <span>{reviewed ? "Ready for publication review" : "Private draft"}</span>
            </div>
            <div
              className={styles.paper}
              style={{ width: previewWidth === "phone" ? "min(100%, 360px)" : "100%" }}
              data-invoice-preview-width={previewWidth}
            >
              {documentPreview ? (
                <InvoiceDocument
                  brand={documentPreview.brand}
                  invoice={documentPreview.document}
                  design={design}
                  editing
                />
              ) : (
                <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-[var(--admin-border)] p-8 text-center text-sm admin-copy">
                  {pages.isPending
                    ? "Loading invoice and workspace branding…"
                    : "Invoice preview unavailable. Retry loading to continue."}
                </div>
              )}
            </div>
            {pages.error && (
              <div className="mt-4">
                <p role="alert" className="text-sm">
                  {pages.error.message}
                </p>
                <button
                  type="button"
                  className={`${button} mt-3`}
                  disabled={busy || pages.isFetching}
                  onClick={() => void pages.refetch()}
                >
                  Retry loading invoice
                </button>
              </div>
            )}
            <p className="admin-copy mt-4 text-xs leading-5">
              Draft changes stay in this editor until you close it. Preview page refreshes billing
              details and prepares the design for approval.
            </p>
          </div>
        </div>
      </LayoutGroup>
      <div className="mt-7 border-t border-[var(--admin-border)] pt-5">
        <h3 className="font-semibold">Published customer links</h3>
        <p className="admin-copy mt-2 text-xs">
          Draft edits do not change existing links. A newly approved design creates a new link.
          Anyone with a link can view its invoice until it expires or you revoke it. Publishing does
          not send an email.
        </p>
        <button type="button" className={`${button} mt-3`} onClick={() => void pages.refetch()}>
          Refresh published links
        </button>
        {pages.data && !pages.error && !pages.data.pages.length && (
          <p className="admin-copy mt-3 text-sm">No published links yet.</p>
        )}
        {pages.data?.pages.map((page) => (
          <div
            key={page.id}
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] p-4"
          >
            <p className="text-xs">
              {page.revokedAt
                ? "Revoked"
                : Date.parse(page.expiresAt) <= Date.now()
                  ? "Expired"
                  : `Expires ${new Date(page.expiresAt).toLocaleDateString()}`}
            </p>
            {page.design && (
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => edit(page.design!)}
              >
                Edit this design
              </button>
            )}
            {page.token && !page.revokedAt && Date.parse(page.expiresAt) > Date.now() && (
              <div className="flex flex-wrap gap-2">
                {demo ? (
                  <AdminLink className={button} href={`/admin/invoicing?demoInvoice=${page.token}`}>
                    Open demo invoice
                  </AdminLink>
                ) : (
                  <a
                    className={button}
                    href={customerUrl(page.token)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    Open customer page<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await navigator.clipboard.writeText(
                        `${window.location.origin}${customerUrl(page.token!)}`,
                      );
                      setNotice("Customer invoice link copied.");
                    })
                  }
                >
                  <Copy className="size-4" aria-hidden="true" />
                  Copy link
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await fetchJson("/api/admin/invoicing/pages", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mode: "revoke", pageId: page.id }),
                      });
                      await pages.refetch();
                      setNotice("Customer access revoked.");
                    })
                  }
                >
                  Revoke
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminSurface>
  );
}
