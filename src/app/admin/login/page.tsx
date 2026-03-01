"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/admin";

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

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="glass-prominent rounded-xl p-8">
          <h1 className="font-display text-2xl font-bold text-gold-gradient text-center mb-2">
            Accelerate
          </h1>
          <p className="text-center text-sm text-white-muted mb-8">
            Admin Dashboard
          </p>

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
                placeholder="admin@acceleratewith.us"
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

            {error && (
              <p className="text-sm text-error">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
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
