"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

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
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess("Check your email for a password reset link.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="glass-prominent rounded-xl p-8">
          <h1 className="font-display text-2xl font-bold text-gold-gradient text-center mb-2">
            Accelerate
          </h1>
          <p className="text-center text-sm text-white-muted mb-8">
            {resetMode ? "Reset Password" : "Admin Dashboard"}
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
                <label className="block text-sm text-white-secondary mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg bg-bg-subtle border border-border-glass px-4 py-2.5 text-sm text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors"
                  placeholder="john@acceleratewith.us"
                />
              </div>

              {error && <p className="text-sm text-error" role="alert">{error}</p>}
              {success && <p className="text-sm text-green-400">{success}</p>}

              <button
                type="submit"
                disabled={loading}
                className="min-h-11 w-full rounded-lg bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-black transition-[filter,transform,opacity] hover:brightness-110 active:scale-[0.96] disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>

              <button
                type="button"
                onClick={() => { setResetMode(false); setError(""); setSuccess(""); }}
                className="w-full text-sm text-white-muted hover:text-white-secondary transition-colors cursor-pointer"
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white-secondary mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg bg-bg-subtle border border-border-glass px-4 py-2.5 text-sm text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors"
                  placeholder="john@acceleratewith.us"
                />
              </div>
              <div>
                <label className="block text-sm text-white-secondary mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg bg-bg-subtle border border-border-glass px-4 py-2.5 text-sm text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors"
                  placeholder="Enter password"
                />
              </div>

              {error && <p className="text-sm text-error" role="alert">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="min-h-11 w-full rounded-lg bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-black transition-[filter,transform,opacity] hover:brightness-110 active:scale-[0.96] disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <button
                type="button"
                onClick={() => { setResetMode(true); setError(""); }}
                className="w-full text-sm text-white-muted hover:text-white-secondary transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-white-muted">Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  );
}
