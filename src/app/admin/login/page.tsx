"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/admin";
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/admin";
  const resetFailed = searchParams.get("error") === "reset_failed";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
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

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/update-password`,
      }
    );

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess("Check your email for a password reset link.");
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

          {resetFailed && !error && !success && (
            <p className="text-sm text-error mb-4">
              Password reset link expired or was invalid. Please try again.
            </p>
          )}

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
                  className="w-full rounded-lg bg-bg-subtle border border-border-glass px-4 py-2.5 text-sm text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors"
                  placeholder="john@acceleratewith.us"
                />
              </div>

              {error && <p className="text-sm text-error">{error}</p>}
              {success && <p className="text-sm text-green-400">{success}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50 cursor-pointer"
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
                  className="w-full rounded-lg bg-bg-subtle border border-border-glass px-4 py-2.5 text-sm text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors"
                  placeholder="Enter password"
                />
              </div>

              {error && <p className="text-sm text-error">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50 cursor-pointer"
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
