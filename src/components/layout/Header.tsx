"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";
import { MobileNav } from "./MobileNav";

interface NavChild {
  label: string;
  href: string;
}

interface NavLink {
  label: string;
  href: string;
  children?: NavChild[];
}

const navLinks: NavLink[] = [
  { label: "Services", href: "/services" },
  { label: "Packages", href: "/packages" },
  {
    label: "Industries",
    href: "#",
    children: [
      { label: "Home Services", href: "/industries/home-services" },
      { label: "Law Firms", href: "/industries/law-firms" },
      { label: "Professional Services", href: "/industries/professional-services" },
      { label: "Real Estate", href: "/industries/real-estate" },
    ],
  },
  { label: "Results", href: "/results" },
  {
    label: "Tools",
    href: "#",
    children: [
      { label: "Website Grader", href: "/tools/website-grader" },
      { label: "ROI Calculator", href: "/tools/roi-calculator" },
      { label: "Free Resources", href: "/resources" },
    ],
  },
  { label: "Learn", href: "/learn" },
  { label: "Contact", href: "/contact" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const borderRef = useRef<HTMLDivElement>(null);
  const glassSurface = {
    backdropFilter: "blur(22px) saturate(165%)",
    WebkitBackdropFilter: "blur(22px) saturate(165%)",
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          "fixed top-0 left-0 right-0 z-[90] transition-all duration-500",
          scrolled ? "py-3 shadow-[0_20px_70px_rgba(0,0,0,0.45)]" : "py-5"
        )}
        style={{
          ...glassSurface,
          backgroundColor: scrolled ? "var(--header-bg-scrolled)" : "var(--header-bg)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1 group">
            <span className="text-xl font-bold text-gold-gradient tracking-[0.15em] uppercase font-display">
              ACCELERATE
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) =>
              link.children ? (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(link.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setOpenDropdown(null);
                    }
                  }}
                >
                  <button
                    className="text-sm text-[var(--text-nav)] hover:text-[var(--text-nav-hover)] transition-colors cursor-pointer"
                    aria-expanded={openDropdown === link.label}
                    aria-haspopup="true"
                    onFocus={() => setOpenDropdown(link.label)}
                  >
                    {link.label}
                  </button>
                  <AnimatePresence>
                    {openDropdown === link.label && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 pt-2"
                      >
                        <div
                          className="glass-prominent rounded-xl py-2 min-w-[220px] border border-[var(--border-light)]"
                          style={{
                            ...glassSurface,
                            backgroundColor: "var(--dropdown-bg)",
                          }}
                        >
                          {link.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="block px-4 py-2.5 text-sm text-[var(--text-nav)] hover:text-[var(--text-nav-hover)] hover:bg-[var(--bg-hover-subtle)] transition-colors"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[var(--text-nav)] hover:text-[var(--text-nav-hover)] transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* Desktop CTA + Theme Toggle */}
          <div className="hidden lg:flex items-center gap-3">
            <ThemeToggle />
            <Link href="/plan-builder">
              <Button variant="primary" size="sm" className="group/cta">
                Get Your Growth Plan
                <ArrowRight className="w-4 h-4 ml-1.5 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
              </Button>
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="lg:hidden text-[var(--gold-base)] p-2 cursor-pointer"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
        {/* Animated gold gradient bottom border */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px transition-opacity duration-500"
          style={{
            opacity: scrolled ? 1 : 0,
            background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4), rgba(245,208,96,0.3), rgba(212,175,55,0.4), transparent)",
          }}
        />
      </header>

      {/* Mobile Nav Overlay */}
      <MobileNav
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        navLinks={navLinks}
      />
    </>
  );
}
