"use client";

import { useState } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/booking";

interface ChatLeadCaptureProps {
  onSubmit: (name: string, email: string) => Promise<boolean>;
  onDismiss: () => void;
}

export function ChatLeadCapture({ onSubmit, onDismiss }: ChatLeadCaptureProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || submitting) return;

    setSubmitting(true);
    setError("");
    const saved = await onSubmit(name.trim(), email.trim());
    if (!saved) {
      setError(`I couldn't save that yet. Try again or email ${CONTACT_EMAIL} directly.`);
      setSubmitting(false);
    }
  };

  return (
    <div className="relative mx-2 mb-2 rounded-xl border border-border-glass bg-bg-subtle p-3.5 shadow-lg">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss contact form"
        className="absolute right-1.5 top-1.5 inline-flex h-10 w-10 items-center justify-center rounded-lg text-white-muted transition-[color,background-color,transform] hover:bg-white/5 hover:text-white-primary active:scale-[0.96]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="mb-3 pr-8 text-xs leading-relaxed text-white-secondary">
        Want John to look at this properly? Leave your name and email. You&rsquo;ll get one note
        confirming it landed, then a real reply from John. That&rsquo;s it.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          placeholder="Your name"
          aria-label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          disabled={submitting}
          className="min-h-10 w-full rounded-lg bg-bg-base border border-border-glass px-3 py-2 text-xs text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors disabled:opacity-60"
        />
        <input
          type="email"
          placeholder="your@email.com"
          aria-label="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={submitting}
          className="min-h-10 w-full rounded-lg bg-bg-base border border-border-glass px-3 py-2 text-xs text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors disabled:opacity-60"
        />
        {error && <p className="text-xs leading-relaxed text-red-300" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-10 w-full items-center justify-center gap-1.5 bg-[var(--fg)] px-3 py-2 text-xs font-semibold text-[var(--bg)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending securely…</> : <>Send to John <ArrowRight className="h-3 w-3" /></>}
        </button>
      </form>
    </div>
  );
}
