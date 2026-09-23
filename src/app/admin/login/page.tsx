"use client";

import { isSupabasePublicConfigured } from "@/lib/supabase/configuration.mjs";
import { createClient } from "@/lib/supabase/client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/admin/AdminLink";
import { ArrowRight } from "lucide-react";
import { AdminAuthLayout } from "@/components/admin/AdminAuthLayout";
import { AdminSurface } from "@/components/admin/AdminSurface";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/admin";
  const redirect =
    rawRedirect.startsWith("/") &&
    !rawRedirect.startsWith("//") &&
    !rawRedirect.includes("\\") &&
    !/[\r\n]/.test(rawRedirect)
      ? rawRedirect
      : "/admin";
  const resetFailed = searchParams.get("error") === "reset_failed";
  const googleFailed = searchParams.get("error") === "google_failed";
  const notConfigured =
    !isSupabasePublicConfigured(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ) || searchParams.get("error") === "not_configured";

  useEffect(() => {
    if (notConfigured) return;
    const controller = new AbortController();
    fetch(new URL("/auth/v1/settings", process.env.NEXT_PUBLIC_SUPABASE_URL), {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings: { external?: { google?: boolean } } | null) => {
        if (!controller.signal.aborted) setGoogleEnabled(settings?.external?.google === true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setGoogleEnabled(false);
      });
    return () => controller.abort();
  }, [notConfigured]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", redirect === "/admin" ? "/workspace" : redirect);
    callback.searchParams.set("flow", "google");
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      if (!error) return;
    } catch {
      // Keep provider details out of the browser error message.
    }
    setError("Google sign-in is unavailable. Try again or use email and password.");
    setLoading(false);
  };

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
      const workspacePath = response.headers.get("x-workspace-path");
      window.location.replace(redirect === "/admin" && workspacePath ? workspacePath : redirect);
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
    <AdminAuthLayout>
      <div className="w-full max-w-md">
        <AdminSurface padding="lg">
          {notConfigured ? (
            <>
              <p className="admin-eyebrow">Setup needed</p>
              <h1 className="admin-page-title text-[2rem]">Connect your Supabase project</h1>
              <p className="admin-copy mb-2 mt-2 text-sm">
                This deployment isn&apos;t connected to a Supabase project yet, so there is no admin
                account to sign in with.
              </p>
              <p className="admin-copy mb-7 text-sm">
                The installation guide walks you through connecting your own database and creating
                the first owner account. You can explore the fictional demo while you set up; its
                changes stay in your browser and do not contact real customers.
              </p>
              <div className="grid gap-3">
                <Link
                  href="/docs/self-hosting/installation"
                  className="admin-action-control min-h-11 w-full px-4"
                >
                  Open the installation guide{" "}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link
                  href="/demo/command-center"
                  className="admin-secondary-control min-h-11 w-full px-4"
                >
                  Explore the fictional demo
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="admin-eyebrow">Your workspace</p>
              <h1 className="admin-page-title text-[2rem] text-balance">
                {resetMode ? "Reset your password" : "Sign in to Command Center"}
              </h1>
              <p className="admin-copy mb-7 mt-2 text-sm">
                {resetMode
                  ? "We'll send a secure recovery link to your account email."
                  : googleEnabled
                    ? "Continue with Google or your workspace email."
                    : "Use your workspace email to continue."}
              </p>

              <div aria-live="polite">
                {searchParams.get("notice") === "local-data-retained" && (
                  <p className="mb-4 text-sm text-[var(--admin-muted)]" role="status">
                    You are signed out. This browser could not confirm that local drafts were
                    cleared. Before sharing this device, clear this website’s data in your browser
                    settings.
                  </p>
                )}
                {resetMode && resetFailed && !error && !success && (
                  <p className="text-sm text-error mb-4" role="alert">
                    Password reset link expired or was invalid. Please try again.
                  </p>
                )}
                {!resetMode && googleFailed && !error && (
                  <p className="text-sm text-error mb-4" role="alert">
                    Google sign-in could not finish. Try again or use email and password.
                  </p>
                )}
              </div>

              {resetMode ? (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label
                      htmlFor="reset-email"
                      className="block text-xs font-medium text-[var(--admin-muted)] mb-1.5"
                    >
                      Email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="admin-field min-h-11"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-error" role="alert">
                      {error}
                    </p>
                  )}
                  {success && (
                    <p className="text-sm text-[var(--admin-ink)]" role="status">
                      {success}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="admin-action-control w-full cursor-pointer px-4"
                  >
                    {loading ? (
                      "Sending…"
                    ) : (
                      <>
                        Send reset link <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(false);
                      setError("");
                      setSuccess("");
                    }}
                    className="min-h-10 w-full cursor-pointer text-sm text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)]"
                  >
                    Back to sign in
                  </button>
                </form>
              ) : (
                <div>
                  {googleEnabled && (
                    <>
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="admin-secondary-control min-h-11 w-full cursor-pointer px-4"
                      >
                        Continue with Google
                      </button>
                      <p className="my-5 text-center text-xs text-[var(--admin-muted)]">
                        or use your email
                      </p>
                    </>
                  )}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="login-email"
                        className="block text-xs font-medium text-[var(--admin-muted)] mb-1.5"
                      >
                        Email
                      </label>
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="admin-field min-h-11"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="login-password"
                        className="block text-xs font-medium text-[var(--admin-muted)] mb-1.5"
                      >
                        Password
                      </label>
                      <input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="admin-field min-h-11"
                        placeholder="Enter password"
                      />
                    </div>

                    {error && (
                      <p className="text-sm text-error" role="alert">
                        {error}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setResetMode(true);
                        setError("");
                      }}
                      className="ml-auto block min-h-10 cursor-pointer text-sm text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)]"
                    >
                      Forgot password?
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="admin-action-control w-full cursor-pointer px-4"
                    >
                      {loading ? "Signing in…" : "Sign in"}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </AdminSurface>
      </div>
    </AdminAuthLayout>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-shell flex min-h-screen items-center justify-center">
          <p className="admin-copy text-sm">Loading secure access…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
