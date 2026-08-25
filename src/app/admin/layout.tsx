"use client";

import { tenant } from "@/config/tenant";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowUpRight,
  Bot,
  ChevronDown,
  CheckSquare,
  Command,
  Download,
  LogOut,
  Mail,
  Menu,
  MonitorPlay,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { Toaster } from "@/components/admin/Toaster";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";
import { AdminShortcuts } from "@/components/admin/AdminShortcuts";
import { AdminCreateTaskModal } from "@/components/admin/AdminCreateTaskModal";
import { AdminFounderNoteModal } from "@/components/admin/AdminFounderNoteModal";
import { AdminAIProvider } from "@/components/admin/AdminAIProvider";
import { AdminAIPanel } from "@/components/admin/AdminAIPanel";
import { EmailComposeModal } from "@/components/admin/EmailComposeModal";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminAppearancePicker } from "@/components/admin/AdminAppearancePicker";
import { Logo } from "@/components/ui/Logo";
import { LogoMark } from "@/components/ui/LogoMark";
import { adminPageVariants } from "@/lib/admin/motion";
import { adminNavLinks, adminNavSections, type AdminNavLink } from "@/lib/admin/navigation";
import { AdminDemoBoundary } from "@/components/admin/AdminDemoBoundary";
import { isDemoScenarioId, type DemoScenarioId } from "@/lib/admin/demo/scenarios";

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const crumbs = [{ label: "Today", href: "/admin/today" }];
  const active = adminNavLinks.find(
    (link) => link.href !== "/admin/today" && pathname.startsWith(link.href),
  );
  if (active) crumbs.push({ label: active.label, href: active.href });
  if (pathname.startsWith("/admin/contacts/") && pathname !== "/admin/contacts") {
    if (!crumbs.some((crumb) => crumb.href === "/admin/contacts")) {
      crumbs.push({ label: "Contacts", href: "/admin/contacts" });
    }
    crumbs.push({ label: "Timeline", href: pathname });
  }
  return crumbs;
}

interface SearchPerson {
  name: string;
  email: string;
  type: string;
}

