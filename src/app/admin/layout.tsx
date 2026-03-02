"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  FileText,
  LogOut,
  Settings,
  MessageCircle,
  Handshake,
  Mail,
  Globe,
  Menu,
  X,
  Inbox,
  AtSign,
  Download,
  Activity,
  Search,
  BarChart3,
  User,
  Building2,
  FileCheck,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/admin/NotificationBell";

const sidebarSections = [
  {
    label: "Overview",
    links: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Activity", href: "/admin/activity", icon: Activity },
      { label: "Leads", href: "/admin/leads", icon: Users },
      { label: "Clients", href: "/admin/clients", icon: Building2 },
      { label: "Proposals", href: "/admin/proposals", icon: FileCheck },
      { label: "Revenue", href: "/admin/revenue", icon: DollarSign },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Content", href: "/admin/content", icon: FileText },
    ],
  },
  {
    label: "Channels",
    links: [
      { label: "Contacts", href: "/admin/contacts", icon: Inbox },
      { label: "Subscribers", href: "/admin/subscribers", icon: AtSign },
      { label: "Chat Leads", href: "/admin/chat-leads", icon: MessageCircle },
      { label: "Resources", href: "/admin/resources", icon: Download },
      { label: "Partners", href: "/admin/partners", icon: Handshake },
      { label: "Email Sequences", href: "/admin/email-sequences", icon: Mail },
      { label: "Website Grades", href: "/admin/website-grades", icon: Globe },
    ],
  },
  {
    label: "System",
    links: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

const allLinks = sidebarSections.flatMap((s) => s.links);

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const crumbs = [{ label: "Admin", href: "/admin" }];
  const active = allLinks.find(
    (l) => l.href !== "/admin" && pathname.startsWith(l.href)
  );
  if (active) {
    crumbs.push({ label: active.label, href: active.href });
  }
  // Handle contact timeline pages
  if (pathname.startsWith("/admin/contacts/") && pathname !== "/admin/contacts") {
    crumbs.push({ label: "Contacts", href: "/admin/contacts" });
    crumbs.push({ label: "Timeline", href: pathname });
  }
  return crumbs;
}

interface SearchPerson {
  name: string;
  email: string;
  type: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPeople, setSearchPeople] = useState<SearchPerson[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  // Cmd+K shortcut to toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
        setSearchQuery("");
        setSearchPeople([]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced people search
  const searchForPeople = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchPeople([]);
      return;
    }
    setSearchingPeople(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchPeople(data.results || []);
    } catch {
      setSearchPeople([]);
    } finally {
      setSearchingPeople(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchForPeople(value), 300);
  };

  // Don't show sidebar on login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && pathname.startsWith(href));

  const breadcrumbs = getBreadcrumbs(pathname);

  const filteredLinks = searchQuery
    ? allLinks.filter((l) =>
        l.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allLinks;

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 glass-prominent border-r border-border-glass">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <SidebarContent isActive={isActive} onSignOut={handleSignOut} />
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-prominent border-b border-border-glass px-4 py-3 flex items-center justify-between">
        <Link href="/admin" className="font-display text-lg font-bold text-gold-gradient">
          Accelerate
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setSearchOpen(true)}
            className="text-white-muted p-1 cursor-pointer hover:text-white-primary"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-white-primary p-1 cursor-pointer"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute left-0 top-0 h-full w-64 glass-prominent border-r border-border-glass p-4 flex flex-col"
            >
              <SidebarContent
                isActive={isActive}
                onSignOut={handleSignOut}
                onNavigate={() => setMobileOpen(false)}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Cmd+K Search Overlay */}
      <CmdKSearch
        open={searchOpen}
        onClose={() => { setSearchOpen(false); setSearchQuery(""); setSearchPeople([]); }}
        query={searchQuery}
        onQueryChange={handleSearchChange}
        pageResults={filteredLinks}
        peopleResults={searchPeople}
        searchingPeople={searchingPeople}
        onSelectPage={(href) => { router.push(href); setSearchOpen(false); setSearchQuery(""); setSearchPeople([]); }}
        onSelectPerson={(email) => { router.push(`/admin/contacts/${encodeURIComponent(email)}`); setSearchOpen(false); setSearchQuery(""); setSearchPeople([]); }}
        inputRef={searchInputRef}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pt-16 lg:p-8 lg:pt-8">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 1 && (
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-white-muted lg:mb-2">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-white-muted/50">/</span>}
                <Link
                  href={crumb.href}
                  className={cn(
                    "hover:text-white-secondary transition-colors",
                    i === breadcrumbs.length - 1 && "text-white-secondary"
                  )}
                >
                  {crumb.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        {children}
      </main>
    </div>
  );
}

