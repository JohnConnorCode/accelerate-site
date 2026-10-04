"use client";
import { useAdminDemo } from "./AdminDemoBoundary";
import { useState } from "react";
import { Copy, Sparkles, Undo2, X } from "lucide-react";
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
  const [draftDesign, setDesign] = useState<InvoiceDesign | null>(null),
    [previousDesign, setPreviousDesign] = useState<InvoiceDesign | null>(null),
    [brief, setBrief] = useState(
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
  const design = draftDesign || pages.data?.preview?.design || defaultInvoiceDesign;
  const documentPreview = preview || pages.data?.preview;
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
  function edit(next: InvoiceDesign) {
    setDesign(next);
    setReviewed(false);
    setPreviousDesign(null);
    setError("");
    setNotice("");
  }
  return (
    <AdminSurface padding="lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Customer invoice page</h2>
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
      {notice && (
        <p role="status" className="mt-4 text-sm">
          {demo ? "Simulated · " : ""}
          {notice}
        </p>
      )}
      <div className="mt-6 admin-split admin-split--equal">
        <fieldset disabled={busy || pages.isPending} className="min-w-0 space-y-5">
          <legend className="sr-only">Invoice page presentation</legend>
          <div className="rounded-xl bg-[var(--admin-surface-subtle)] p-4">
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
              className={`${button} mt-3`}
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
                  setPreviousDesign(design);
                  setNotice(
                    "AI changes applied to this draft. Preview the page before requesting publication.",
                  );
                })
              }
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Apply AI changes
            </button>
            {previousDesign && (
              <button
                type="button"
                className={`${button} mt-3 ml-2`}
                onClick={() => edit(previousDesign)}
              >
                <Undo2 className="size-4" aria-hidden="true" />
                Undo AI changes
              </button>
            )}
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
          <label className="block text-sm font-medium">
            Heading
            <input
              className={field}
              value={design.heading}
              maxLength={80}
              onChange={(event) => edit({ ...design, heading: event.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Introduction
            <textarea
              className={field}
              rows={3}
              maxLength={500}
              value={design.introduction}
              onChange={(event) => edit({ ...design, introduction: event.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Closing note
            <textarea
              className={field}
              rows={2}
              maxLength={300}
              value={design.closing}
              onChange={(event) => edit({ ...design, closing: event.target.value })}
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
                  setDesign(result.design);
                  setReviewed(true);
                  setRequestId(crypto.randomUUID());
                })
              }
            >
              Preview page
            </button>
            {reviewed && preview && (
              <button
                type="button"
                className={`${button} bg-[var(--admin-ink)] text-[var(--admin-surface)]`}
                disabled={!["open", "paid"].includes(preview.document.status)}
                onClick={() =>
                  void perform(async () => {
                    await request({ mode: "propose", design, digest: preview.digest, requestId });
                    setNotice(
                      "Publication is awaiting approval in Invoice operations. No link has been published or emailed.",
                    );
                    await onProposed();
                  })
                }
              >
                Request publication approval
              </button>
            )}
          </div>
          {preview?.document.status === "draft" && (
            <p className="admin-copy text-xs">
              Complete the reviewed sending workflow to finalize this invoice before publishing its
              customer page.
            </p>
          )}
        </fieldset>
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs admin-copy">
            <span>Live preview</span>
            <span>{reviewed ? "Ready for publication review" : "Not yet reviewed"}</span>
          </div>
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
                : "Preview your design with the authoritative invoice and workspace branding."}
            </div>
          )}
        </div>
      </div>
      <div className="mt-7 border-t border-[var(--admin-border)] pt-5">
        <h3 className="font-semibold">Published customer links</h3>
        <p className="admin-copy mt-2 text-xs">
          Draft edits do not change existing links. A newly approved design creates a new link.
          Anyone with a link can view its invoice until it expires or you revoke it. Publishing does
          not send an email.
        </p>
        {pages.error && (
          <p role="alert" className="mt-3 text-sm">
            {pages.error.message}
          </p>
        )}
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
                {demo && (
                  <AdminLink className={button} href={`/admin/invoicing?demoInvoice=${page.token}`}>
                    Open demo invoice
                  </AdminLink>
                )}
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await navigator.clipboard.writeText(
                        demo
                          ? `${window.location.origin}/demo/command-center/${demo.scenarioId}/invoicing?demoInvoice=${page.token}`
                          : `${window.location.origin}/t/${encodeURIComponent(pages.data!.tenantSlug)}/invoice/${page.token}`,
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
