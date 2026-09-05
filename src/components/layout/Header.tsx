"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackConversion } from "@/lib/analytics";
import { ChevronDown, Search } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";
import { MobileNav } from "./MobileNav";
import { Logo } from "@/components/ui/Logo";
import { navItems as navLinks } from "@/content/navigation";
import type { NavItem as NavLink } from "@/lib/types";
import { SearchDialog, useSearchShortcut } from "@/components/search/SearchDialog";
import { headerEntrance, headerLogoReveal, headerNavItem, headerCtaReveal } from "@/lib/animations";
import { isApplicationWorkspace } from "@/lib/navigation/public-chrome";

// Shared underline used by every nav item — grows from the left on hover and
// stays full-width for the current route. The single source of the nav's
// "where am I" + hover feedback.
const navUnderline =
  "pointer-events-none absolute -bottom-1 left-0 h-px w-full origin-left bg-[var(--fg)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

export function Header() {
  const reducedMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useSearchShortcut(useCallback(() => setSearchOpen(true), []));
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  // active when on the exact route or any child route (e.g. /work/[slug])
  const isActive = (href: string) =>
    href !== "#" && (pathname === href || pathname.startsWith(href + "/"));
  // dropdown parents stay lit when on the parent page or any of their children
  const isParentActive = (link: NavLink) =>
    isActive(link.href) || (link.children?.some((child) => isActive(child.href)) ?? false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      document.body.dataset.mobileNavigation = "open";
    } else {
      document.body.style.overflow = "";
      delete document.body.dataset.mobileNavigation;
    }
    return () => {
      document.body.style.overflow = "";
      delete document.body.dataset.mobileNavigation;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeOnResize = () => {
      setOpenDropdown(null);
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", closeOnResize);
    return () => desktop.removeEventListener("change", closeOnResize);
  }, []);

  // the admin app has its own chrome; the marketing header doesn't belong there
  if (isApplicationWorkspace(pathname)) return null;

  return (
    <>
      <motion.header
        ref={headerRef}
        variants={headerEntrance}
        initial={false}
        animate="visible"
        className={cn(
          "site-header fixed top-0 left-0 right-0 z-[90] transition-[background-color,backdrop-filter,box-shadow] duration-300",
          scrolled && "is-scrolled shadow-[0_12px_40px_rgba(11,11,11,0.08)]",
        )}
        style={{
          backgroundColor:
            pathname === "/docs" || pathname.startsWith("/docs/")
              ? "var(--bg)"
              : scrolled
                ? "var(--header-bg-scrolled)"
                : "transparent",
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
          <nav
            aria-label="Primary"
            className="hidden xl:flex items-center gap-5"
            onClick={(event) => {
              if ((event.target as Element).closest("a")) setOpenDropdown(null);
            }}
          >
            {navLinks.map((link) =>
              link.children ? (
                <motion.div
                  key={link.label}
                  variants={headerNavItem}
                  className="relative"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setOpenDropdown(null);
                      event.currentTarget.querySelector("button")?.focus();
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setOpenDropdown(null);
                    }
                  }}
                >
                  <button
                    className={cn(
                      "group/nav relative inline-flex min-h-11 items-center gap-1 text-sm transition-colors cursor-pointer rounded-sm",
                      focusRing,
                      isParentActive(link)
                        ? "text-[var(--text-nav-hover)]"
                        : "text-[var(--text-nav)] hover:text-[var(--text-nav-hover)]",
                    )}
                    aria-expanded={openDropdown === link.label}
                    type="button"
                    aria-controls={`primary-${link.label.toLowerCase().replaceAll(" ", "-")}`}
                    onClick={() => setOpenDropdown(openDropdown === link.label ? null : link.label)}
                  >
                    {link.label}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300",
                        openDropdown === link.label && "rotate-180",
                      )}
                    />
                    <span
                      className={cn(
                        navUnderline,
                        isParentActive(link)
                          ? "scale-x-100"
                          : "scale-x-0 group-hover/nav:scale-x-100",
                      )}
                    />
                  </button>
                  <AnimatePresence>
                    {openDropdown === link.label && (
                      <motion.div
                        initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 pt-2"
                      >
                        <div
                          id={`primary-${link.label.toLowerCase().replaceAll(" ", "-")}`}
                          role="group"
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
                              aria-current={pathname === child.href ? "page" : undefined}
                              className="block px-4 py-2.5 text-sm text-[var(--text-nav)] hover:text-[var(--text-nav-hover)] hover:bg-[var(--bg-hover-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--fg)]"
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
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={cn(
                      "group/nav relative inline-flex min-h-11 items-center text-sm transition-colors rounded-sm",
                      focusRing,
                      isActive(link.href)
                        ? "text-[var(--text-nav-hover)]"
                        : "text-[var(--text-nav)] hover:text-[var(--text-nav-hover)]",
                    )}
                  >
                    {link.label}
                    <span
                      className={cn(
                        navUnderline,
                        isActive(link.href)
                          ? "scale-x-100"
                          : "scale-x-0 group-hover/nav:scale-x-100",
                      )}
                    />
                  </Link>
                </motion.div>
              ),
            )}
          </nav>

          {/* Desktop CTA + Theme Toggle — same flat mono .btn as the hero CTA */}
          <motion.div variants={headerCtaReveal} className="hidden xl:flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the site"
              title="Search (press / or Cmd K)"
              className={cn(
                "grid size-11 place-items-center rounded-lg text-[var(--text-nav)] transition-colors hover:text-[var(--text-nav-hover)] hover:bg-[var(--bg-hover-subtle)] cursor-pointer",
                focusRing,
              )}
            >
              <Search className="size-[18px]" />
            </button>
            <ThemeToggle />
            <Link
              href="/contact"
              onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "header" })}
              className="btn btn-sm"
            >
              Book a call{" "}
              <span className="arw" aria-hidden="true">
                →
              </span>
            </Link>
          </motion.div>

          <div className="flex items-center xl:hidden">
            <motion.button
              variants={headerCtaReveal}
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the site"
              className={cn(
                "relative flex h-11 w-11 items-center justify-center cursor-pointer rounded-lg transition-transform duration-150 active:scale-[0.96]",
                focusRing,
              )}
            >
              <Search className="size-[19px] text-[var(--text-nav)]" />
            </motion.button>
            <motion.button
              variants={headerCtaReveal}
              className={cn(
                "relative flex h-11 w-11 items-center justify-center cursor-pointer rounded-lg transition-transform duration-150 active:scale-[0.96]",
                focusRing,
              )}
              ref={mobileTriggerRef}
              aria-expanded={mobileOpen}
              aria-controls="mobile-site-navigation"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <div className="flex flex-col items-end gap-[5px]">
                <span className="block h-[1.5px] w-5 bg-[var(--fg)]" />
                <span className="block h-[1.5px] w-3.5 bg-[var(--fg)]" />
                <span className="block h-[1.5px] w-4 bg-[var(--fg)]" />
              </div>
            </motion.button>
          </div>
        </div>
        <div className="site-header-rule" />
      </motion.header>

      {/* Mobile Nav Overlay */}
      <MobileNav
        isOpen={mobileOpen}
        onClose={() => {
          setMobileOpen(false);
          mobileTriggerRef.current?.focus();
        }}
        navLinks={navLinks}
      />

      <SearchDialog open={searchOpen} onOpenChangeAction={setSearchOpen} />
    </>
  );
}
