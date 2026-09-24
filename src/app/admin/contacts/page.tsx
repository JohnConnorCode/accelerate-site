"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/admin/AdminLink";
import { ContactIntakeNav } from "@/components/admin/ContactIntakeNav";
import ContactSubmissionsPage from "@/components/admin/ContactSubmissionsPage";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";

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
  const directory = useAdminQuery<Directory>(
    ["contacts", "directory", page, query],
    `/api/admin/contacts/directory?${new URLSearchParams({ page: String(page), search: query })}`,
  );
  const rows = directory.data?.contacts ?? [];
  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Contacts"
        subtitle="Find every person and open the work connected to them."
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
