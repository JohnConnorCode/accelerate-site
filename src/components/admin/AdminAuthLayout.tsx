"use client";

import { tenant } from "@/config/tenant";
import { ShieldCheck } from "lucide-react";
import { AdminAppearancePicker } from "@/components/admin/AdminAppearancePicker";

export function AdminAuthLayout({
  eyebrow = "Command Center",
  title = "Run the work. Move the pipeline.",
  copy = "One private workspace for every lead, follow-up, proposal, and client decision.",
  children,
}: {
  eyebrow?: string;
  title?: string;
  copy?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell grid min-h-screen lg:grid-cols-[minmax(360px,0.8fr)_minmax(520px,1.2fr)]">
      <aside className="admin-auth-brand relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="relative z-10">
          <p className="font-display text-lg font-semibold tracking-[-0.03em]">
            {tenant.brand.name}
          </p>
          <p className="admin-auth-brand-faint mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]">
            Private operations
          </p>
        </div>
        <div className="relative z-10 max-w-md">
          <p className="admin-auth-brand-faint mb-5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em]">
            {eyebrow}
          </p>
          <h1 className="max-w-[12ch] font-display text-5xl font-semibold leading-[0.98] tracking-[-0.055em] xl:text-6xl">
            {title}
          </h1>
          <p className="admin-auth-brand-muted mt-6 max-w-sm text-sm leading-relaxed">{copy}</p>
        </div>
        <div className="admin-auth-brand-faint relative z-10 flex items-center gap-2 text-[11px]">
          <ShieldCheck className="h-4 w-4" />
          Restricted to the configured admin account
        </div>
        <div className="admin-auth-brand-ring pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full border" />
        <div className="admin-auth-brand-ring pointer-events-none absolute -bottom-10 -right-4 h-48 w-48 rounded-full border" />
      </aside>

      <main className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <AdminAppearancePicker placement="canvas" />
        </div>
        {children}
      </main>
    </div>
  );
}
