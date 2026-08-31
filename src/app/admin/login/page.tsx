"use client";

import { tenant } from "@/config/tenant";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { AdminAuthLayout } from "@/components/admin/AdminAuthLayout";
import { AdminSurface } from "@/components/admin/AdminSurface";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/admin";
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/admin";
  const resetFailed = searchParams.get("error") === "reset_failed";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Sign-in failed. Please try again.");
        setLoading(false);
        return;
      }

      // The server endpoint writes the Supabase session cookies directly onto
      // its response. A hard replace ensures the protected request carries
      // them through middleware without leaving a stale login entry in history.
      window.location.replace(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!email) {
      setError("Please enter your email address.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "We could not send a reset email. Please try again shortly.");
      } else {
        setSuccess("Check your email for a password reset link.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
    setLoading(false);
  };

  return (
    <MotionConfig reducedMotion="user">
      <AdminAuthLayout>
        <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}>
          <div className="mb-7 lg:hidden">
            <p className="font-display text-lg font-semibold tracking-[-0.03em]">{tenant.brand.name}</p>
            <p className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">Private operations</p>
          </div>
          <AdminSurface padding="lg" className="admin-dialog-surface">
            <div className="admin-action-mark mb-7"><LockKeyhole className="h-4.5 w-4.5" /></div>
            <p className="admin-eyebrow">Secure access</p>
            <h1 className="admin-page-title text-[2rem]">
              {resetMode ? "Reset your password" : "Sign in to operations"}
            </h1>
            <p className="admin-copy mb-7 mt-2 text-sm">
              {resetMode ? "We'll send a secure recovery link to the admin email." : "Use the configured admin account to continue."}
            </p>

            <div aria-live="polite">
              {resetFailed && !error && !success && (
                <p className="text-sm text-error mb-4" role="alert">
                  Password reset link expired or was invalid. Please try again.
                </p>
              )}
            </div>

            {resetMode ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--admin-muted)] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="admin-field min-h-11"
                    placeholder={tenant.founder.email}
                  />
                </div>

                {error && <p className="text-sm text-error" role="alert">{error}</p>}
                {success && <p className="text-sm text-[var(--admin-ink)]" role="status">{success}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="admin-action-control w-full cursor-pointer px-4"
                >
                  {loading ? "Sending…" : <>Send reset link <ArrowRight className="h-3.5 w-3.5" /></>}
                </button>

                <button
                  type="button"
                  onClick={() => { setResetMode(false); setError(""); setSuccess(""); }}
                  className="min-h-10 w-full cursor-pointer text-sm text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)]"
                >
                  Back to sign in
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--admin-muted)] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="admin-field min-h-11"
                    placeholder={tenant.founder.email}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--admin-muted)] mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="admin-field min-h-11"
                    placeholder="Enter password"
                  />
                </div>

                {error && <p className="text-sm text-error" role="alert">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="admin-action-control w-full cursor-pointer px-4"
                >
                  {loading ? "Signing in…" : <>Enter Command Center <ArrowRight className="h-3.5 w-3.5" /></>}
                </button>

                <button
                  type="button"
                  onClick={() => { setResetMode(true); setError(""); }}
                  className="min-h-10 w-full cursor-pointer text-sm text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)]"
                >
                  Forgot password?
                </button>
              </form>
            )}
          </AdminSurface>
          <p className="mt-5 text-center text-[11px] text-[var(--admin-muted)]">Session access is encrypted and restricted.</p>
        </motion.div>
      </AdminAuthLayout>
    </MotionConfig>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="admin-shell flex min-h-screen items-center justify-center"><p className="admin-copy text-sm">Loading secure access…</p></div>}>
      <LoginForm />
    </Suspense>
  );
}
