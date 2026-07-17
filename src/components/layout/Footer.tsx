"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Mail, ArrowRight, Loader2, CheckCircle2, Linkedin } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { isValidEmail } from "@/lib/validation";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { Logo } from "@/components/ui/Logo";
import { trackConversion } from "@/lib/analytics";
import { getUTMParams, clearUTMParams } from "@/lib/utm";

const footerColumns = [
  {
    title: "Services",
    links: [
      { label: "AI Strategy & Roadmap", href: "/services#strategy" },
      { label: "Workflow Automation", href: "/services#automation" },
      { label: "Sales & Marketing", href: "/services#sales" },
      { label: "Customer Engagement", href: "/services#engagement" },
      { label: "Content Creation", href: "/services#content" },
      { label: "Data & Reporting", href: "/services#reporting" },
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
  const footerRef = useRef<HTMLElement>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useGSAP(() => {
    if (!footerRef.current) return;
    if (prefersReducedMotion()) return;

    const sections = footerRef.current.querySelectorAll("[data-footer-section]");

    gsap.fromTo(sections,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: footerRef.current,
          start: "top 90%",
          toggleActions: "play none none none",
        },
      }
    );
  }, { scope: footerRef });

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
        body: JSON.stringify({ email: trimmed, utm: getUTMParams() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong.");
      }

      trackConversion("Newsletter Subscribed");
      clearUTMParams();
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to subscribe. Please try again.");
    }
  };

  return (
    <footer ref={footerRef} className="relative bg-bg-base">
      {/* Gold top line */}
      <SectionDivider variant="glow" />

      <div className="page-shell py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8">
          {/* Brand Column */}
          <div data-footer-section className="lg:col-span-2">
            <Logo className="mb-4" />
            <p className="text-white-secondary text-sm leading-relaxed mb-6 max-w-sm">
              AI strategy and systems for small businesses. We figure out where
              AI fits, then build and manage the systems that make it happen.
            </p>
            <div className="flex flex-col gap-2 text-sm text-white-muted">
              <a
                href="mailto:john@acceleratewith.us"
                className="flex items-center gap-2 hover:text-white-primary transition-colors"
              >
                <Mail className="w-4 h-4" />
                john@acceleratewith.us
              </a>
              <a
                href="https://www.linkedin.com/company/acceleratewith/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white-primary transition-colors"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </a>
            </div>
          </div>

          {/* Link Columns */}
          {footerColumns.map((col) => (
            <div key={col.title} data-footer-section>
              <h3 className="text-sm font-semibold text-white-primary mb-4">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white-muted hover:text-white-primary transition-colors"
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
        <div data-footer-section className="mt-14 pt-8 border-t border-[var(--border-subtle)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white-primary mb-1">
                Get growth tips in your inbox
              </h3>
              <p className="text-sm text-white-muted">
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
                    inputMode="email"
                    autoComplete="email"
                    placeholder="your@email.com"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (status === "error") setStatus("idle");
                    }}
                    disabled={status === "loading"}
                    aria-label="Email address"
                    className="flex-1 sm:w-64 px-4 py-2.5 rounded-lg text-sm bg-bg-subtle border border-border-glass text-white-primary placeholder:text-white-muted focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] focus:border-gold transition-colors disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="bg-gold-gradient text-black px-4 py-2.5 rounded-lg text-sm font-semibold hover:brightness-110 transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
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
        <div data-footer-section className="mt-10 pt-6 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white-muted">
          <p>&copy; {new Date().getFullYear()} Accelerate. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white-secondary transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white-secondary transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
