"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { isValidEmail } from "@/lib/validation";

const footerColumns = [
  {
    title: "Services",
    links: [
      { label: "AI-Powered Websites", href: "/services#websites" },
      { label: "Automations & Workflows", href: "/services#automations" },
      { label: "AI Agents", href: "/services#agents" },
      { label: "Packages & Pricing", href: "/packages" },
    ],
  },
  {
    title: "Industries",
    links: [
      { label: "Home Services", href: "/industries/home-services" },
      { label: "Law Firms", href: "/industries/law-firms" },
      { label: "Professional Services", href: "/industries/professional-services" },
      { label: "Real Estate", href: "/industries/real-estate" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Case Studies", href: "/results" },
      { label: "Website Grader", href: "/tools/website-grader" },
      { label: "ROI Calculator", href: "/tools/roi-calculator" },
      { label: "Free Downloads", href: "/resources" },
      { label: "Learning Hub", href: "/learn" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Partners", href: "/partners" },
      { label: "Changelog", href: "/changelog" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!isValidEmail(trimmed)) {
      setStatus("error");
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong.");
      }

      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to subscribe. Please try again.");
    }
  };

  return (
    <footer className="relative bg-[var(--bg-base)]">
      {/* Gold top line */}
      <div className="section-divider" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <span className="text-xl font-bold text-gold-gradient tracking-[0.15em] uppercase font-display">
                ACCELERATE
              </span>
            </Link>
            <p className="text-[var(--white-secondary)] text-sm leading-relaxed mb-6 max-w-sm">
              AI-powered websites, automations, and intelligent agents that help
              small businesses capture more leads and save time.
            </p>
            <div className="flex flex-col gap-2 text-sm text-[var(--white-muted)]">
              <a
                href="mailto:hello@acceleratewith.us"
                className="flex items-center gap-2 hover:text-[var(--white-primary)] transition-colors"
              >
                <Mail className="w-4 h-4" />
                hello@acceleratewith.us
              </a>
              <a
                href="tel:+16015551234"
                className="flex items-center gap-2 hover:text-[var(--white-primary)] transition-colors"
              >
                <Phone className="w-4 h-4" />
                (601) 555-1234
              </a>
            </div>
          </div>

          {/* Link Columns */}
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-[var(--white-primary)] mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--white-muted)] hover:text-[var(--white-primary)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Email Signup */}
        <div className="mt-14 pt-8 border-t border-[var(--border-subtle)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[var(--white-primary)] mb-1">
                Get growth tips in your inbox
              </h4>
              <p className="text-sm text-[var(--white-muted)]">
                No spam. Unsubscribe anytime.
              </p>
            </div>
            {status === "success" ? (
              <div className="flex items-center gap-2 text-sm text-[var(--success)]">
                <CheckCircle2 className="w-4 h-4" />
                You&rsquo;re subscribed!
              </div>
            ) : (
              <div className="w-full sm:w-auto">
                <form
                  className="flex gap-2 w-full sm:w-auto"
                  onSubmit={handleSubscribe}
                >
                  <input
                    id="footer-email"
                    type="email"
                    placeholder="your@email.com"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (status === "error") setStatus("idle");
                    }}
                    disabled={status === "loading"}
                    aria-label="Email address"
                    className="flex-1 sm:w-64 px-4 py-2.5 rounded-lg text-sm bg-[var(--bg-subtle)] border border-[var(--border-glass)] text-[var(--white-primary)] placeholder:text-[var(--white-muted)] focus:outline-none focus:border-[var(--gold-base)] transition-colors disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="bg-gold-gradient text-black px-4 py-2.5 rounded-lg text-sm font-semibold hover:brightness-110 transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {status === "loading" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Subscribe
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
                {status === "error" && errorMsg && (
                  <p className="text-xs text-[var(--error)] mt-1.5">{errorMsg}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--white-muted)]">
          <p>&copy; {new Date().getFullYear()} Accelerate. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[var(--white-secondary)] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-[var(--white-secondary)] transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