interface CommandAction {
  label: string;
  description: string;
  keywords: string;
  icon: LucideIcon;
  run: () => void;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const demoMatch = pathname.match(/^\/demo\/command-center\/([^/]+)(?:\/(.*))?$/);
  const scenarioId: DemoScenarioId | null = demoMatch && isDemoScenarioId(demoMatch[1] || "") ? demoMatch[1] as DemoScenarioId : null;
  const effectivePathname = scenarioId ? `/admin/${demoMatch?.[2] || "today"}` : pathname;
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPeople, setSearchPeople] = useState<SearchPerson[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState({ subject: "", body: "" });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [priorityCount, setPriorityCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchAbortRef = useRef<AbortController | null>(null);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchPeople([]);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((current) => !current);
        setSearchQuery("");
        setSearchPeople([]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const searchForPeople = useCallback(async (query: string) => {
    searchAbortRef.current?.abort();
    if (query.length < 3) {
      setSearchPeople([]);
      setSearchingPeople(false);
      return;
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearchingPeople(true);
    try {
      const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      const data = await response.json();
      setSearchPeople(data.results || []);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("[admin-search] failed:", error);
        setSearchPeople([]);
      }
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
        setSearchingPeople(false);
      }
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchForPeople(value), 260);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    searchAbortRef.current?.abort();
  }, []);

  useEffect(() => setMobileOpen(false), [effectivePathname]);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/admin/revenue-os/priority", { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { summary?: { urgent?: number } };
        if (!cancelled) setPriorityCount(Number(data.summary?.urgent || 0));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) console.error("[admin-priority-count]", error);
      }
    };
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    const onRefresh = () => void refresh();
    window.addEventListener("admin:priority-refresh", onRefresh);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("admin:priority-refresh", onRefresh);
    };
  }, []);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("accelerate:admin-sidebar") === "collapsed");
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("accelerate:admin-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  };

  useEffect(() => {
    const openComposer = (event: Event) => {
      const detail = (event as CustomEvent<{ subject?: string; body?: string }>).detail;
      setComposeDraft({ subject: detail?.subject || "", body: detail?.body || "" });
      setComposeOpen(true);
    };
    window.addEventListener("admin:compose-email", openComposer);
    return () => window.removeEventListener("admin:compose-email", openComposer);
  }, []);

  if (pathname === "/admin/login" || pathname === "/admin/update-password") {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace("/admin/login");
  };

  const isActive = (href: string) =>
    effectivePathname === href || (href !== "/admin" && effectivePathname.startsWith(href));

  const commandActions: CommandAction[] = [
    {
      label: "New lead",
      description: "Add an opportunity to the pipeline",
      keywords: "create add lead opportunity",
      icon: Plus,
      run: () => {
        router.push("/admin/pipeline");
      },
    },
    {
      label: "Compose email",
      description: "Write a direct follow-up",
      keywords: "send reply follow up message",
      icon: Mail,
      run: () => { setComposeDraft({ subject: "", body: "" }); setComposeOpen(true); },
    },
    {
      label: "Add task",
      description: "Put a follow-up in the operator queue",
      keywords: "create todo reminder follow up",
      icon: CheckSquare,
      run: () => window.dispatchEvent(new CustomEvent("admin:add-task")),
    },
    {
      label: "Capture note",
      description: "Add what you know to operating memory",
      keywords: "note remember decision context knowledge memory",
      icon: NotebookPen,
      run: () => window.dispatchEvent(new CustomEvent("admin:add-note")),
    },
    {
      label: "Export leads",
      description: "Download the current lead database",
      keywords: "csv download backup",
      icon: Download,
      run: () => window.open("/api/admin/leads/export", "_blank", "noopener,noreferrer"),
    },
    {
      label: "View live site",
      description: `Open ${tenant.brand.domain} in a new tab`,
      keywords: "website public open",
      icon: ArrowUpRight,
      run: () => window.open("/", "_blank", "noopener,noreferrer"),
    },
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredLinks = normalizedQuery
    ? adminNavLinks.filter((link) => `${link.label} ${link.description} ${link.keywords || ""}`.toLowerCase().includes(normalizedQuery))
    : adminNavLinks.slice(0, 7);
  const filteredActions = normalizedQuery
    ? commandActions.filter((action) =>
        `${action.label} ${action.description} ${action.keywords}`.toLowerCase().includes(normalizedQuery),
      )
    : commandActions;
  const breadcrumbs = getBreadcrumbs(effectivePathname);

  return (
    <AdminDemoBoundary scenarioId={scenarioId}>
    <AdminAIProvider>
    <MotionConfig reducedMotion="user">
    <div className="admin-shell flex min-h-screen">
      <aside className={cn("admin-sidebar hidden shrink-0 transition-[width] duration-300 lg:block", sidebarCollapsed ? "w-[80px]" : "w-[272px]")} data-admin-sidebar>
        <div className="sticky top-0 flex h-screen flex-col px-4 py-5">
          <SidebarContent isActive={isActive} onSignOut={handleSignOut} collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} priorityCount={priorityCount} demoMode={Boolean(scenarioId)} />
        </div>
      </aside>

      <header className="admin-mobile-header fixed inset-x-0 top-0 z-40 flex min-h-16 items-center justify-between gap-2 px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        <Logo
          href="/admin/today"
          ariaLabel={`${tenant.brand.name} Revenue OS home`}
          size="sm"
          className="shrink-0 [--gold-base:#fff] [--heading-color:#fff]"
        />
        <div className="flex items-center gap-1">
          <NotificationBell placement="mobile" />
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("admin:open-ai"))} className="inline-flex size-11 items-center justify-center rounded-[10px] text-white/60 transition-[color,background-color,transform] duration-150 hover:bg-white/8 hover:text-white active:scale-[0.96]" aria-label="Open AI command center"><Bot className="size-4" /></button>
          <button type="button" onClick={() => setSearchOpen(true)} className="inline-flex size-11 items-center justify-center rounded-[10px] text-white/60 transition-[color,background-color,transform] duration-150 hover:bg-white/8 hover:text-white active:scale-[0.96]" aria-label="Open command palette">
            <Search className="h-4.5 w-4.5" />
          </button>
          <button type="button" onClick={() => setMobileOpen((current) => !current)} className="inline-flex size-11 items-center justify-center rounded-[10px] text-white/75 transition-[color,background-color,transform] duration-150 hover:bg-white/8 hover:text-white active:scale-[0.96]" aria-label={mobileOpen ? "Navigation open" : "Open navigation"} aria-expanded={mobileOpen}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={mobileOpen ? "close" : "menu"}
                initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button type="button" aria-label="Dismiss navigation" className="absolute inset-0 bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.button
              type="button"
              aria-label="Close navigation"
              className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 grid size-11 place-items-center rounded-full bg-white text-black shadow-[0_8px_30px_rgba(0,0,0,0.28)] transition-transform active:scale-[0.96]"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-5" />
            </motion.button>
            <motion.aside className="admin-sidebar absolute inset-y-0 left-0 flex w-[286px] flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]" initial={{ x: -286 }} animate={{ x: 0 }} exit={{ x: -286 }} transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}>
              <SidebarContent isActive={isActive} onSignOut={handleSignOut} onNavigate={() => setMobileOpen(false)} priorityCount={priorityCount} demoMode={Boolean(scenarioId)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <CmdKSearch
        open={searchOpen}
        onClose={closeSearch}
        query={searchQuery}
        onQueryChange={handleSearchChange}
        actions={filteredActions}
        pageResults={filteredLinks}
        peopleResults={searchPeople}
        searchingPeople={searchingPeople}
        onSelectPage={(href) => { router.push(href); closeSearch(); }}
        onSelectPerson={(email) => { router.push(`/admin/contacts/${encodeURIComponent(email)}`); closeSearch(); }}
        onSelectAction={(action) => {
          closeSearch();
          // Let the command surface finish leaving before opening another
          // modal or route. Overlapping focus traps and backdrops make a fast
          // command feel like two stacked applications.
          window.setTimeout(action.run, 260);
        }}
        inputRef={searchInputRef}
      />

      <main className={cn("admin-main min-w-0 flex-1 px-4 pt-[calc(76px+env(safe-area-inset-top))] sm:px-6 lg:px-8 lg:pt-6 xl:px-10", scenarioId ? "pb-[calc(8rem+env(safe-area-inset-bottom))] sm:pb-12" : "pb-[max(3rem,calc(3rem+env(safe-area-inset-bottom)))] lg:pb-12")}>
        <div className="admin-route-frame">
          <div className="mb-5 flex min-h-10 items-center justify-between gap-4">
            <nav className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--admin-muted)]" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 && <span className="opacity-45">/</span>}
                  <Link href={crumb.href} className={cn("truncate transition-colors duration-150 hover:text-[var(--admin-ink)]", index === breadcrumbs.length - 1 && "text-[var(--admin-ink)]")} aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>
                    {crumb.label}
                  </Link>
                </span>
              ))}
            </nav>
            <div className="hidden items-center gap-2 sm:flex"><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("admin:open-ai"))} className="inline-flex min-h-10 items-center gap-2 rounded-[11px] bg-[var(--admin-surface)] px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow)] transition-[box-shadow,transform] hover:shadow-[var(--admin-shadow-hover)] active:scale-[0.96]"><Bot className="size-3.5" />Ask AI<kbd className="ml-1 rounded-md bg-[var(--admin-surface-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-muted)]">⌘J</kbd></button><button type="button" onClick={() => setSearchOpen(true)} className="inline-flex min-h-10 items-center gap-3 rounded-[11px] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-muted)] shadow-[var(--admin-shadow)] transition-[box-shadow,color,transform] duration-150 hover:text-[var(--admin-ink)] hover:shadow-[var(--admin-shadow-hover)] active:scale-[0.96]"><Search className="h-3.5 w-3.5" />Search<kbd className="ml-1 rounded-md bg-[var(--admin-surface-subtle)] px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd></button></div>
          </div>

          {/* New route content enters immediately. Waiting for an exiting tree
              leaves the operating surface blank and makes navigation feel like
              a reload; the surrounding shell intentionally remains mounted. */}
          <motion.div key={effectivePathname} variants={adminPageVariants} initial="hidden" animate="visible">
            <AdminErrorBoundary key={effectivePathname}>{children}</AdminErrorBoundary>
          </motion.div>
        </div>
      </main>

      <EmailComposeModal isOpen={composeOpen} onClose={() => setComposeOpen(false)} recipientEmail="" initialSubject={composeDraft.subject} initialBody={composeDraft.body} />
      <AdminCreateTaskModal />
      <AdminFounderNoteModal />
      <AdminAIPanel />
      <Toaster />
      <AdminShortcuts />
    </div>
    </MotionConfig>
    </AdminAIProvider>
    </AdminDemoBoundary>
  );
}

