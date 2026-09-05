"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Palette, RotateCcw, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import { DEMO_SCENARIOS } from "@/lib/admin/demo/scenarios";
import { DemoBusinessNotice } from "@/components/admin/DemoBusinessNotice";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { InvoiceDocument, type InvoiceDocumentData } from "@/components/business/InvoiceDocument";
import {
  contrastRatio,
  workspaceBrandSchema,
  type WorkspaceBrand,
} from "@/lib/revenue-os/branding-contract";
const field =
  "mt-2 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-ink)]";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[.96] disabled:opacity-50 disabled:cursor-not-allowed";
type BrandResponse = {
  brand: WorkspaceBrand;
  revision: string;
  previewInvoice?: InvoiceDocumentData;
};
function BrandEditor({ initial, onSaved }: { initial: BrandResponse; onSaved: () => void }) {
  const demo = useAdminDemo();
  const [brand, setBrand] = useState(initial.brand),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const dirty = JSON.stringify(brand) !== JSON.stringify(initial.brand);
  const valid = workspaceBrandSchema.safeParse(brand).success;
  const contrast = valid
    ? Math.min(
        contrastRatio(brand.inkColor, brand.backgroundColor),
        contrastRatio(brand.inkColor, "#ffffff"),
      )
    : 0;
  function edit<K extends keyof WorkspaceBrand>(key: K, value: WorkspaceBrand[K]) {
    setBrand((previous) => ({ ...previous, [key]: value }));
    setNotice("");
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/admin/tenant/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, revision: initial.revision }),
      });
      setNotice("Workspace branding saved.");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Branding could not be saved");
    } finally {
      setBusy(false);
    }
  }
  const textField = (
    key: "name" | "logoMark" | "logoUrl" | "tagline" | "legalName" | "supportEmail" | "siteUrl",
    label: string,
    maxLength: number,
    type = "text",
  ) => (
    <label className="block text-sm font-medium">
      {label}
      <input
        className={field}
        type={type}
        maxLength={maxLength}
        value={brand[key]}
        onChange={(event) => edit(key, event.target.value)}
      />
    </label>
  );
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="admin-copy text-sm" role="status">
          {notice ||
            (dirty
              ? "Unsaved changes · Preview updates as you edit"
              : "Your shared identity for customer documents")}
        </p>
        <div className="flex gap-2">
          <button
            className={button}
            type="button"
            disabled={!dirty || busy}
            onClick={() => {
              setBrand(initial.brand);
              setError("");
            }}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset edits
          </button>
          <button
            className={`${button} bg-[var(--admin-ink)] text-[var(--admin-surface)]`}
            type="button"
            disabled={!dirty || busy || !valid || contrast < 4.5}
            onClick={() => void save()}
          >
            <Save className="size-4" aria-hidden="true" />
            {busy ? "Saving…" : "Save branding"}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm">
          {error}
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <fieldset disabled={busy} className="min-w-0 space-y-6">
          <legend className="sr-only">Workspace brand settings</legend>
          <AdminSurface padding="lg">
            <div className="flex items-center gap-3">
              <Palette className="size-5" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Business identity</h2>
            </div>
            <div className="mt-5 space-y-5">
              {textField("name", "Display name", 100)}
              {textField("tagline", "Tagline", 180)}
              <div className="grid gap-4 sm:grid-cols-2">
                {textField("legalName", "Legal business name", 160)}
                {textField("supportEmail", "Billing support email", 254, "email")}
              </div>
              {textField("siteUrl", "Website", 2048, "url")}
              <label className="block text-sm font-medium">
                Business address
                <textarea
                  className={field}
                  rows={3}
                  value={brand.businessAddress}
                  maxLength={500}
                  onChange={(event) => edit("businessAddress", event.target.value)}
                />
              </label>
            </div>
          </AdminSurface>
          <AdminSurface padding="lg">
            <h2 className="text-lg font-semibold">Logo & typography</h2>
            <p className="admin-copy mt-2 text-sm leading-6">
              Use a publicly hosted HTTPS logo. Transparent PNG or WebP works well on the white
              invoice surface.
            </p>
            <div className="mt-5 space-y-4">
              {demo ? (
                <div>
                  <p className="admin-copy text-sm">
                    The demo uses its fictional business mark. External logo downloads are disabled.
                  </p>
                  <button
                    type="button"
                    className={`${button} mt-3`}
                    onClick={() =>
                      edit(
                        "logoUrl",
                        `https://${DEMO_SCENARIOS[demo.scenarioId].tenant.brand.domain}/demo-logo.svg`,
                      )
                    }
                  >
                    Use sample logo
                  </button>
                </div>
              ) : (
                textField("logoUrl", "Logo image URL", 2048, "url")
              )}
              {brand.logoUrl && (
                <button type="button" className={button} onClick={() => edit("logoUrl", "")}>
                  Remove logo
                </button>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {textField("logoMark", "Fallback initials", 4)}
                <label className="text-sm font-medium">
                  Document typeface
                  <select
                    className={field}
                    value={brand.font}
                    onChange={(event) => edit("font", event.target.value as WorkspaceBrand["font"])}
                  >
                    <option value="sans">Modern sans serif</option>
                    <option value="serif">Classic serif</option>
                  </select>
                </label>
              </div>
            </div>
          </AdminSurface>
          <AdminSurface padding="lg">
            <h2 className="text-lg font-semibold">Brand palette</h2>
            <p className="admin-copy mt-2 text-sm leading-6">
              Buttons automatically use a readable text color. Document text needs a minimum
              contrast ratio of 4.5:1.
            </p>
            <div className="mt-5 space-y-4">
              {(
                [
                  ["accentColor", "Accent"],
                  ["inkColor", "Document text"],
                  ["backgroundColor", "Page background"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm font-medium">
                  {label}
                  <div className="mt-2 flex gap-3">
                    <input
                      type="color"
                      aria-label={`${label} picker`}
                      value={/^#[a-f0-9]{6}$/i.test(brand[key]) ? brand[key] : "#000000"}
                      onChange={(event) => edit(key, event.target.value)}
                      className="size-11 shrink-0 cursor-pointer rounded-lg border border-[var(--admin-border)] bg-transparent p-1"
                    />
                    <input
                      aria-label={`${label} hex`}
                      className={`${field} !mt-0 font-mono`}
                      maxLength={7}
                      value={brand[key]}
                      onChange={(event) => edit(key, event.target.value)}
                      spellCheck={false}
                    />
                  </div>
                </label>
              ))}
            </div>
            <p className="admin-copy mt-4 text-xs tabular-nums" role="status">
              {valid
                ? `Text contrast: ${contrast.toFixed(1)}:1${contrast < 4.5 ? " · Choose darker text or a lighter background" : " · Readable"}`
                : "Complete all fields with valid colors and HTTPS links."}
            </p>
          </AdminSurface>
        </fieldset>
        <div
          className="min-w-0 rounded-2xl p-4 sm:p-6 xl:sticky xl:top-5"
          style={{ backgroundColor: valid ? brand.backgroundColor : "#f4f5f7" }}
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#475569]">
            Customer invoice preview
          </p>
          <InvoiceDocument
            brand={valid ? brand : initial.brand}
            preview
            invoice={
              initial.previewInvoice ?? {
                number: "INV-0042",
                customerName: "Sample Customer",
                customerEmail: "billing@example.com",
                currency: "usd",
                lines: [
                  { description: "Business systems implementation", amount: 240000 },
                  { description: "Team onboarding and training", amount: 60000 },
                ],
                total: 300000,
                amountPaid: 0,
                amountRemaining: 300000,
                status: "Draft",
                dueLabel: "Within 14 days",
              }
            }
          />
        </div>
      </div>
    </>
  );
}
export default function BrandingPage() {
  const cache = useQueryClient();
  const router = useRouter();
  const query = useAdminQuery<BrandResponse>(
    ["admin", "workspace-branding"],
    "/api/admin/tenant/branding",
  );
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Branding"
        subtitle="Make every customer document feel like your business."
      />
      <DemoBusinessNotice />
      {query.error ? (
        <AdminSurface padding="lg">
          <p role="alert">{query.error.message}</p>
          <button className={`${button} mt-4`} onClick={() => void query.refetch()}>
            Reload branding
          </button>
        </AdminSurface>
      ) : query.data ? (
        <BrandEditor
          key={query.data.revision}
          initial={query.data}
          onSaved={() => {
            void cache.invalidateQueries({ queryKey: ["admin", "workspace-branding"] });
            router.refresh();
          }}
        />
      ) : (
        <p role="status" className="admin-copy">
          Loading workspace identity…
        </p>
      )}
    </div>
  );
}
