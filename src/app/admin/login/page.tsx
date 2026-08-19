"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
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
    <div className="admin-shell grid min-h-screen lg:grid-cols-[minmax(360px,0.8fr)_minmax(520px,1.2fr)]">
      <aside className="relative hidden overflow-hidden bg-[#0b0b0b] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="relative z-10">
          <p className="font-display text-lg font-semibold tracking-[-0.03em]">Accelerate</p>
          <p className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-white/38">Private operations</p>
        </div>
        <motion.div className="relative z-10 max-w-md" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
          <motion.p variants={{ hidden: { opacity: 0, y: 12, filter: "blur(4px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45 } } }} className="mb-5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-white/38">Command Center</motion.p>
          <motion.h1 variants={{ hidden: { opacity: 0, y: 12, filter: "blur(4px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45 } } }} className="max-w-[12ch] font-display text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white xl:text-6xl">Run the work. Move the pipeline.</motion.h1>
          <motion.p variants={{ hidden: { opacity: 0, y: 12, filter: "blur(4px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45 } } }} className="mt-6 max-w-sm text-sm leading-relaxed text-white/48">One private workspace for every lead, follow-up, proposal, and client decision.</motion.p>
        </motion.div>
        <div className="relative z-10 flex items-center gap-2 text-[11px] text-white/35"><ShieldCheck className="h-4 w-4" /> Restricted to the configured admin account</div>
        <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full border border-white/8" />
        <div className="pointer-events-none absolute -bottom-10 -right-4 h-48 w-48 rounded-full border border-white/8" />
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}>
          <div className="mb-7 lg:hidden"><p className="font-display text-lg font-semibold tracking-[-0.03em]">Accelerate</p><p className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">Private operations</p></div>
          <AdminSurface padding="lg" className="admin-dialog-surface">
          <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#0b0b0b] text-white"><LockKeyhole className="h-4.5 w-4.5" /></div>
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
                  placeholder="john@acceleratewith.us"
                />
              </div>

              {error && <p className="text-sm text-error" role="alert">{error}</p>}
              {success && <p className="text-sm text-green-400">{success}</p>}

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#0b0b0b] px-4 text-sm font-semibold text-white transition-[background-color,transform,opacity] hover:bg-[#252525] active:scale-[0.96] disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Sending…" : <>Send reset link <ArrowRight className="h-3.5 w-3.5" /></>}
              </button>

              <button
                type="button"
                onClick={() => { setResetMode(false); setError(""); setSuccess(""); }}
                className="min-h-10 w-full text-sm text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)] cursor-pointer"
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
                  placeholder="john@acceleratewith.us"
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
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#0b0b0b] px-4 text-sm font-semibold text-white transition-[background-color,transform,opacity] hover:bg-[#252525] active:scale-[0.96] disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Signing in…" : <>Enter Command Center <ArrowRight className="h-3.5 w-3.5" /></>}
              </button>

              <button
                type="button"
                onClick={() => { setResetMode(true); setError(""); }}
                className="min-h-10 w-full text-sm text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)] cursor-pointer"
              >
                Forgot password?
              </button>
            </form>
          )}
          </AdminSurface>
          <p className="mt-5 text-center text-[11px] text-[var(--admin-muted)]">Session access is encrypted and restricted.</p>
        </motion.div>
      </main>
    </div>
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
