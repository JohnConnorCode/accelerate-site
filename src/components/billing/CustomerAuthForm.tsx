"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot" | "reset";

const copy: Record<Mode, { eyebrow: string; title: string; detail: string }> = {
  login: { eyebrow: "Customer account", title: "Welcome back.", detail: "Sign in to manage your subscription and billing details." },
  signup: { eyebrow: "Customer account", title: "Create your account.", detail: "Use one account for checkout, invoices, and subscription changes." },
  forgot: { eyebrow: "Account recovery", title: "Reset your password.", detail: "We’ll send a secure recovery link to your email." },
  reset: { eyebrow: "Account recovery", title: "Choose a new password.", detail: "Use at least eight characters, then continue to your account." },
};

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function CustomerAuthForm({ mode }: { mode: Mode }) {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
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
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password?next=" + encodeURIComponent(next))}`,
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
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const text = copy[mode];
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-black/10 bg-white p-7 shadow-[0_24px_70px_rgba(0,0,0,0.08)] sm:p-9">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/50">{text.eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{text.title}</h1>
      <p className="mt-3 text-sm leading-6 text-black/60">{text.detail}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "signup" && <label className="block text-sm font-medium">Name<input className="mt-2 min-h-11 w-full rounded-xl border border-black/15 px-3" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>}
        {mode !== "reset" && <label className="block text-sm font-medium">Email<input className="mt-2 min-h-11 w-full rounded-xl border border-black/15 px-3" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>}
        {(mode === "login" || mode === "signup" || mode === "reset") && <label className="block text-sm font-medium">Password<input className="mt-2 min-h-11 w-full rounded-xl border border-black/15 px-3" value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>}
        {mode === "reset" && <label className="block text-sm font-medium">Confirm password<input className="mt-2 min-h-11 w-full rounded-xl border border-black/15 px-3" value={confirm} onChange={(event) => setConfirm(event.target.value)} type="password" minLength={8} autoComplete="new-password" required /></label>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-black px-4 text-sm font-semibold text-white transition-transform hover:opacity-85 active:scale-[0.96] disabled:opacity-50">{busy ? "Working…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Save password"}</button>
      </form>
      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-black/60">
        {mode === "login" && <><a className="underline" href={`/signup?next=${encodeURIComponent(next)}`}>Create account</a><a className="underline" href={`/forgot-password?next=${encodeURIComponent(next)}`}>Forgot password?</a></>}
        {mode === "signup" && <a className="underline" href={`/login?next=${encodeURIComponent(next)}`}>Already have an account?</a>}
        {mode === "forgot" && <a className="underline" href={`/login?next=${encodeURIComponent(next)}`}>Back to sign in</a>}
      </div>
    </div>
  );
}
