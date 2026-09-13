"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceBrand } from "@/lib/revenue-os/branding-contract";
import { brandButtonInk } from "@/lib/revenue-os/branding-contract";

export type AuthMode = "login" | "signup" | "forgot" | "reset";

const copy: Record<AuthMode, { eyebrow: string; title: string; detail: string }> = {
  login: {
    eyebrow: "Customer account",
    title: "Welcome back.",
    detail: "Sign in to manage your subscription and billing details.",
  },
  signup: {
    eyebrow: "Customer account",
    title: "Create your account.",
    detail: "Use one account for checkout, invoices, and subscription changes.",
  },
  forgot: {
    eyebrow: "Account recovery",
    title: "Reset your password.",
    detail: "We’ll send a secure recovery link to your email.",
  },
  reset: {
    eyebrow: "Account recovery",
    title: "Choose a new password.",
    detail: "Use at least eight characters, then continue to your account.",
  },
};

export function safeNext(value: string | null) {
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\r\n]/.test(value)
    ? value
    : "/";
}

function authError(message: string, mode: AuthMode) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials"))
    return "That email or password is not correct. Try again or use Forgot password?";
  if (normalized.includes("email not confirmed"))
    return "Confirm your email from the message we sent, then try signing in again.";
  if (mode === "reset" && (normalized.includes("expired") || normalized.includes("session")))
    return "This reset link has expired. Request a new link and try again.";
  if (normalized.includes("already registered") || normalized.includes("already been registered"))
    return "An account already exists for this email. Sign in instead.";
  if (normalized.includes("rate limit") || normalized.includes("too many"))
    return "Too many attempts. Wait a few minutes, then try again.";
  if (normalized.includes("password") && normalized.includes("8"))
    return "Choose a password with at least eight characters.";
  if (mode === "forgot") return "We could not send a reset link. Check the email and try again.";
  return "We could not complete that request. Check your details and try again.";
}

export function CustomerAuthForm({ mode, brand }: { mode: AuthMode; brand: WorkspaceBrand }) {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const tenantSlug = params.get("tenant") || "";
  const tenantQuery = tenantSlug ? `&tenant=${encodeURIComponent(tenantSlug)}` : "";
  const resetDestination = `/reset-password?next=${encodeURIComponent(next)}${tenantQuery}`;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (mode === "reset" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "login") {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        window.location.assign(next);
      } else if (mode === "signup") {
        const origin = window.location.origin;
        const result = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (result.error) throw result.error;
        setNotice("Check your email to confirm your account, then return here to sign in.");
      } else if (mode === "forgot") {
        const result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(resetDestination)}`,
        });
        if (result.error) throw result.error;
        setNotice("Check your email for a password reset link.");
      } else {
        if (password.length < 8) throw new Error("Password must be at least eight characters.");
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw result.error;
        window.location.assign(next);
      }
    } catch (cause) {
      setError(authError(cause instanceof Error ? cause.message : "", mode));
    } finally {
      setBusy(false);
    }
  }

  const text = copy[mode];
  return (
    <div className="w-full rounded-3xl border border-[color-mix(in_srgb,var(--billing-ink)_12%,transparent)] bg-white p-7 shadow-[0_24px_70px_rgba(0,0,0,0.08)] sm:p-9">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--billing-ink)_56%,transparent)]">
        {text.eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{text.title}</h1>
      <p className="mt-3 text-sm leading-6 text-[color-mix(in_srgb,var(--billing-ink)_66%,transparent)]">
        {text.detail}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "signup" && (
          <label className="block text-sm font-medium">
            Name
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-[color-mix(in_srgb,var(--billing-ink)_18%,transparent)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
          </label>
        )}
        {mode !== "reset" && (
          <label className="block text-sm font-medium">
            Email
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-[color-mix(in_srgb,var(--billing-ink)_18%,transparent)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
        )}
        {(mode === "login" || mode === "signup" || mode === "reset") && (
          <label className="block text-sm font-medium">
            Password
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-[color-mix(in_srgb,var(--billing-ink)_18%,transparent)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>
        )}
        {mode === "reset" && (
          <label className="block text-sm font-medium">
            Confirm password
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-[color-mix(in_srgb,var(--billing-ink)_18%,transparent)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {notice}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{ backgroundColor: brand.accentColor, color: brandButtonInk(brand.accentColor) }}
          className="min-h-12 w-full rounded-xl px-4 text-sm font-semibold transition-[opacity,transform] hover:opacity-85 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)] focus-visible:ring-offset-2"
        >
          {busy
            ? "Working…"
            : mode === "login"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Save password"}
        </button>
      </form>
      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[color-mix(in_srgb,var(--billing-ink)_66%,transparent)]">
        {mode === "login" && (
          <>
            <a
              className="underline underline-offset-4"
              href={`/signup?next=${encodeURIComponent(next)}${tenantQuery}`}
            >
              Create account
            </a>
            <a
              className="underline underline-offset-4"
              href={`/forgot-password?next=${encodeURIComponent(next)}${tenantQuery}`}
            >
              Forgot password?
            </a>
          </>
        )}
        {mode === "signup" && (
          <a
            className="underline underline-offset-4"
            href={`/login?next=${encodeURIComponent(next)}${tenantQuery}`}
          >
            Already have an account?
          </a>
        )}
        {mode === "forgot" && (
          <a
            className="underline underline-offset-4"
            href={`/login?next=${encodeURIComponent(next)}${tenantQuery}`}
          >
            Back to sign in
          </a>
        )}
      </div>
    </div>
  );
}
