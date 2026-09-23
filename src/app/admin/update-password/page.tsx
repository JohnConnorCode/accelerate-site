"use client";

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

    // A full navigation forces the server to re-read the fresh auth cookie;
    // a client-side route push can render the admin shell against stale auth state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/admin";
  };

  return (
    <AdminAuthLayout>
      <div className="w-full max-w-md">
        <AdminSurface padding="lg">
          <div className="admin-action-mark mb-7">
            <LockKeyhole className="h-4.5 w-4.5" />
          </div>
          <p className="admin-eyebrow">Account recovery</p>
          <h1 className="admin-page-title text-[2rem]">Set a new password</h1>
          <p className="admin-copy mb-7 mt-2 text-sm">
            Use at least eight characters, then confirm it to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-medium text-[var(--admin-muted)] mb-1.5"
              >
                New password
              </label>
              <input
                id="new-password"
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
              <label
                htmlFor="confirm-password"
                className="block text-xs font-medium text-[var(--admin-muted)] mb-1.5"
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
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