interface SidebarContentProps {
  isActive: (href: string) => boolean;
  onSignOut: () => Promise<void> | void;
  onNavigate?: () => void;
}

function SidebarContent({
  isActive,
  onSignOut,
  onNavigate,
}: SidebarContentProps) {
  const handleNavigate = () => {
    onNavigate?.();
  };

  const handleSignOutClick = async () => {
    onNavigate?.();
    await onSignOut();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6 px-3 pt-2">
        <Link href="/admin" onClick={handleNavigate}>
          <span className="font-display text-xl font-bold text-gold-gradient">
            Accelerate
          </span>
          <span className="block text-xs text-white-muted mt-0.5">
            Admin Panel
          </span>
        </Link>
        <NotificationBell />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto">
        {sidebarSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-white-muted uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={handleNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all relative",
                      active
                        ? "bg-gold-gradient text-black font-semibold"
                        : "text-white-secondary hover:text-white-primary hover:bg-white/5"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--gold-base)] rounded-r" />
                    )}
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border-glass pt-4 mt-4">
        <Link
          href="/"
          className="block text-xs text-white-muted hover:text-white-secondary transition-colors mb-3 px-3"
          onClick={handleNavigate}
        >
          View Site
        </Link>
        <button
          onClick={handleSignOutClick}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white-muted hover:text-white-primary hover:bg-white/5 transition-all cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );
}

// Enhanced Cmd+K Search with People
function CmdKSearch({
  open,
  onClose,
  query,
  onQueryChange,
  pageResults,
  peopleResults,
  searchingPeople,
  onSelectPage,
  onSelectPerson,
  inputRef,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  pageResults: typeof allLinks;
  peopleResults: SearchPerson[];
  searchingPeople: boolean;
  onSelectPage: (href: string) => void;
  onSelectPerson: (email: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, inputRef]);

  const totalItems = pageResults.length + peopleResults.length;

  const handleQueryInput = (value: string) => {
    setSelectedIdx(0);
    onQueryChange(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (selectedIdx < pageResults.length) {
        const page = pageResults[selectedIdx];
        if (page) onSelectPage(page.href);
      } else {
        const person = peopleResults[selectedIdx - pageResults.length];
        if (person) onSelectPerson(person.email);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md mx-4 glass-prominent rounded-xl overflow-clip shadow-2xl"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border-glass">
              <Search className="h-4 w-4 text-white-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search pages and people..."
                className="flex-1 bg-transparent text-sm text-white-primary placeholder:text-white-muted focus:outline-none"
              />
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] text-white-muted border border-border-glass rounded">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {/* Pages section */}
              {pageResults.length > 0 && (
                <>
                  <p className="px-4 py-1.5 text-[10px] uppercase font-semibold text-white-muted">Pages</p>
                  {pageResults.map((link, i) => (
                    <button
                      key={link.href}
                      onClick={() => onSelectPage(link.href)}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors cursor-pointer",
                        i === selectedIdx
                          ? "bg-white/10 text-white-primary"
                          : "text-white-secondary hover:bg-white/5"
                      )}
                    >
                      <link.icon className="h-4 w-4 shrink-0" />
                      {link.label}
                    </button>
                  ))}
                </>
              )}

              {/* People section */}
              {peopleResults.length > 0 && (
                <>
                  <p className="px-4 py-1.5 text-[10px] uppercase font-semibold text-white-muted mt-1">People</p>
                  {peopleResults.map((person, i) => {
                    const idx = pageResults.length + i;
                    return (
                      <button
                        key={person.email}
                        onClick={() => onSelectPerson(person.email)}
                        className={cn(
                          "flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors cursor-pointer",
                          idx === selectedIdx
                            ? "bg-white/10 text-white-primary"
                            : "text-white-secondary hover:bg-white/5"
                        )}
                      >
                        <User className="h-4 w-4 shrink-0" />
                        <div className="flex-1 text-left min-w-0">
                          <p className="truncate">{person.name}</p>
                          <p className="text-xs text-white-muted truncate">{person.email}</p>
                        </div>
                        <span className="text-[10px] text-white-muted shrink-0">{person.type}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {searchingPeople && (
                <p className="px-4 py-3 text-sm text-white-muted text-center">Searching...</p>
              )}

              {pageResults.length === 0 && peopleResults.length === 0 && !searchingPeople && query && (
                <p className="px-4 py-6 text-sm text-white-muted text-center">
                  No results found
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
