"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/admin/AdminLink";
import { ContactIntakeNav } from "@/components/admin/ContactIntakeNav";
import ContactSubmissionsPage from "@/components/admin/ContactSubmissionsPage";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { toast } from "@/lib/admin/useToast";

type Contact = {
  id: string;
  full_name: string;
  primary_email: string | null;
  phone: string | null;
  title: string | null;
  lifecycle_stage: string;
  next_action: string | null;
};
type Directory = { contacts: Contact[]; total: number; pageSize: number };

function DirectoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [createError, setCreateError] = useState("");
  const directory = useAdminQuery<Directory>(
    ["contacts", "directory", page, query],
    `/api/admin/contacts/directory?${new URLSearchParams({ page: String(page), search: query })}`,
  );
  const rows = directory.data?.contacts ?? [];
  const addContact = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setCreateError("");
    try {
      await fetchJson("/api/admin/contacts/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });
      setCreating(false);
      setName("");
      setEmail("");
      setPhone("");
      setPage(1);
      setSearch("");
      setQuery("");
      void directory.refetch();
      toast.success("Contact added");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Contact could not be added");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Contacts"
        subtitle="Find every person and open the work connected to them."
        actions={
          <button
            className="admin-button admin-button--primary"
            onClick={() => {
              setCreateError("");
              setCreating(true);
            }}
          >
            Add contact
          </button>
        }
      />
      <ContactIntakeNav active="directory" />
      <AdminSurface padding="lg">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <label className="min-w-[220px] flex-1 text-sm font-medium">
            Search contacts
            <input
              className="admin-field mt-2 w-full"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or email"
            />
          </label>
          <button className="admin-button admin-button--secondary" type="submit">
            Search
          </button>
        </form>
        <p className="admin-copy mt-4 text-sm">{directory.data?.total ?? 0} contacts</p>
        {directory.error && (
          <p role="alert" className="mt-3 text-sm text-[var(--admin-danger)]">
            {directory.error.message}
          </p>
        )}
        {directory.isPending && (
          <p role="status" className="admin-copy mt-4 text-sm">
            Loading contacts…
          </p>
        )}
        {!directory.isPending && !rows.length && (
          <p className="admin-copy mt-5 text-sm">
            No contacts found. Try another search, import a list, or review website requests.
          </p>
        )}
        <div className="mt-4 divide-y divide-[var(--admin-border)]">
          {rows.map((contact) => (
            <div
              key={contact.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[var(--admin-ink)]">{contact.full_name}</p>
                <p className="admin-copy text-sm">
                  {contact.primary_email || contact.phone || "No email or phone"}
                  {contact.title ? ` · ${contact.title}` : ""}
                </p>
                <p className="admin-copy text-xs">
                  {contact.lifecycle_stage.replaceAll("_", " ")}
                  {contact.next_action ? ` · Next: ${contact.next_action}` : ""}
                </p>
              </div>
              <Link
                className="admin-button admin-button--secondary"
                href={`/admin/contacts/${contact.id}`}
              >
                Open history
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            className="admin-button admin-button--secondary"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span className="admin-copy text-sm">Page {page}</span>
          <button
            className="admin-button admin-button--secondary"
            type="button"
            disabled={page * (directory.data?.pageSize ?? 50) >= (directory.data?.total ?? 0)}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </AdminSurface>
      <AdminDialog
        open={creating}
        onClose={() => {
          if (!saving) setCreating(false);
        }}
        title="Add contact"
        labelledBy="add-contact-title"
        maxWidth="sm"
      >
        <AdminSurface padding="lg" className="admin-dialog-surface">
          <h2 id="add-contact-title" className="admin-dialog-title mb-5">
            Add contact
          </h2>
          <form className="space-y-4" onSubmit={(event) => void addContact(event)}>
            <label className="admin-field-label">
              Full name
              <input
                className="admin-field"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
                required
                data-admin-autofocus
              />
            </label>
            <label className="admin-field-label">
              Email
              <input
                className="admin-field"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                required
              />
            </label>
            <label className="admin-field-label">
              Phone (optional)
              <input
                className="admin-field"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={80}
              />
            </label>
            {createError && (
              <p role="alert" className="text-sm text-[var(--admin-danger)]">
                {createError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="admin-button admin-button--secondary"
                onClick={() => setCreating(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-button admin-button--primary"
                disabled={saving || !name.trim() || !email.trim()}
              >
                {saving ? "Adding…" : "Add contact"}
              </button>
            </div>
          </form>
        </AdminSurface>
      </AdminDialog>
    </div>
  );
}

export default function ContactsPage() {
  const params = useSearchParams();
  return params.get("view") === "requests" || params.has("contact") || params.has("submission") ? (
    <ContactSubmissionsPage />
  ) : (
    <DirectoryPage />
  );
}
