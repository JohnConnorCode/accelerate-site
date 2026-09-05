"use client";
import { useState } from "react";
import { Copy, Sparkles, X } from "lucide-react";
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
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-[var(--admin-shadow-border)] active:scale-[.96] disabled:opacity-50 disabled:cursor-not-allowed";
const field =
  "mt-2 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-ink)]";
type Preview = {
  brand: WorkspaceBrand;
  design: InvoiceDesign;
  document: InvoiceDocumentData;
  digest: string;
  testMode: boolean;
};
type Pages = {
  tenantSlug: string;
  pages: { id: string; token: string | null; revokedAt: string | null; expiresAt: string }[];
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
  const [design, setDesign] = useState(defaultInvoiceDesign),
    [brief, setBrief] = useState(
      "A clean, warm and professional invoice for an ongoing business relationship.",
    ),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const pages = useAdminQuery<Pages>(
    ["admin", "invoice-pages", creationActionId],
    `/api/admin/invoicing/pages?creationActionId=${creationActionId}`,
  );
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
    setPreview(null);
    setNotice("");
  }
  return (
    <AdminSurface padding="lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Customer invoice page</h2>
          <p className="admin-copy mt-2 text-sm">
            Design the presentation. Billing details stay connected to Stripe.
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
          {notice}
        </p>
      )}
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <fieldset disabled={busy} className="space-y-5">
          <legend className="sr-only">Invoice page presentation</legend>
          <div className="rounded-xl bg-[var(--admin-surface-subtle)] p-4">
            <label className="text-sm font-medium">
              Design direction
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
                      body: JSON.stringify({ mode: "generate", creationActionId, brief }),
                    },
                  );
                  edit(result.design);
                  setNotice(
                    "AI design drafted. Review the wording and preview before publication.",
                  );
                })
              }
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Draft with AI
            </button>
            <p className="admin-copy mt-3 text-xs leading-5">
              Uses your workspace’s AI connection. You can also edit the design directly.
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
              onClick={() =>
                void perform(async () => {
                  setPreview(await request({ mode: "preview", design }));
                  setRequestId(crypto.randomUUID());
                })
              }
            >
              Preview page
            </button>
            {preview && (
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
          {preview ? (
            <InvoiceDocument
              brand={preview.brand}
              invoice={preview.document}
              design={preview.design}
            />
          ) : (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-[var(--admin-border)] p-8 text-center text-sm admin-copy">
              Preview your design with the authoritative invoice and workspace branding.
            </div>
          )}
        </div>
      </div>
      <div className="mt-7 border-t border-[var(--admin-border)] pt-5">
        <h3 className="font-semibold">Published customer links</h3>
        <p className="admin-copy mt-2 text-xs">
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
        {!pages.data?.pages.length && (
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
                : `Expires ${new Date(page.expiresAt).toLocaleDateString()}`}
            </p>
            {page.token && !page.revokedAt && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await navigator.clipboard.writeText(
                        `${window.location.origin}/t/${encodeURIComponent(pages.data!.tenantSlug)}/invoice/${page.token}`,
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
