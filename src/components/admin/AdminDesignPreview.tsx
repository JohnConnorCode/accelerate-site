"use client";
import { useState } from "react";
import { useTheme } from "next-themes";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { ADMIN_APPEARANCES } from "@/lib/admin/appearances";
import { AdminButton } from "./AdminButton";
import { AdminSurface } from "./AdminSurface";
import { AdminTable } from "./AdminTable";
import { AdminDensityControl } from "./AdminDensityControl";
import { AdminDialog } from "./AdminDialog";
import { EmptyState } from "./EmptyState";
import { AdminStatusMessage } from "./AdminStatusMessage";

/** Development-only workbench. These are the production primitives, not mock controls. */
export function AdminDesignPreview() {
  const { setTheme } = useTheme();
  const [dialog, setDialog] = useState(false);
  const [support, setSupport] = useState(true);
  const [empty, setEmpty] = useState(false);
  return (
    <main className="admin-shell min-h-screen p-6 sm:p-10">
      <div className="admin-route-frame admin-content-stack">
        <header className="admin-toolbar justify-between">
          <div>
            <p className="admin-eyebrow">Core design · Development preview</p>
            <h1 className="admin-page-title">A clear view. A confident next step.</h1>
          </div>
          <AdminButton variant="primary" onClick={() => setDialog(true)}>
            <Plus size={18} /> New project
          </AdminButton>
        </header>
        <div className="admin-toolbar">
          <label className="admin-field-label">
            Appearance
            <select
              className="admin-field"
              aria-label="Preview appearance"
              onChange={(e) => setTheme(e.target.value)}
              defaultValue="light"
            >
              {ADMIN_APPEARANCES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <AdminDensityControl />
          <AdminButton onClick={() => setSupport(!support)}>
            {support ? "Hide" : "Show"} supporting panel
          </AdminButton>
          <AdminButton onClick={() => setEmpty(!empty)}>
            {empty ? "Show records" : "Show empty state"}
          </AdminButton>
        </div>
        <section className="admin-grid admin-grid--metrics" aria-label="Overview">
          {[
            ["Open pipeline", "$128,400"],
            ["Active projects", "12"],
            ["Awaiting your review", "3"],
          ].map(([label, value]) => (
            <AdminSurface key={label}>
              <p className="admin-copy mb-3">{label}</p>
              <p className="admin-stat-value">{value}</p>
            </AdminSurface>
          ))}
        </section>
        <div className="admin-split" data-testid="preview-split">
          <AdminSurface>
            <div className="admin-toolbar justify-between mb-5">
              <div>
                <p className="admin-eyebrow">Your work</p>
                <h2 className="admin-section-title">Keep the next move in sight</h2>
              </div>
              <AdminButton variant="ghost">
                View all <ArrowUpRight size={16} />
              </AdminButton>
            </div>
            {empty ? (
              <EmptyState
                title="You’re all caught up"
                message="New work will appear here when it needs your attention."
                actionLabel="Create a project"
                onAction={() => setDialog(true)}
              />
            ) : (
              <AdminTable
                columns={[
                  {
                    key: "name",
                    label: "Project",
                    render: (row: { name: string; status: string }) => row.name,
                  },
                  { key: "status", label: "Status", render: (row) => row.status },
                ]}
                data={[
                  { name: "Harbor House · Brand launch", status: "In progress" },
                  { name: "Meridian · Spring collection", status: "Ready for review" },
                ]}
                keyExtractor={(row) => row.name}
              />
            )}
          </AdminSurface>
          {support && (
            <AdminSurface tone="attention">
              <p className="admin-eyebrow">Next up</p>
              <h2 className="admin-section-title mb-3">Make room for what matters</h2>
              <p className="admin-copy mb-5">
                Review the three open decisions before your afternoon project check-in.
              </p>
              <AdminButton variant="primary" onClick={() => setDialog(true)}>
                Review decisions <ArrowUpRight size={16} />
              </AdminButton>
            </AdminSurface>
          )}
        </div>
        <AdminSurface>
          <h2 className="admin-section-title mb-5">Project details</h2>
          <div className="admin-grid admin-grid--fields">
            <label className="admin-field-label">
              Project name
              <input className="admin-field" placeholder="Give this project a name" />
            </label>
            <label className="admin-field-label">
              Owner
              <select className="admin-field">
                <option>Alex Morgan</option>
                <option>Jamie Chen</option>
              </select>
            </label>
            <label className="admin-field-label">
              Search
              <input className="admin-field" placeholder="Search projects" type="search" />
            </label>
          </div>
          <div className="admin-toolbar mt-5">
            <AdminButton variant="primary">Save changes</AdminButton>
            <AdminButton>Cancel</AdminButton>
            <AdminButton variant="ghost">
              <Search size={16} /> Find a record
            </AdminButton>
            <AdminButton variant="danger">Archive</AdminButton>
            <AdminButton disabled>Saving…</AdminButton>
          </div>
        </AdminSurface>
        <AdminStatusMessage tone="info">
          This workbench uses fictional records and does not save business data.
        </AdminStatusMessage>
        <AdminDialog open={dialog} onClose={() => setDialog(false)} title="Create a project">
          <AdminSurface>
            <h2 className="admin-dialog-title mb-5">Create a project</h2>
            <label className="admin-field-label">
              Project name
              <input
                className="admin-field"
                placeholder="Project name"
                data-admin-autofocus="true"
              />
            </label>
            <div className="admin-toolbar mt-5">
              <AdminButton variant="primary" onClick={() => setDialog(false)}>
                Create project
              </AdminButton>
              <AdminButton onClick={() => setDialog(false)}>Cancel</AdminButton>
            </div>
          </AdminSurface>
        </AdminDialog>
      </div>
    </main>
  );
}
