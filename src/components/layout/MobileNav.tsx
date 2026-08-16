"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.25, delay: 0.1 } },
};

const panelVariants = {
  hidden: { x: "100%" },
  visible: {
    x: 0,
    transition: { type: "spring" as const, damping: 30, stiffness: 300, mass: 0.8 },
  },
  exit: {
    x: "100%",
    transition: { type: "spring" as const, damping: 35, stiffness: 400, mass: 0.6 },
  },
};

const linkVariants = {
  hidden: { opacity: 0, x: 30 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      damping: 20,
      stiffness: 200,
      delay: 0.15 + i * 0.06,
    },
  }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.15 } },
};

const ctaVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 20, stiffness: 200, delay: 0.55 },
  },
  exit: { opacity: 0, y: 10, transition: { duration: 0.15 } },
};

export function MobileNav({ isOpen, onClose, navLinks }: MobileNavProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => closeButtonRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[100] lg:hidden"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.nav
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-[400px] flex flex-col overflow-y-auto"
            style={{
              backgroundColor: "var(--mobile-nav-bg)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
            }}
          >
            {/* Gold accent edge */}
            <div
              className="absolute left-0 top-0 bottom-0 w-px"
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, rgba(var(--accent-rgb), 0.5) 20%, rgba(var(--accent-rgb), 0.3) 80%, transparent 100%)",
              }}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <Logo size="sm" />
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="relative w-11 h-11 flex items-center justify-center rounded-full border border-[var(--border-light)] hover:border-border-gold transition-all duration-150 active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
                aria-label="Close navigation menu"
              >
                <span
                  className="absolute w-5 h-px rotate-45"
                  style={{ backgroundColor: "var(--text-nav)" }}
                />
                <span
                  className="absolute w-5 h-px -rotate-45"
                  style={{ backgroundColor: "var(--text-nav)" }}
                />
              </button>
            </div>

            {/* Divider */}
            <div
              className="mx-6 h-px"
              style={{
                background:
                  "linear-gradient(90deg, rgba(var(--accent-rgb), 0.4), rgba(var(--accent-rgb), 0.1), transparent)",
              }}
            />

            {/* Nav Links */}
            <div className="flex-1 px-6 pt-6 pb-4">
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => {
                  const currentIndex = linkIndex++;
                  return link.children ? (
                    <motion.div
                      key={link.label}
                      variants={linkVariants}
                      custom={currentIndex}
                    >
                      <button
                        onClick={() =>
                          setExpandedItem(
                            expandedItem === link.label ? null : link.label
                          )
                        }
                        aria-expanded={expandedItem === link.label}
                        className="w-full flex items-center justify-between py-3.5 px-2 -mx-2 group cursor-pointer rounded-lg transition-[background-color] duration-150 active:bg-[var(--bg-hover-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
                      >
                        <div className="flex items-center gap-4">
                          <span
                            className="text-xs font-mono tabular-nums"
                            style={{ color: "rgba(var(--accent-rgb), 0.5)" }}
                          >
                            {String(currentIndex + 1).padStart(2, "0")}
                          </span>
                          <span className="text-lg font-medium text-[var(--text-nav)] group-hover:text-[var(--text-nav-hover)] transition-colors">
                            {link.label}
                          </span>
                        </div>
                        <motion.div
                          animate={{ rotate: expandedItem === link.label ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight
                            className="w-4 h-4 text-[var(--text-nav)] group-hover:text-gold transition-colors"
                          />
                        </motion.div>
                      </button>
                      <AnimatePresence>
                        {expandedItem === link.label && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                            className="overflow-hidden"
                          >
                            <div
                              className="ml-10 pl-4 mb-2 border-l"
                              style={{
                                borderColor: "rgba(var(--accent-rgb), 0.2)",
                              }}
                            >
                              {link.children.map((child, ci) => (
                                <motion.div
                                  key={child.href}
                                  initial={{ opacity: 0, x: 10 }}
                                  animate={{
                                    opacity: 1,
                                    x: 0,
                                    transition: { delay: ci * 0.05 },
                                  }}
                                >
                                  <Link
                                    href={child.href}
                                    onClick={onClose}
                                    className="block py-2.5 px-2 -mx-2 text-[15px] text-white-muted hover:text-[var(--text-nav-hover)] active:text-[var(--text-nav-hover)] active:bg-[var(--bg-hover-subtle)] transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
                                  >
                                    {child.label}
                                  </Link>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={link.href}
                      variants={linkVariants}
                      custom={currentIndex}
                    >
                      <Link
                        href={link.href}
                        onClick={onClose}
                        className="flex items-center gap-4 py-3.5 px-2 -mx-2 group rounded-lg transition-[background-color] duration-150 active:bg-[var(--bg-hover-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
                      >
                        <span
                          className="text-xs font-mono tabular-nums"
                          style={{ color: "rgba(var(--accent-rgb), 0.5)" }}
                        >
                          {String(currentIndex + 1).padStart(2, "0")}
                        </span>
                        <span className="text-lg font-medium text-[var(--text-nav)] group-hover:text-[var(--text-nav-hover)] transition-colors">
                          {link.label}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Bottom section */}
            <div className="mt-auto px-6 pb-8">
              {/* Divider */}
              <div
                className="h-px mb-6"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(var(--accent-rgb), 0.3), rgba(var(--accent-rgb), 0.1), transparent)",
                }}
              />

              {/* CTA — same flat mono .btn as the hero CTA */}
              <motion.div variants={ctaVariants}>
                <Link
                  href="/contact"
                  onClick={() => { trackConversion("Strategy Call CTA Clicked", { location: "mobile_nav" }); onClose(); }}
                  className="btn w-full"
                >
                  Book a free strategy session <span className="arw" aria-hidden="true">→</span>
                </Link>
              </motion.div>

              {/* Theme toggle + copyright */}
              <motion.div
                variants={ctaVariants}
                className="flex items-center justify-between mt-6"
              >
                <ThemeToggle />
                <span
                  className="text-xs"
                  style={{ color: "rgba(var(--accent-rgb), 0.4)" }}
                >
                  Accelerate Agency
                </span>
              </motion.div>
            </div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
