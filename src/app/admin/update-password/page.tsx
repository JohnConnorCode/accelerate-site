"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="glass-prominent rounded-xl p-8">
          <h1 className="font-display text-2xl font-bold text-gold-gradient text-center mb-2">
            Accelerate
          </h1>
          <p className="text-center text-sm text-white-muted mb-8">
            Set New Password
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white-secondary mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg bg-bg-subtle border border-border-glass px-4 py-2.5 text-sm text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-sm text-white-secondary mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg bg-bg-subtle border border-border-glass px-4 py-2.5 text-sm text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors"
                placeholder="Repeat password"
              />
            </div>

            {error && <p className="text-sm text-error">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
