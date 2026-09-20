"use client";
import { useState } from "react";
import Link from "@/components/admin/AdminLink";
import { fetchJson } from "@/lib/admin/fetchJson";
import { websiteButtonClass, websiteFieldClass } from "./WebsiteFields";

type Choice = { name: string; share_token: string; status: string };
export function WebsiteFormPicker({
  onChoose,
  disabled,
}: {
  onChoose: (form: Choice) => void;
  disabled: boolean;
}) {
  const [forms, setForms] = useState<Choice[] | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const result = await fetchJson<{ forms: Choice[] }>("/api/admin/forms");
      setForms(result.forms.filter((form) => form.status === "published"));
      setSelected("");
    } catch {
      setError("Forms could not be loaded. Enable Form Builder and publish a form, then retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset className="space-y-3 rounded-lg border border-[var(--admin-border)] p-4">
      <legend className="px-1 text-sm font-semibold">Connect a form</legend>
      <p className="text-sm text-[var(--admin-muted)]">
        Responses go to Form Builder for review before intake. Preview submissions stay disabled.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={websiteButtonClass}
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Loading forms…" : forms ? "Refresh forms" : "Load published forms"}
        </button>
        <Link className={websiteButtonClass} href="/admin/forms">
          Open Form Builder
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      {forms?.length === 0 && (
        <p role="status" className="text-sm">
          Publish a form in this workspace, then refresh this list.
        </p>
      )}
      {!!forms?.length && (
        <>
          <label className="block text-sm">
            Published form
            <select
              aria-label="Published form"
              className={websiteFieldClass}
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Choose a form…</option>
              {forms.map((form) => (
                <option key={form.share_token} value={form.share_token}>
                  {form.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={websiteButtonClass}
            disabled={!selected || disabled}
            onClick={() => {
              const form = forms.find((item) => item.share_token === selected);
              if (form) onChoose(form);
            }}
          >
            Add form section
          </button>
        </>
      )}
    </fieldset>
  );
}
