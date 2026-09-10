"use client";

import { useState } from "react";
import { websiteFooterContent } from "@/content/site-studio/shared";
import { tenant } from "@/config/tenant";
import type { WebsiteFooter } from "@/lib/site-studio/website-chrome";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isApplicationWorkspace } from "@/lib/navigation/public-chrome";
import { Mail, ArrowRight, Loader2, CheckCircle2, Linkedin } from "lucide-react";
import { isValidEmail } from "@/lib/validation";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { Logo } from "@/components/ui/Logo";
import { trackConversion } from "@/lib/analytics";
import { getUTMParams, clearUTMParams } from "@/lib/utm";
import { useRv } from "@/components/home/reveal";

/**
 * Each footer section gets its own scroll trigger via `useRv` (the same
 * primitive every other list on the site now uses) instead of one shared
 * observer on the whole <footer> with a fixed per-section delay. A single
 * trigger + baked-in delay reads correctly only if the user's scroll speed
 * happens to match the delay window — scroll slowly and a later section's
 * delay has long since elapsed before it's ever visible; scroll fast and
 * several trigger in the same instant. This section fades in exactly when
 * IT individually scrolls into view, independent of its siblings.
 */
function FooterSection({
  className = "",
  style,
  index,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  index: number;
  children: ReactNode;
}) {
  const ref = useRv<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-footer-section
      className={`item-rv ${className}`}
      style={{ "--d": `${0.06 * index}s`, ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function Footer({
  content = websiteFooterContent,
  brandName = tenant.brand.name,
  logoSrc,
}: {
  content?: WebsiteFooter;
  brandName?: string;
  logoSrc?: string;
}) {
  const pathname = usePathname();
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

  // the admin app has its own chrome; the marketing footer doesn't belong there
  if (isApplicationWorkspace(pathname)) return null;

  return (
    <footer className="relative bg-bg-base pb-[var(--safe-bottom)] [--white-primary:var(--fg)] [--white-secondary:color-mix(in_srgb,var(--fg)_84%,var(--bg))] [--white-muted:color-mix(in_srgb,var(--fg)_72%,var(--bg))]">
      <SectionDivider variant="glow" />

      <div className="page-shell py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand Column */}
          <FooterSection index={0} className="sm:col-span-2 lg:col-span-5">
            <Logo className="mb-4" name={brandName} logoSrc={logoSrc} />
            <p className="text-white-secondary text-sm leading-relaxed mb-6 max-w-sm">
              {content.text}
            </p>
            <div className="flex flex-col gap-2 text-sm text-white-muted">
              {content.email && (
                <a
                  href={`mailto:${content.email}`}
                  className="flex items-center gap-2 hover:text-white-primary transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {content.email}
                </a>
              )}
              {content.social.map((link, index) => (
                <a
                  key={index}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white-primary transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                  {link.label}
                </a>
              ))}
            </div>
          </FooterSection>

          {/* Link Columns */}
          {content.columns.map((col, i) => (
            <FooterSection key={col.heading} index={i + 1}>
              <h3 className="text-sm font-semibold text-white-primary mb-4">{col.heading}</h3>
              <ul aria-label={`${col.heading} links`}>
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-10 items-center py-2 text-sm text-white-muted hover:text-white-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterSection>
          ))}
        </div>

        {/* Email Signup */}
        {content.newsletter.visible && (
          <FooterSection index={5} className="mt-14 pt-8 border-t border-[var(--border-subtle)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white-primary mb-1">
                  {content.newsletter.heading}
                </h3>
                <p className="text-sm text-white-muted">{content.newsletter.description}</p>
              </div>
              {status === "success" ? (
                <div className="flex items-center gap-2 text-sm text-[var(--success)]">
                  <CheckCircle2 className="w-4 h-4" />
                  {content.newsletter.successText}
                </div>
              ) : (
                <div className="w-full sm:w-auto">
                  <form className="flex gap-2 w-full sm:w-auto" onSubmit={handleSubscribe}>
                    <input
                      id="footer-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={content.newsletter.placeholder}
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (status === "error") setStatus("idle");
                      }}
                      disabled={status === "loading"}
                      aria-label={content.newsletter.inputLabel}
                      className="min-w-0 flex-1 sm:w-64 px-4 py-2.5 text-sm bg-bg-subtle border border-border-glass text-white-primary placeholder:text-white-muted focus:outline-none focus:ring-2 focus:ring-[var(--gold-base)] focus:border-gold transition-colors disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="shrink-0 bg-gold-gradient text-black px-4 py-2.5 text-sm font-semibold hover:brightness-110 active:scale-[0.96] transition-[filter,transform] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
                    >
                      {status === "loading" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {content.newsletter.buttonLabel}
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
          </FooterSection>
        )}

        {/* Bottom Bar */}
        <FooterSection
          index={6}
          className="mt-10 pt-6 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white-muted"
        >
          <p>
            &copy; {new Date().getFullYear()} {brandName}. {content.rights}
          </p>
          <div className="flex gap-6">
            {content.links.map((link, index) => (
              <Link
                key={index}
                href={link.href}
                className="hover:text-white-secondary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </FooterSection>
      </div>
    </footer>
  );
}
