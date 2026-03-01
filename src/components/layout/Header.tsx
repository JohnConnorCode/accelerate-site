"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
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
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "glass-prominent border-b border-white/5 py-3"
            : "bg-transparent py-5"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1 group">
            <span className="text-2xl font-bold text-gold-gradient tracking-tight">
              Accelerate
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
                    className="text-sm text-white/70 hover:text-white transition-colors cursor-pointer"
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
                        <div className="glass-prominent rounded-xl py-2 min-w-[220px]">
                          {link.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="block px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
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
                  className="text-sm text-white/70 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:block">
            <Link href="/#solution-generator">
              <Button variant="primary" size="sm">
                Get Your Growth Plan
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
