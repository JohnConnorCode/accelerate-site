"use client";

import { useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { trackConversion } from "@/lib/analytics";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Logo } from "@/components/ui/Logo";

interface NavLink {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: NavLink[];
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]";

export function MobileNav({ isOpen, onClose, navLinks }: MobileNavProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    setExpandedItem(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nav = closeButtonRef.current?.closest("nav");
        if (!nav) return;
        const focusable = nav.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled])"
        );
        if (focusable.length === 0) return;
        const first = focusable[0] as HTMLElement | undefined;
        const last = focusable[focusable.length - 1] as HTMLElement | undefined;
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  let linkIndex = 0;

  return (
        <div
          data-open={isOpen ? "true" : "false"}
          aria-hidden={!isOpen}
          inert={!isOpen}
          className="mobile-nav-overlay fixed inset-0 z-[100] lg:hidden"
          style={{ backgroundColor: "var(--bg)" }}
        >
          <nav
            className="mobile-nav flex h-full flex-col overflow-y-auto overscroll-contain"
            aria-label="Mobile"
          >
            <div className="flex items-center justify-between pb-6">
              <Logo size="sm" />
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className={`relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--rule)] transition-transform duration-150 active:scale-[0.96] cursor-pointer ${focusRing}`}
                aria-label="Close navigation menu"
              >
                <span className="absolute h-px w-4 rotate-45 bg-[var(--fg)]" />
                <span className="absolute h-px w-4 -rotate-45 bg-[var(--fg)]" />
              </button>
            </div>

            <div className="flex flex-1 flex-col justify-center py-2">
              <div className="flex flex-col">
                {navLinks.map((link) => {
                  const currentIndex = linkIndex++;
                  return link.children ? (
                    <div
                      key={link.label}
                      className="mobile-nav-item"
                      style={{ "--mobile-nav-index": currentIndex } as CSSProperties}
                    >
                      <button
                        onClick={() =>
                          setExpandedItem(
                            expandedItem === link.label ? null : link.label
                          )
                        }
                        aria-expanded={expandedItem === link.label}
                        className={`group flex w-full items-center justify-between py-3.5 cursor-pointer ${focusRing}`}
                      >
                        <span className="flex items-baseline gap-4">
                          <span className="font-mono text-[10px] tabular-nums tracking-[0.14em] text-[var(--soft)]">
                            {String(currentIndex + 1).padStart(2, "0")}
                          </span>
                          <span className="font-display text-[1.7rem] font-medium leading-none tracking-[-0.03em] text-[var(--fg)]">
                            {link.label}
                          </span>
                        </span>
                        <span className="mobile-nav-chevron" data-expanded={expandedItem === link.label ? "true" : "false"}>
                          <ChevronRight className="h-4 w-4 text-[var(--mid)]" />
                        </span>
                      </button>
                      <div className="mobile-nav-children" data-expanded={expandedItem === link.label ? "true" : "false"}>
                        <div className="min-h-0 overflow-hidden">
                            <div className="mb-3 ml-[2.65rem] border-l border-[var(--rule)] pl-4">
                              {link.children.map((child) => (
                                <div key={child.href}>
                                  <Link
                                    href={child.href}
                                    onClick={onClose}
                                    className={`block py-2.5 text-[1.02rem] text-[var(--mid)] transition-colors active:text-[var(--fg)] ${focusRing}`}
                                  >
                                    {child.label}
                                  </Link>
                                </div>
                              ))}
                            </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={link.href}
                      className="mobile-nav-item"
                      style={{ "--mobile-nav-index": currentIndex } as CSSProperties}
                    >
                      <Link
                        href={link.href}
                        onClick={onClose}
                        className={`group flex items-baseline gap-4 py-3.5 ${focusRing}`}
                      >
                        <span className="font-mono text-[10px] tabular-nums tracking-[0.14em] text-[var(--soft)]">
                          {String(currentIndex + 1).padStart(2, "0")}
                        </span>
                        <span className="font-display text-[1.7rem] font-medium leading-none tracking-[-0.03em] text-[var(--fg)]">
                          {link.label}
                        </span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mobile-nav-cta">
              <Link
                href="/contact"
                onClick={() => {
                  trackConversion("Strategy Call CTA Clicked", { location: "mobile_nav" });
                  onClose();
                }}
                className="btn w-full"
              >
                Book a call <span className="arw" aria-hidden="true">→</span>
              </Link>
              <div className="mt-5 flex items-center justify-between">
                <ThemeToggle />
                <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--soft)]">
                  Accelerate
                </span>
              </div>
            </div>
          </nav>
        </div>
  );
}
