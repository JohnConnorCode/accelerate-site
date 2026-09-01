"use client";

import { tenant } from "@/config/tenant";
import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminAuthLayout } from "@/components/admin/AdminAuthLayout";
import { AdminSurface } from "@/components/admin/AdminSurface";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    window.location.href = "/admin";
  };

  return (
    <AdminAuthLayout
      eyebrow="Account recovery"
      title="Set a new password."
      copy="Choose a new password for the configured admin account, then continue into operations."
    >
      <div className="w-full max-w-md">
        <div className="mb-7 lg:hidden">
          <p className="font-display text-lg font-semibold tracking-[-0.03em]">
            {tenant.brand.name}
          </p>
          <p className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
            Private operations
          </p>
        </div>
        <AdminSurface padding="lg" className="admin-dialog-surface">
          <div className="admin-action-mark mb-7">
            <LockKeyhole className="h-4.5 w-4.5" />
          </div>
          <p className="admin-eyebrow">Secure access</p>
          <h1 className="admin-page-title text-[2rem]">Set a new password</h1>
          <p className="admin-copy mb-7 mt-2 text-sm">
            Use at least eight characters, then confirm it to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--admin-muted)] mb-1.5">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="admin-field min-h-11"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-muted)] mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="admin-field min-h-11"
                placeholder="Repeat password"
              />
            </div>

            {error && (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="admin-action-control w-full cursor-pointer px-4"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        </AdminSurface>
      </div>
    </AdminAuthLayout>
  );
}