function SidebarContent({
  isActive,
  onSignOut,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  priorityCount = 0,
  demoMode = false,
}: {
  isActive: (href: string) => boolean;
  onSignOut: () => Promise<void> | void;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  priorityCount?: number;
  demoMode?: boolean;
}) {
  const activeSection = adminNavSections.find((section) =>
    section.links.some((link) => isActive(link.href)),
  )?.label;
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const toggleSection = (label: string) => {
    setExpandedSections((current) =>
      current.includes(label)
        ? current.filter((section) => section !== label)
        : [...current, label],
    );
  };

  return (
    <>
      <div className={cn("mb-6", collapsed ? "flex flex-col items-center gap-2 px-0" : "px-1")}>
        {collapsed ? (
          <Link
            href="/admin/today"
            onClick={onNavigate}
            aria-label={`${tenant.brand.name} Revenue OS home`}
            className="logo-link grid size-10 place-items-center rounded-[10px] [--gold-base:#fff] transition-[background-color,transform] duration-150 hover:bg-white/7 active:scale-[0.96]"
          >
            <LogoMark className="h-4 w-8" />
          </Link>
        ) : (
          <Logo
            href="/admin/today"
            ariaLabel={`${tenant.brand.name} Revenue OS home`}
            onClick={onNavigate}
            size="sm"
            className="[--gold-base:#fff] [--heading-color:#fff]"
          />
        )}
        <div className={cn("flex shrink-0", collapsed ? "flex-col items-center gap-1" : "mt-3 items-center justify-end gap-0.5")} data-admin-sidebar-controls>
          {!collapsed && <NotificationBell placement="sidebar" />}
          {onToggleCollapse && <button type="button" onClick={onToggleCollapse} className="grid size-10 shrink-0 place-items-center rounded-[10px] text-white/58 transition-[background-color,color,transform] duration-150 hover:bg-white/8 hover:text-white active:scale-[0.96]" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen className="size-[17px]" /> : <PanelLeftClose className="size-[17px]" />}</button>}
        </div>
      </div>

      <nav className="admin-nav-scroll flex-1 space-y-1.5 overflow-y-auto overscroll-contain" aria-label="Admin navigation">
        {adminNavSections.map((section, sectionIndex) => (
          <motion.section key={section.label} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sectionIndex * 0.055, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            {(() => {
              const expanded = collapsed || section.label === activeSection || expandedSections.includes(section.label);
              const panelId = `admin-nav-${section.label.toLowerCase()}`;
              return <>
                {!collapsed ? <button
                  type="button"
                  onClick={() => toggleSection(section.label)}
                  className="group flex min-h-10 w-full items-center justify-between rounded-[10px] px-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-white/55 transition-[background-color,color,transform] duration-150 hover:bg-white/[0.055] hover:text-white/82 active:scale-[0.96]"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                >
                  <span>{section.label}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-180")} />
                </button> : <div className="mx-2 my-2 h-px bg-white/8" aria-hidden="true" />}
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={panelId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pb-1">
                        {section.links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link key={link.href} href={link.href} onClick={onNavigate} title={collapsed ? link.label : undefined} className={cn("group relative flex min-h-10 items-center rounded-[10px] text-[13.5px] font-medium transition-[color,background-color,transform] duration-150 active:scale-[0.96]", collapsed ? "justify-center px-0" : "gap-3 px-2.5", active ? "bg-white text-black shadow-[0_1px_2px_rgba(0,0,0,0.18)]" : "text-white/72 hover:bg-white/7 hover:text-white")} aria-current={active ? "page" : undefined}>
                    <link.icon className={cn("h-4 w-4 shrink-0 transition-colors duration-150", active ? "text-black" : "text-white/52 group-hover:text-white/85")} />
                    {!collapsed && <span className="min-w-0 truncate">{link.label}</span>}
                    {link.href === "/admin/today" && priorityCount > 0 && (collapsed
                      ? <span className={cn("absolute right-2 top-2 size-2 rounded-full", active ? "bg-rose-600" : "bg-rose-400")} aria-label={`${priorityCount} urgent priorities`} />
                      : <span className={cn("ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center font-mono text-[9px] font-semibold tabular-nums", active ? "bg-black/8 text-black" : "bg-rose-500/18 text-rose-200")} aria-label={`${priorityCount} urgent priorities`}>{priorityCount > 99 ? "99+" : priorityCount}</span>)}
                    {active && <motion.span layoutId="admin-nav-active" className="absolute inset-y-2 -left-4 w-0.5 rounded-r bg-white" transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} />}
                  </Link>
                );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>;
            })()}
          </motion.section>
        ))}
      </nav>

      <div className="mt-4 border-t border-white/10 pt-3">
        <Link href="/demo/command-center" target="_blank" onClick={onNavigate} aria-label={demoMode ? "Choose another fictional workspace" : "Open demo workspace"} title={collapsed ? (demoMode ? "Choose demo" : "Open demo workspace") : undefined} data-admin-demo-link className={cn("mb-1 flex min-h-10 items-center rounded-[10px] bg-white/[0.075] text-xs font-semibold text-white/82 shadow-[0_0_0_1px_rgba(255,255,255,.08)] transition-[background-color,color,transform] duration-150 hover:bg-white/[0.12] hover:text-white active:scale-[0.96]", collapsed ? "justify-center" : "gap-3 px-2.5")}>
          <MonitorPlay className="h-4 w-4 shrink-0" /> {!collapsed && <><span>{demoMode ? "Choose demo" : "Demo workspace"}</span><ArrowUpRight className="ml-auto h-3.5 w-3.5 text-white/52" /></>}
        </Link>
        <AdminAppearancePicker collapsed={collapsed} />
        {!demoMode && <>
          <Link href="/" target="_blank" onClick={onNavigate} title={collapsed ? "View live site" : undefined} className={cn("flex min-h-10 items-center rounded-[10px] text-xs text-white/58 transition-[color,background-color,transform] duration-150 hover:bg-white/7 hover:text-white active:scale-[0.96]", collapsed ? "justify-center" : "gap-3 px-2.5")}>
            <ArrowUpRight className="h-4 w-4" /> {!collapsed && "View live site"}
          </Link>
          <button type="button" onClick={async () => { onNavigate?.(); await onSignOut(); }} title={collapsed ? "Sign out" : undefined} className={cn("flex min-h-10 w-full items-center rounded-[10px] text-xs text-white/58 transition-[color,background-color,transform] duration-150 hover:bg-white/7 hover:text-white active:scale-[0.96]", collapsed ? "justify-center" : "gap-3 px-2.5")}>
            <LogOut className="h-4 w-4" /> {!collapsed && "Sign out"}
          </button>
        </>}
      </div>
    </>
  );
}

