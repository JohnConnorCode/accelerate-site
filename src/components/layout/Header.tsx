"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackConversion } from "@/lib/analytics";
import { ChevronDown, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";
import { MobileNav } from "./MobileNav";
import { Logo } from "@/components/ui/Logo";
import { verticals } from "@/content/verticals";
import { SearchDialog, useSearchShortcut } from "@/components/search/SearchDialog";
import {
  headerEntrance,
  headerLogoReveal,
  headerNavItem,
  headerCtaReveal,
} from "@/lib/animations";

interface NavChild {
  label: string;
  href: string;
}

interface NavLink {
  label: string;
  href: string;
  children?: NavChild[];
}

// Derived from the vertical content, never hand-listed. The nonprofits page
// shipped and stayed invisible for a day because this was a literal list of nine
// that nobody remembered to extend, which is the same drift that had left
// nonprofits out of the sitemap.
const INDUSTRY_LINKS: NavChild[] = verticals.map((vertical) => ({
  label: vertical.name,
  href: `/industries/${vertical.slug}`,
}));

const navLinks: NavLink[] = [
  { label: "Services", href: "/services" },
  { label: "Command Center", href: "/command-center" },
  {
    label: "Industries",
    href: "#",
    children: INDUSTRY_LINKS,
  },
  { label: "Learn", href: "/learn" },
  { label: "Contact", href: "/contact" },
];

// Shared underline used by every nav item — grows from the left on hover and
// stays full-width for the current route. The single source of the nav's
// "where am I" + hover feedback.
const navUnderline =
  "pointer-events-none absolute -bottom-1 left-0 h-px w-full origin-left bg-gold transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useSearchShortcut(useCallback(() => setSearchOpen(true), []));
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  // active when on the exact route or any child route (e.g. /results/[slug])
  const isActive = (href: string) =>
    href !== "#" && (pathname === href || pathname.startsWith(href + "/"));
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

  // the admin app has its own chrome; the marketing header doesn't belong there
  if (pathname.startsWith("/admin") || pathname.startsWith("/roofing")) return null;

  return (
    <>
      <motion.header
        ref={headerRef}
        variants={headerEntrance}
        initial="hidden"
        animate="visible"
        className={cn(
          "fixed top-0 left-0 right-0 z-[90] transition-[background-color,backdrop-filter,padding,box-shadow] duration-500",
          scrolled
            ? "py-3 shadow-[0_20px_70px_rgba(0,0,0,0.45)]"
            : "py-6 lg:py-8"
        )}
        style={{
          backgroundColor: scrolled ? "var(--header-bg-scrolled)" : "transparent",
          backdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
        }}
      >
        <div className="page-shell flex items-center justify-between">
          {/* Logo */}
          <motion.div variants={headerLogoReveal}>
            <Logo />
          </motion.div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) =>
              link.children ? (
                <motion.div
                  key={link.label}
                  variants={headerNavItem}
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
                    className={cn(
                      "group/nav relative inline-flex items-center gap-1 text-sm transition-colors cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      pathname.startsWith("/industries")
                        ? "text-[var(--text-nav-hover)]"
                        : "text-[var(--text-nav)] hover:text-[var(--text-nav-hover)]"
                    )}
                    aria-expanded={openDropdown === link.label}
                    aria-haspopup="true"
                    onFocus={() => setOpenDropdown(link.label)}
                  >
                    {link.label}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300",
                        openDropdown === link.label && "rotate-180"
                      )}
                    />
                    <span
                      className={cn(
                        navUnderline,
                        pathname.startsWith("/industries")
                          ? "scale-x-100"
                          : "scale-x-0 group-hover/nav:scale-x-100"
                      )}
                    />
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
                          role="menu"
                          aria-label={`${link.label} submenu`}
                          className="rounded-xl py-2 min-w-[220px] border border-[var(--border-light)]"
                          style={{
                            backgroundColor: "var(--dropdown-bg)",
                            backdropFilter: "blur(24px) saturate(180%)",
                            WebkitBackdropFilter: "blur(24px) saturate(180%)",
                          }}
                        >
                          {link.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              role="menuitem"
                              className="block px-4 py-2.5 text-sm text-[var(--text-nav)] hover:text-[var(--text-nav-hover)] hover:bg-[var(--bg-hover-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-base)]"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div key={link.href} variants={headerNavItem}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={cn(
                      "group/nav relative inline-flex text-sm transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      isActive(link.href)
                        ? "text-[var(--text-nav-hover)]"
                        : "text-[var(--text-nav)] hover:text-[var(--text-nav-hover)]"
                    )}
                  >
                    {link.label}
                    <span
                      className={cn(
                        navUnderline,
                        isActive(link.href) ? "scale-x-100" : "scale-x-0 group-hover/nav:scale-x-100"
                      )}
                    />
                  </Link>
                </motion.div>
              )
            )}
          </nav>

          {/* Desktop CTA + Theme Toggle — same flat mono .btn as the hero CTA */}
          <motion.div variants={headerCtaReveal} className="hidden lg:flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the site"
              title="Search (press / or Cmd K)"
              className="grid size-9 place-items-center rounded-lg text-[var(--text-nav)] transition-colors hover:text-[var(--text-nav-hover)] hover:bg-[var(--bg-hover-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)] cursor-pointer"
            >
              <Search className="size-[18px]" />
            </button>
            <ThemeToggle />
            <Link
              href="/contact"
              onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "header" })}
              className="btn btn-sm"
            >
              Book a free strategy session <span className="arw" aria-hidden="true">→</span>
            </Link>
          </motion.div>

          {/* Mobile: search sits outside the menu, so it is one tap rather than two */}
          <motion.button
            variants={headerCtaReveal}
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search the site"
            className="lg:hidden relative w-11 h-11 flex items-center justify-center cursor-pointer rounded-lg transition-transform duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
          >
            <Search className="size-[19px] text-[var(--text-nav)]" />
          </motion.button>

          {/* Mobile Hamburger */}
          <motion.button
            variants={headerCtaReveal}
            className="lg:hidden relative w-11 h-11 flex items-center justify-center -mr-2 cursor-pointer rounded-lg transition-transform duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <div className="flex flex-col items-end gap-[5px]">
              <span className="block h-[2px] w-6 rounded-full bg-gold transition-transform duration-300" />
              <span className="block h-[2px] w-4 rounded-full bg-gold transition-transform duration-300" />
              <span className="block h-[2px] w-5 rounded-full bg-gold transition-transform duration-300" />
            </div>
          </motion.button>
        </div>
        {/* Animated gold gradient bottom border */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px transition-opacity duration-500"
          style={{
            opacity: scrolled ? 1 : 0,
            background: "linear-gradient(90deg, transparent, rgba(var(--accent-rgb),0.4), rgba(var(--accent-rgb),0.3), rgba(var(--accent-rgb),0.4), transparent)",
          }}
        />
      </motion.header>

      {/* Mobile Nav Overlay */}
      <MobileNav
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        navLinks={navLinks}
      />

      <SearchDialog open={searchOpen} onOpenChangeAction={setSearchOpen} />
    </>
  );
}
