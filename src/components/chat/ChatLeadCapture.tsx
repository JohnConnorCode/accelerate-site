"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

interface ChatLeadCaptureProps {
  onSubmit: (name: string, email: string) => void;
}

export function ChatLeadCapture({ onSubmit }: ChatLeadCaptureProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && email) {
      onSubmit(name, email);
    }
  };

  return (
    <div className="rounded-lg p-3 mx-2 mb-2 bg-bg-subtle border border-border-glass">
      <p className="text-xs text-white-secondary mb-2">
        Want personalized recommendations? Share your info and we&rsquo;ll follow up:
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          placeholder="Your name"
          aria-label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-md bg-bg-base border border-border-glass px-3 py-1.5 text-xs text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors"
        />
        <input
          type="email"
          placeholder="your@email.com"
          aria-label="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md bg-bg-base border border-border-glass px-3 py-1.5 text-xs text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors"
        />
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-1 rounded-md bg-gold-gradient px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110 transition-all cursor-pointer"
        >
          Send <ArrowRight className="h-3 w-3" />
        </button>
      </form>
    </div>
  );
}