function CmdKSearch({
  open,
  onClose,
  query,
  onQueryChange,
  actions,
  pageResults,
  peopleResults,
  searchingPeople,
  onSelectPage,
  onSelectPerson,
  onSelectAction,
  inputRef,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  actions: CommandAction[];
  pageResults: AdminNavLink[];
  peopleResults: SearchPerson[];
  searchingPeople: boolean;
  onSelectPage: (href: string) => void;
  onSelectPerson: (email: string) => void;
  onSelectAction: (action: CommandAction) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const items = useMemo(() => [
    ...actions.map((action) => ({ kind: "action" as const, action })),
    ...pageResults.map((page) => ({ kind: "page" as const, page })),
    ...peopleResults.map((person) => ({ kind: "person" as const, person })),
  ], [actions, pageResults, peopleResults]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setSelectedIndex(0);
      inputRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [open, inputRef]);

  const select = (index: number) => {
    const item = items[index];
    if (!item) return;
    if (item.kind === "action") onSelectAction(item.action);
    if (item.kind === "page") onSelectPage(item.page.href);
    if (item.kind === "person") onSelectPerson(item.person.email);
  };

  return (
    <AdminDialog open={open} onClose={onClose} title="Admin command palette" ariaLabel="Admin command palette" align="top" maxWidth="lg">
          <div className="relative w-full max-w-xl overflow-hidden rounded-[18px] bg-[#fbfbfa] text-[#0b0b0b] shadow-[0_30px_90px_-25px_rgba(0,0,0,0.58)]">
            <div className="flex min-h-14 items-center gap-3 border-b border-black/8 px-4">
              <Search className="h-4 w-4 shrink-0 text-black/38" />
              <input ref={inputRef} value={query} onChange={(event) => { setSelectedIndex(0); onQueryChange(event.target.value); }} onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); setSelectedIndex((current) => Math.min(current + 1, Math.max(0, items.length - 1))); }
                if (event.key === "ArrowUp") { event.preventDefault(); setSelectedIndex((current) => Math.max(current - 1, 0)); }
                if (event.key === "Enter") { event.preventDefault(); select(selectedIndex); }
                if (event.key === "Escape") onClose();
              }} placeholder="Search people, pages, or run a command…" className="min-w-0 flex-1 bg-transparent text-sm text-black outline-none placeholder:text-black/35" />
              <kbd className="rounded-md bg-black/5 px-1.5 py-1 font-mono text-[9px] text-black/42">ESC</kbd>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-2">
              {actions.length > 0 && <ResultSection label="Actions">
                {actions.map((action, index) => <CommandRow key={action.label} icon={action.icon} label={action.label} description={action.description} selected={selectedIndex === index} onClick={() => onSelectAction(action)} />)}
              </ResultSection>}
              {pageResults.length > 0 && <ResultSection label="Pages">
                {pageResults.map((page, index) => {
                  const itemIndex = actions.length + index;
                  return <CommandRow key={page.href} icon={page.icon} label={page.label} description={page.description} selected={selectedIndex === itemIndex} onClick={() => onSelectPage(page.href)} />;
                })}
              </ResultSection>}
              {peopleResults.length > 0 && <ResultSection label="People">
                {peopleResults.map((person, index) => {
                  const itemIndex = actions.length + pageResults.length + index;
                  return <CommandRow key={person.email} icon={User} label={person.name} description={`${person.email} · ${person.type}`} selected={selectedIndex === itemIndex} onClick={() => onSelectPerson(person.email)} />;
                })}
              </ResultSection>}
              {searchingPeople && <p className="px-3 py-4 text-center text-xs text-black/45">Searching records…</p>}
              {!searchingPeople && items.length === 0 && query && <p className="px-3 py-8 text-center text-sm text-black/45">No matching people, pages, or commands.</p>}
            </div>
            <div className="flex items-center justify-between border-t border-black/8 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.08em] text-black/35">
              <span className="flex items-center gap-1.5"><Command className="h-3 w-3" /> Command Center</span>
              <span>↑↓ navigate · ↵ open</span>
            </div>
          </div>
    </AdminDialog>
  );
}

function ResultSection({ label, children }: { label: string; children: React.ReactNode }) {
  return <section className="mb-2 last:mb-0"><p className="px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-black/35">{label}</p>{children}</section>;
}

function CommandRow({ icon: Icon, label, description, selected, onClick }: { icon: LucideIcon; label: string; description: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick} className={cn("flex min-h-12 w-full items-center gap-3 rounded-[11px] px-3 text-left transition-[background-color,color] duration-100", selected ? "bg-black text-white" : "text-black hover:bg-black/5")}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]", selected ? "bg-white/12 text-white" : "bg-black/5 text-black/55")}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{label}</span><span className={cn("block truncate text-[11px]", selected ? "text-white/55" : "text-black/42")}>{description}</span></span>
      <span className={cn("font-mono text-[10px]", selected ? "text-white/45" : "text-black/25")}>↵</span>
    </button>
  );
}
