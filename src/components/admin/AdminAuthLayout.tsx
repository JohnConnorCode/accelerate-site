"use client";

import { tenant } from "@/config/tenant";
import { AdminAppearancePicker } from "@/components/admin/AdminAppearancePicker";

export function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <div>
          <p className="font-display text-lg font-semibold tracking-[-0.03em]">
            {tenant.brand.name}
          </p>
          {tenant.brand.name !== "Command Center" && (
            <p className="text-[11px] font-medium text-[var(--admin-muted)]">Command Center</p>
          )}
        </div>
        <div>
          <AdminAppearancePicker placement="canvas" />
        </div>
      </header>
      <main className="flex w-full flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-8">
        {children}
      </main>
    </div>
  );
}
