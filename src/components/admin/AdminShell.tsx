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
  MonitorPlay,
  MoreHorizontal,
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
import { adminMobileLinks, adminNavLinks, adminNavSections, resolveAdminNavLink, type AdminNavLink } from "@/lib/admin/navigation";
import { AdminDemoBoundary, AdminDemoControls } from "@/components/admin/AdminDemoBoundary";
import { DemoScenarioMark } from "@/components/admin/DemoScenarioMark";
import { DEMO_SCENARIOS, DEMO_SCENARIO_SHELL_NAMES, type DemoScenarioId } from "@/lib/admin/demo/scenarios";

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const crumbs = [{ label: "Today", href: "/admin/today" }];
  const active = resolveAdminNavLink(pathname);
  if (active && active.href !== "/admin/today") crumbs.push({ label: active.label, href: active.href });
  if (pathname.startsWith("/admin/contacts/") && pathname !== "/admin/contacts") {
    if (!crumbs.some((crumb) => crumb.href === "/admin/contacts")) {
      crumbs.push({ label: "Contacts", href: "/admin/contacts" });
    }
    crumbs.push({ label: "Timeline", href: pathname });
  }
  return crumbs;
}

function resolveAdminPathname(pathname: string, scenarioId: DemoScenarioId | null, demoRoute: string | null) {
  if (!scenarioId) return pathname;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return pathname;
  const publicPrefix = `/demo/command-center/${scenarioId}`;
  if (pathname === publicPrefix) return "/admin/today";
  if (pathname.startsWith(`${publicPrefix}/`)) return `/admin/${pathname.slice(publicPrefix.length + 1) || "today"}`;
  return `/admin/${demoRoute || "today"}`;
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

export default function AdminShell({
  children,
  demoScenarioId,
  demoRoute,
}: {
  children: React.ReactNode;
  demoScenarioId: DemoScenarioId | null;
  demoRoute: string | null;
}) {
  const pathname = usePathname();
  const scenarioId = demoScenarioId;
  // The server route is the hydration-safe fallback. After client navigation,
  // the persistent layout must follow the current public demo URL or its
  // breadcrumb and active navigation state remain stuck on the first route.
  const effectivePathname = resolveAdminPathname(pathname, scenarioId, demoRoute);
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
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocus = mobileMenuButtonRef.current;
    const focusTimer = window.setTimeout(() => mobileCloseButtonRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const drawer = mobileDrawerRef.current;
      if (!drawer) return;
      const focusable = [...drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !drawer.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !drawer.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => returnFocus?.focus());
    };
  }, [mobileOpen]);

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
      <aside inert={mobileOpen} className={cn("admin-sidebar hidden shrink-0 transition-[width] duration-300 lg:block", sidebarCollapsed ? "w-[80px]" : "w-[272px]")} data-admin-sidebar>
        <div className="sticky top-0 flex h-screen flex-col px-4 py-5">
          <SidebarContent idPrefix="admin-desktop" isActive={isActive} onSignOut={handleSignOut} collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} priorityCount={priorityCount} demoScenarioId={scenarioId} />
        </div>
      </aside>

      <header inert={mobileOpen} className="admin-mobile-header fixed inset-x-0 top-0 z-40 flex min-h-16 items-center justify-between gap-2 px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        {scenarioId ? (
          <Link href="/admin/today" className="admin-nav-brand flex min-w-0 items-center gap-2.5 font-semibold" aria-label={`${DEMO_SCENARIOS[scenarioId].name} demo home`}>
            <DemoScenarioMark scenarioId={scenarioId} className="size-8 shrink-0" />
            <span className="min-w-0"><span className="block max-w-40 truncate text-sm">{DEMO_SCENARIO_SHELL_NAMES[scenarioId]}</span><span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.13em] opacity-50">Demo</span></span>
          </Link>
        ) : (
          <Logo href="/admin/today" ariaLabel={`${tenant.brand.name} Revenue OS home`} size="sm" className="admin-nav-brand shrink-0" />
        )}
        <div className="flex items-center gap-1">
          <NotificationBell placement="mobile" />
          <button type="button" onClick={() => setSearchOpen(true)} className="admin-nav-control inline-flex size-11 items-center justify-center rounded-[10px] transition-[color,background-color,transform] duration-150 active:scale-[0.96]" aria-label="Open command palette">
            <Search className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button type="button" aria-label="Dismiss navigation" className="absolute inset-0 bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside ref={mobileDrawerRef} id="admin-mobile-navigation" role="dialog" aria-modal="true" aria-label="Admin navigation" className="admin-sidebar absolute inset-x-2 bottom-2 top-[max(3rem,env(safe-area-inset-top))] flex flex-col rounded-[26px] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_30px_90px_-28px_rgba(0,0,0,.78)]" initial={{ opacity: 0, y: 28, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.99 }} transition={{ type: "spring", duration: 0.34, bounce: 0 }}>
              <SidebarContent
                idPrefix="admin-mobile"
                isActive={isActive}
                onSignOut={handleSignOut}
                onNavigate={() => setMobileOpen(false)}
                onClose={() => setMobileOpen(false)}
                closeButtonRef={mobileCloseButtonRef}
                onOpenSearch={() => {
                  setMobileOpen(false);
                  window.setTimeout(() => setSearchOpen(true), 220);
                }}
                onOpenAI={() => {
                  setMobileOpen(false);
                  window.setTimeout(() => window.dispatchEvent(new CustomEvent("admin:open-ai")), 220);
                }}
                priorityCount={priorityCount}
                demoScenarioId={scenarioId}
              />
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

      <main inert={mobileOpen} className="admin-main min-w-0 flex-1 px-4 pb-[max(8rem,calc(7rem+env(safe-area-inset-bottom)))] pt-[calc(76px+env(safe-area-inset-top))] sm:px-6 lg:px-8 lg:pb-12 lg:pt-6 xl:px-10">
        <div className="admin-route-frame">
          <div className="mb-5 hidden min-h-10 items-center justify-between gap-4 sm:flex">
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

      <nav inert={mobileOpen} className="admin-mobile-dock fixed inset-x-3 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 items-stretch rounded-[24px] p-1.5 lg:hidden" aria-label="Primary navigation">
        {adminMobileLinks.map((link) => {
          const active = isActive(link.href);
          return <Link key={link.id} href={link.href} aria-current={active ? "page" : undefined} className={cn("admin-mobile-dock-item relative flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 text-[9px] font-semibold transition-[color,background-color,transform] duration-200 active:scale-[0.96]", active && "is-active")}>
            <link.icon className="size-[18px]" aria-hidden="true" />
            <span className="max-w-full truncate">{link.label}</span>
            {link.href === "/admin/today" && priorityCount > 0 && <span className="absolute right-[24%] top-1.5 size-2 rounded-full bg-rose-500 shadow-[0_0_0_2px_var(--admin-dock-bg)]" aria-label={`${priorityCount} urgent priorities`} />}
          </Link>;
        })}
        <button ref={mobileMenuButtonRef} type="button" onClick={() => setMobileOpen(true)} className={cn("admin-mobile-dock-item flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 text-[9px] font-semibold transition-[color,background-color,transform] duration-200 active:scale-[0.96]", !adminMobileLinks.some((link) => isActive(link.href)) && "is-active")} aria-label="Open More" aria-expanded={mobileOpen} aria-controls="admin-mobile-navigation">
          <MoreHorizontal className="size-[19px]" aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

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
  idPrefix,
  isActive,
  onSignOut,
  onNavigate,
  onClose,
  closeButtonRef,
  onOpenSearch,
  onOpenAI,
  collapsed = false,
  onToggleCollapse,
  priorityCount = 0,
  demoScenarioId = null,
}: {
  idPrefix: string;
  isActive: (href: string) => boolean;
  onSignOut: () => Promise<void> | void;
  onNavigate?: () => void;
  onClose?: () => void;
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  onOpenSearch?: () => void;
  onOpenAI?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  priorityCount?: number;
  demoScenarioId?: DemoScenarioId | null;
}) {
  const activeSection = adminNavSections.find((section) =>
    section.links.some((link) => isActive(link.href)),
  )?.label;
  const [sectionState, setSectionState] = useState({
    routeSection: activeSection,
    expanded: activeSection ? [activeSection] : [adminNavSections[0]!.label],
  });
  const expandedSections = sectionState.routeSection === activeSection
    ? sectionState.expanded
    : activeSection
      ? [activeSection]
      : sectionState.expanded;
  const demoScenario = demoScenarioId ? DEMO_SCENARIOS[demoScenarioId] : null;

  const toggleSection = (label: string) => {
    setSectionState({
      routeSection: activeSection,
      expanded: expandedSections.includes(label)
        ? expandedSections.filter((section) => section !== label)
        : [...expandedSections, label],
    });
  };

  return (
    <>
      <div className={cn("mb-5 flex shrink-0 items-center", collapsed ? "flex-col gap-1.5" : "justify-between gap-2 px-1")} data-admin-sidebar-header>
        {collapsed ? (
          <Link
            href="/admin/today"
            onClick={onNavigate}
            aria-label={demoScenario ? `${demoScenario.name} demo home` : `${tenant.brand.name} Revenue OS home`}
            className="admin-nav-brand admin-nav-control logo-link grid size-10 place-items-center rounded-[10px] transition-[background-color,transform] duration-150 active:scale-[0.96]"
          >
            {demoScenarioId ? <DemoScenarioMark scenarioId={demoScenarioId} className="size-8" /> : <LogoMark className="h-4 w-8" />}
          </Link>
        ) : demoScenarioId && demoScenario ? (
          <Link href="/admin/today" onClick={onNavigate} aria-label={`${demoScenario.name} demo home`} className="admin-nav-brand flex min-w-0 items-center gap-2.5 rounded-[10px] py-1 pr-1 transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.98]">
            <DemoScenarioMark scenarioId={demoScenarioId} className="size-9 shrink-0" />
            <span className="min-w-0"><span className="block truncate text-[13px] font-semibold leading-4">{DEMO_SCENARIO_SHELL_NAMES[demoScenarioId]}</span><span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.13em] opacity-50">Demo workspace</span></span>
          </Link>
        ) : (
          <Logo
            href="/admin/today"
            ariaLabel={`${tenant.brand.name} Revenue OS home`}
            onClick={onNavigate}
            size="sm"
            className="admin-nav-brand min-w-0 [&_.logo-word]:!text-[13px] [&_.logo-word]:tracking-[0.1em]"
          />
        )}
        <div className={cn("flex shrink-0 items-center", collapsed ? "flex-col gap-1" : "gap-0.5")} data-admin-sidebar-controls>
          {!onClose && <NotificationBell placement="sidebar" />}
          {onToggleCollapse && <button type="button" onClick={onToggleCollapse} className="admin-nav-control grid size-10 shrink-0 place-items-center rounded-[10px] transition-[background-color,color,transform] duration-150 active:scale-[0.96]" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen className="size-[17px]" /> : <PanelLeftClose className="size-[17px]" />}</button>}
          {onClose && <button ref={closeButtonRef} type="button" onClick={onClose} className="admin-nav-control grid size-11 shrink-0 place-items-center rounded-[11px] transition-[background-color,color,transform] duration-150 active:scale-[0.96]" aria-label="Close navigation"><X className="size-5" /></button>}
        </div>
      </div>

      {onClose && (
        <div className="mb-3 shrink-0">
          <div className="mb-3 flex items-end justify-between gap-4 px-1">
            <div>
              <p className="text-sm font-semibold text-[var(--admin-nav-ink)]">Full command center</p>
              <p className="mt-0.5 text-[10px] text-[var(--admin-nav-faint)]">Every workspace, record, and system tool</p>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--admin-nav-faint)]">{adminNavLinks.length} areas</span>
          </div>
          <div className="grid grid-cols-2 gap-2" aria-label="Workspace tools">
            <button type="button" onClick={onOpenSearch} className="admin-nav-utility inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] px-3 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]"><Search className="size-4" />Search</button>
            <button type="button" onClick={onOpenAI} className="admin-nav-utility inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] px-3 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]"><Bot className="size-4" />Ask AI</button>
          </div>
        </div>
      )}

      <nav className="admin-nav-scroll flex-1 space-y-2 overflow-y-auto overscroll-contain" aria-label="Admin navigation">
        {adminNavSections.map((section, sectionIndex) => (
          <motion.section key={section.label} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sectionIndex * 0.055, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            {(() => {
              const expanded = collapsed || expandedSections.includes(section.label);
              const panelId = `${idPrefix}-nav-${section.label.toLowerCase()}`;
              return <>
                {!collapsed ? <button
                  type="button"
                  onClick={() => toggleSection(section.label)}
                  className="admin-nav-section-button group flex min-h-11 w-full items-center justify-between rounded-[10px] px-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-[background-color,color,transform] duration-150 active:scale-[0.96]"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                >
                  <span className="flex items-center gap-2"><span className={cn("size-1.5 rounded-full bg-current transition-opacity duration-150", expanded ? "opacity-80" : "opacity-25")} aria-hidden="true" />{section.label}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-180")} />
                </button> : <div className="admin-nav-rule mx-2 my-2 h-px" aria-hidden="true" />}
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={panelId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pb-1.5 pt-0.5">
                        {section.links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link key={link.href} href={link.href} onClick={onNavigate} title={collapsed ? link.label : undefined} className={cn("admin-nav-link group relative flex min-h-10 items-center rounded-[10px] text-[13.5px] font-medium transition-[color,background-color,transform] duration-150 active:scale-[0.96]", collapsed ? "justify-center px-0" : "gap-3 px-2.5")} aria-current={active ? "page" : undefined}>
                    <link.icon className="h-4 w-4 shrink-0 transition-colors duration-150" />
                    {!collapsed && <span className="min-w-0 truncate">{link.label}</span>}
                    {link.href === "/admin/today" && priorityCount > 0 && (collapsed
                      ? <span className={cn("absolute right-2 top-2 size-2 rounded-full", active ? "bg-rose-600" : "bg-rose-400")} aria-label={`${priorityCount} urgent priorities`} />
                      : <span className={cn("ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center font-mono text-[9px] font-semibold tabular-nums", active ? "bg-black/8 text-black" : "bg-rose-500/18 text-rose-200")} aria-label={`${priorityCount} urgent priorities`}>{priorityCount > 99 ? "99+" : priorityCount}</span>)}
                    {active && <motion.span layoutId="admin-nav-active" className="admin-nav-active-indicator absolute inset-y-2 -left-4 w-0.5 rounded-r" transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} />}
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

      <div className="admin-nav-footer mt-3 shrink-0 border-t pt-3">
        {!collapsed && <p className="mb-1 px-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-[var(--admin-nav-faint)]">Workspace</p>}
        {!demoScenarioId && <Link href="/demo/command-center" target="_blank" onClick={onNavigate} aria-label="Open demo workspace" title={collapsed ? "Open demo workspace" : undefined} data-admin-demo-link className={cn("admin-nav-demo-link mb-1 flex min-h-10 items-center rounded-[10px] text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]", collapsed ? "justify-center" : "gap-3 px-2.5")}>
          <MonitorPlay className="h-4 w-4 shrink-0" /> {!collapsed && <><span>Demo workspace</span><ArrowUpRight className="ml-auto h-3.5 w-3.5 text-white/52" /></>}
        </Link>}
        <AdminAppearancePicker collapsed={collapsed} />
        {demoScenarioId && <div className="mt-1"><AdminDemoControls collapsed={collapsed} /></div>}
        {!demoScenarioId && <>
          <Link href="/" target="_blank" onClick={onNavigate} title={collapsed ? "View live site" : undefined} className={cn("admin-nav-utility flex min-h-10 items-center rounded-[10px] text-xs transition-[color,background-color,transform] duration-150 active:scale-[0.96]", collapsed ? "justify-center" : "gap-3 px-2.5")}>
            <ArrowUpRight className="h-4 w-4" /> {!collapsed && "View live site"}
          </Link>
          <button type="button" onClick={async () => { onNavigate?.(); await onSignOut(); }} title={collapsed ? "Sign out" : undefined} className={cn("admin-nav-utility flex min-h-10 w-full items-center rounded-[10px] text-xs transition-[color,background-color,transform] duration-150 active:scale-[0.96]", collapsed ? "justify-center" : "gap-3 px-2.5")}>
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
