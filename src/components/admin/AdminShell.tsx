"use client";

import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import { siteUrl, tenant } from "@/config/tenant";
import { fetchJson } from "@/lib/admin/fetchJson";
import {
  parseSearchResponse,
  searchRecordGroups,
  type SearchRecord,
} from "@/lib/admin/workspace-search";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link, { useAdminNavigation } from "@/components/admin/AdminLink";
import { usePathname, useSearchParams } from "next/navigation";
import { resolveAdminPathname } from "@/lib/admin/navigation-paths";
import { AdminConfirmationProvider } from "@/components/admin/AdminConfirmationProvider";
import { AdminThemeProvider } from "@/components/admin/AdminThemeProvider";
import type { AdminThemeDefinition } from "@/lib/admin/theme-definition";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Bot,
  ChevronDown,
  CheckSquare,
  Command,
  Download,
  LifeBuoy,
  LogOut,
  Mail,
  MessageSquareText,
  MonitorPlay,
  MoreHorizontal,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  Search,
  Settings,
  User,
  UsersRound,
  LayoutDashboard,
  ListChecks,
  PlugZap,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { Toaster } from "@/components/admin/Toaster";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";
import { ModuleDisabledNotice } from "@/components/admin/ModuleDisabledNotice";
import { AdminShortcuts } from "@/components/admin/AdminShortcuts";
import { AdminCreateTaskModal } from "@/components/admin/AdminCreateTaskModal";
import { AdminFounderNoteModal } from "@/components/admin/AdminFounderNoteModal";
import { AdminAIProvider } from "@/components/admin/AdminAIProvider";
import { AdminQueryProvider } from "@/components/admin/AdminQueryProvider";
import { AdminAIPanel } from "@/components/admin/AdminAIPanel";
import { EmailComposeModal } from "@/components/admin/EmailComposeModal";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminRouteStage } from "@/components/admin/AdminRouteStage";
import { AdminAppearancePicker } from "@/components/admin/AdminAppearancePicker";
import { Logo } from "@/components/ui/Logo";
import { LogoMark } from "@/components/ui/LogoMark";
import { useNavigationRuntime } from "@/components/navigation/NavigationRuntime";
import {
  adminMobileLinks,
  adminNavSections,
  applyNavLayoutOverride,
  filterNavSectionsByTenant,
  resolveAdminNavLink,
  searchAdminNavLinks,
  type AdminNavLink,
  type AdminNavSection,
} from "@/lib/admin/navigation";
import type { LayoutDoc } from "@/lib/admin/layout-overrides";
import { getAdminBreadcrumbs } from "@/lib/admin/breadcrumbs";
import { AdminDemoControls } from "@/components/admin/AdminDemoBoundary";
import { DemoScenarioMark } from "@/components/admin/DemoScenarioMark";
import { clearOfflineWorkspace } from "@/lib/admin/offline-store";
import { isModuleEnabled, SELF_LOCKOUT_EXEMPT_MODULES } from "@/lib/revenue-os/modules";
import { isModuleHistoryPath, resolveModuleForAdminPath } from "@/lib/revenue-os/module-routes";
import { CommandCenterPwa } from "@/components/admin/CommandCenterPwa";
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_SHELL_NAMES,
  isDemoScenarioId,
  type DemoScenarioId,
} from "@/lib/admin/demo/scenarios";

function resolveAdminPageTitle(pathname: string) {
  if (pathname.startsWith("/admin/contacts/") && pathname !== "/admin/contacts")
    return "Contact timeline";
  if (pathname.startsWith("/admin/pipeline/") && pathname !== "/admin/pipeline")
    return "Opportunity";
  return resolveAdminNavLink(pathname)?.label || "Command Center";
}

interface CommandAction {
  label: string;
  description: string;
  keywords: string;
  icon: LucideIcon;
  run: () => void;
}

interface WorkspaceOption {
  id: string;
  slug: string;
  name: string;
  status: string;
}

const mobilePrimaryLinks = adminMobileLinks.filter((link) =>
  ["today", "work", "contacts"].includes(link.id),
);
const primaryRecordLinks = new Set(["pipeline", "clients", "proposals"]);

const sidebarGroups: Array<{
  id: string;
  label: string;
  primaryId: string;
  icon: LucideIcon;
  members: string[];
}> = [
  {
    id: "today",
    label: "Today",
    primaryId: "today",
    icon: LayoutDashboard,
    members: ["today", "analytics", "activity", "opportunity-radar"],
  },
  {
    id: "work",
    label: "Work",
    primaryId: "work",
    icon: ListChecks,
    members: ["work", "inbox", "bookings"],
  },
  {
    id: "records",
    label: "Records",
    primaryId: "contacts",
    icon: UsersRound,
    members: [
      "contacts",
      "pipeline",
      "clients",
      "proposals",
      "revenue",
      "recovery",
      "leads",
      "chat-leads",
      "subscribers",
      "partners",
      "website-grades",
      "identity-review",
      "stripe-subscriptions",
      "receivables-collections",
    ],
  },
  {
    id: "invoices",
    label: "Invoices",
    primaryId: "stripe-invoicing",
    icon: ReceiptText,
    members: ["stripe-invoicing"],
  },
  {
    id: "conversations",
    label: "Conversations",
    primaryId: "conversations",
    icon: MessageSquareText,
    members: ["conversations", "emails", "campaigns", "delivery-runs"],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    primaryId: "learning",
    icon: BookOpen,
    members: ["learning", "blueprints", "architect", "resources", "content"],
  },
  {
    id: "coworkers",
    label: "Coworkers",
    primaryId: "coworkers",
    icon: Bot,
    members: ["coworkers", "ai"],
  },
  {
    id: "apps",
    label: "Apps",
    primaryId: "integrations",
    icon: PlugZap,
    members: ["integrations"],
  },
  {
    id: "settings",
    label: "Settings",
    primaryId: "settings",
    icon: Settings,
    members: ["settings", "branding", "tenants", "setup", "get-started", "features"],
  },
];

function groupSidebarLinks(sections: AdminNavSection[]) {
  const links = sections.flatMap((section) => section.links);
  const assigned = new Set(sidebarGroups.flatMap((group) => group.members));
  return sidebarGroups
    .map((group) => {
      const members = links.filter(
        (link) =>
          group.members.includes(link.id) || (group.id === "apps" && !assigned.has(link.id)),
      );
      const primary = members.find((link) => link.id === group.primaryId) ?? members[0];
      return { ...group, primary, links: members.filter((link) => link.id !== primary?.id) };
    })
    .filter((group) => group.primary);
}

export default function AdminShell({
  children,
  demoScenarioId,
  demoRoute,
  workspaceSlug,
  userId,
  workspaceName,
  isPlatformAdmin,
  workspaceTheme = null,
  navLayoutOverride = null,
  moduleConfig = null,
}: {
  children: React.ReactNode;
  demoScenarioId: DemoScenarioId | null;
  demoRoute: string | null;
  workspaceSlug: string;
  userId: string;
  workspaceName: string;
  isPlatformAdmin: boolean;
  workspaceTheme?: AdminThemeDefinition | null;
  navLayoutOverride?: LayoutDoc | null;
  /** Request-scoped module configuration. Demo configuration comes from its
   * browser-local runtime; otherwise unavailable configuration uses bundled defaults. */
  moduleConfig?: { modules?: Partial<Record<string, boolean>> } | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathnameScenario = pathname.match(/^\/demo\/command-center\/([^/]+)/)?.[1] || "";
  const scenarioId = isDemoScenarioId(pathnameScenario) ? pathnameScenario : demoScenarioId;
  // The server route is the hydration-safe fallback. After client navigation,
  // the persistent layout must follow the current public demo URL or its
  // breadcrumb and active navigation state remain stuck on the first route.
  const effectivePathname = resolveAdminPathname(pathname, scenarioId, demoRoute);
  const identityHref = `${effectivePathname}?${searchParams.toString()}`;
  const demo = useAdminDemo();
  const effectiveModuleConfig = demo?.moduleConfig ?? moduleConfig;
  const owningModule = resolveModuleForAdminPath(effectivePathname);
  const moduleDisabled =
    effectiveModuleConfig &&
    owningModule &&
    !isModuleHistoryPath(owningModule, effectivePathname) &&
    !SELF_LOCKOUT_EXEMPT_MODULES.has(owningModule.id) &&
    !isModuleEnabled(owningModule.id, effectiveModuleConfig);
  const invoicingEnabled = isModuleEnabled("stripe-invoicing", effectiveModuleConfig ?? tenant);
  const visibleNavSections = useMemo(() => {
    const roleFiltered = adminNavSections
      .map((section) => ({
        ...section,
        links: section.links.filter(
          (link) =>
            isPlatformAdmin ||
            (scenarioId && link.id === "features") ||
            !["features", "tenants", "setup"].includes(link.id),
        ),
      }))
      .filter((section) => section.links.length > 0);
    const moduleFiltered = filterNavSectionsByTenant(roleFiltered, effectiveModuleConfig ?? tenant);
    return applyNavLayoutOverride(moduleFiltered, navLayoutOverride);
  }, [isPlatformAdmin, scenarioId, navLayoutOverride, effectiveModuleConfig]);
  const visibleNavLinks = useMemo(
    () => visibleNavSections.flatMap((section) => section.links),
    [visibleNavSections],
  );
  const routeKey = `${scenarioId || "live"}:${effectivePathname}`;
  const router = useAdminNavigation();
  const { pendingHref, registerAdminScroller } = useNavigationRuntime();
  const isAuthRoute = pathname === "/admin/login" || pathname === "/admin/update-password";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRecords, setSearchRecords] = useState<SearchRecord[]>([]);
  const [searchingRecords, setSearchingRecords] = useState(false);
  const [recordSearchError, setRecordSearchError] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState({ subject: "", body: "" });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [priorityCount, setPriorityCount] = useState(0);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const mainNode = mainRef.current;
    const previousMainOverflow = mainNode?.style.overflowY || "";
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
      const focusable = [
        ...drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.getClientRects().length > 0);
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
    document.body.classList.add("admin-mobile-nav-open");
    if (mainNode) mainNode.style.overflowY = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("admin-mobile-nav-open");
      if (mainNode) mainNode.style.overflowY = previousMainOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => returnFocus?.focus());
    };
  }, [mobileOpen]);

  useEffect(() => {
    document.documentElement.classList.add("admin-app-open");
    document.body.classList.add("admin-app-open");
    return () => {
      document.documentElement.classList.remove("admin-app-open");
      document.body.classList.remove("admin-app-open");
    };
  }, []);

  useLayoutEffect(() => {
    let frame = 0;
    let timer = 0;
    const applyTitle = () => {
      const renderedHeading = mainRef.current
        ?.querySelector("h1")
        ?.textContent?.replace(/\s+/g, " ")
        .trim();
      const pageTitle = renderedHeading || resolveAdminPageTitle(identityHref);
      const expectedTitle = scenarioId
        ? `${pageTitle} | ${DEMO_SCENARIOS[scenarioId].name} Demo`
        : `${pageTitle} | ${tenant.brand.name} Admin`;
      if (document.title !== expectedTitle) document.title = expectedTitle;
    };
    const titleObserver = new MutationObserver(applyTitle);
    const observerOptions = { childList: true, subtree: true, characterData: true };
    titleObserver.observe(document.head, observerOptions);
    // Several admin routes replace their server fallback heading after client
    // data resolves. Keep the document title bound to that visible heading
    // instead of relying on a timing guess that can miss fast or slow loads.
    if (mainRef.current) titleObserver.observe(mainRef.current, observerOptions);
    applyTitle();
    frame = window.requestAnimationFrame(applyTitle);
    timer = window.setTimeout(applyTitle, 100);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      titleObserver.disconnect();
    };
  }, [effectivePathname, identityHref, scenarioId]);

  const resetSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    setSearchQuery("");
    setSearchRecords([]);
    setRecordSearchError("");
    setSearchingRecords(false);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    resetSearch();
  }, [resetSearch]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((current) => !current);
        resetSearch();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "m") {
        const target = event.target as HTMLElement | null;
        if (
          target?.matches("input, textarea, [contenteditable='true']") ||
          document.querySelector('[role="dialog"]')
        )
          return;
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent("admin:add-note", { detail: { captureSource: "keyboard_shortcut" } }),
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [resetSearch]);

  const searchForRecords = useCallback(async (query: string) => {
    searchAbortRef.current?.abort();
    if (query.length < 3) {
      setSearchRecords([]);
      setSearchingRecords(false);
      setRecordSearchError("");
      return;
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearchingRecords(true);
    setRecordSearchError("");
    try {
      const data = await fetchJson<Parameters<typeof parseSearchResponse>[0]>(
        `/api/admin/search?q=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || searchAbortRef.current !== controller) return;
      setSearchRecords(parseSearchResponse(data));
    } catch {
      if (!controller.signal.aborted && searchAbortRef.current === controller)
        setRecordSearchError("Workspace search couldn’t load. Try again.");
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
        setSearchingRecords(false);
      }
    }
  }, []);

  const handleSearchChange = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    setSearchQuery(value);
    setSearchRecords([]);
    setRecordSearchError("");
    setSearchingRecords(value.trim().length >= 3);
    debounceRef.current = setTimeout(() => searchForRecords(value.trim()), 120);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      searchAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => setMobileOpen(false), [effectivePathname]);

  useEffect(() => {
    if (scenarioId || isAuthRoute) return;
    const controller = new AbortController();
    const onPageHide = () => controller.abort();
    window.addEventListener("pagehide", onPageHide);
    void fetch("/api/admin/tenants", { signal: controller.signal })
      .then(async (response) =>
        response.ok ? response.json() : Promise.reject(new Error("Workspace list unavailable")),
      )
      .then((payload: { tenants?: WorkspaceOption[] }) => {
        setWorkspaces((payload.tenants || []).filter((workspace) => workspace.status === "active"));
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          console.error("[tenant-workspaces] could not load workspace list", error);
      });
    return () => {
      controller.abort();
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [scenarioId, workspaceSlug, isAuthRoute]);

  const switchWorkspace = useCallback(
    (slug: string) => {
      if (!slug || slug === workspaceSlug) return;
      const suffix = effectivePathname.replace(/^\/admin\/?/, "") || "today";
      // A full navigation resets every tenant-scoped client cache and context
      // provider; a client-side route push could carry state across the tenant
      // boundary this switch is crossing.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/t/${slug}/admin/${suffix}`);
    },
    [effectivePathname, workspaceSlug],
  );

  useLayoutEffect(() => {
    registerAdminScroller(mainRef.current);
    return () => registerAdminScroller(null);
  }, [registerAdminScroller]);

  useEffect(() => {
    if (isAuthRoute) return;
    let cancelled = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/admin/revenue-os/priority", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { summary?: { urgent?: number } };
        if (!cancelled) setPriorityCount(Number(data.summary?.urgent || 0));
      } catch (error) {
        // Chromium can surface an aborted navigation fetch as TypeError rather
        // than AbortError. The controller is the authoritative lifecycle signal.
        if (!cancelled && !controller?.signal.aborted)
          console.error("[admin-priority-count]", error);
      }
    };
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    const onRefresh = () => void refresh();
    const onPageHide = () => {
      cancelled = true;
      controller?.abort();
    };
    window.addEventListener("admin:priority-refresh", onRefresh);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("admin:priority-refresh", onRefresh);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [isAuthRoute]);

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

  if (isAuthRoute) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  const handleSignOut = async () => {
    // Stop pending snapshot/draft writes before waiting for the storage transaction.
    window.dispatchEvent(new Event("pwa:clear-local-state"));
    const cleared = await clearOfflineWorkspace(workspaceSlug, userId).catch(() => false);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace(cleared ? "/admin/login" : "/admin/login?notice=local-data-retained");
  };

  const isActive = (href: string) => resolveAdminNavLink(identityHref)?.href === href;
  const pendingAdminPath = pendingHref
    ? resolveAdminPathname(
        new URL(pendingHref, "http://accelerate.local").pathname,
        scenarioId,
        demoRoute,
      )
    : null;
  const isPendingActive = (href: string) =>
    Boolean(
      pendingAdminPath &&
      (pendingAdminPath === href || (href !== "/admin" && pendingAdminPath.startsWith(href))),
    );
  const routeIsPending = Boolean(pendingAdminPath && pendingAdminPath !== effectivePathname);
  const pendingMobileIndex = mobilePrimaryLinks.findIndex((link) => isPendingActive(link.href));
  const committedMobileIndex = mobilePrimaryLinks.findIndex((link) => isActive(link.href));
  const mobileDockIndex = pendingAdminPath
    ? pendingMobileIndex >= 0
      ? pendingMobileIndex
      : mobilePrimaryLinks.length
    : committedMobileIndex >= 0
      ? committedMobileIndex
      : mobilePrimaryLinks.length;

  const commandActions: CommandAction[] = [
    {
      label: invoicingEnabled ? "Create invoice" : "Set up invoicing",
      description: invoicingEnabled
        ? "Prepare a customer invoice for review"
        : "Invoices are turned off. Open instructions to enable invoicing.",
      keywords: "new invoice create invoice add invoice billing bills payments",
      icon: ReceiptText,
      run: () => router.push("/admin/invoicing?view=create"),
    },
    {
      label: "New lead",
      description: "Add an opportunity to the pipeline",
      keywords: "create add lead opportunity",
      icon: Plus,
      run: () => {
        // Same shared create modal the Leads page button opens (?create=1),
        // so validation and creation stay in AddLeadModal + POST
        // /api/admin/leads. The palette adds no business logic.
        router.push("/admin/leads?create=1");
      },
    },
    {
      label: "Compose email",
      description: "Write a direct follow-up",
      keywords: "send reply follow up message",
      icon: Mail,
      run: () => {
        setComposeDraft({ subject: "", body: "" });
        setComposeOpen(true);
      },
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
      run: () =>
        window.dispatchEvent(
          new CustomEvent("admin:add-note", { detail: { captureSource: "command_palette" } }),
        ),
    },
    {
      label: "Export leads",
      description: "Download the current lead database",
      keywords: "csv download backup",
      icon: Download,
      run: () => window.open("/api/admin/leads/export", "_blank", "noopener,noreferrer"),
    },
    {
      label: "Open setup",
      description: "Review integration health and connection status",
      keywords: "setup configure health integrations status connections",
      icon: Settings,
      run: () => router.push("/admin/setup"),
    },
    {
      label: "Install Command Center",
      description: "Add your workspace to this device",
      keywords: "pwa app download install dock home screen offline",
      icon: Download,
      run: () => window.dispatchEvent(new Event("admin:open-pwa-install")),
    },
    {
      label: "Open recovery",
      description: "Inspect failed runs and reconcile receipts",
      keywords: "recovery failed runs receipts reconcile errors retry",
      icon: LifeBuoy,
      run: () => router.push("/admin/recovery"),
    },
    {
      label: "Show pipeline risk",
      description: "Ask AI for a read-only pipeline risk summary",
      keywords: "ai risk pipeline stale deals briefing report",
      icon: Bot,
      run: () =>
        window.dispatchEvent(
          new CustomEvent("admin:open-ai", {
            detail: {
              prompt:
                "Summarize current pipeline risk: stale deals, bottlenecks, and what needs me first. Read-only summary, no changes.",
            },
          }),
        ),
    },
    {
      label: "What should I do next",
      description: "Ask AI what needs the founder first",
      keywords: "ai next priorities todo focus briefing",
      icon: Bot,
      run: () =>
        window.dispatchEvent(
          new CustomEvent("admin:open-ai", {
            detail: { prompt: "What should I do next? Base it only on live records and receipts." },
          }),
        ),
    },
    {
      label: "View live site",
      description: `Open ${tenant.brand.domain} in a new tab`,
      keywords: "website public open",
      icon: ArrowUpRight,
      run: () => window.open(siteUrl(), "_blank", "noopener,noreferrer"),
    },
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredLinks = searchAdminNavLinks(visibleNavLinks, searchQuery);
  const filteredActions = normalizedQuery
    ? commandActions.filter((action) =>
        `${action.label} ${action.description} ${action.keywords}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : commandActions;
  const breadcrumbs = getAdminBreadcrumbs(identityHref);

  return (
    <AdminQueryProvider key={scenarioId || workspaceSlug} scope={scenarioId || workspaceSlug}>
      <AdminThemeProvider initialTheme={workspaceTheme}>
        <AdminAIProvider>
          <MotionConfig reducedMotion="user">
            <AdminConfirmationProvider>
              <div className="admin-shell flex h-dvh min-h-0 overflow-hidden">
                {/* First tab stop for keyboard users: jump past the sidebar nav
              straight to the route content. Revealed only on keyboard focus. */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[400] focus:rounded-xl focus:bg-[var(--admin-ink)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[var(--admin-surface)]"
                >
                  Skip to content
                </a>
                <aside
                  inert={mobileOpen}
                  className={cn(
                    "admin-sidebar hidden shrink-0 lg:block",
                    sidebarCollapsed ? "w-[80px]" : "w-[272px]",
                  )}
                  data-admin-sidebar
                  data-collapsed={sidebarCollapsed}
                >
                  <div className="sticky top-0 flex h-screen flex-col px-4 py-5">
                    <SidebarContent
                      idPrefix="admin-desktop"
                      isActive={isActive}
                      onSignOut={handleSignOut}
                      collapsed={sidebarCollapsed}
                      onToggleCollapse={toggleSidebar}
                      priorityCount={priorityCount}
                      demoScenarioId={scenarioId}
                      navigationSections={visibleNavSections}
                      workspaceSlug={workspaceSlug}
                      workspaceName={workspaceName}
                      workspaces={workspaces}
                      onSwitchWorkspace={switchWorkspace}
                    />
                  </div>
                </aside>

                <header
                  inert={mobileOpen}
                  className="admin-mobile-header fixed inset-x-0 top-0 z-40 flex min-h-16 items-center justify-between gap-2 px-4 pt-[env(safe-area-inset-top)] lg:hidden"
                >
                  {scenarioId ? (
                    <Link
                      href="/admin/today"
                      className="admin-nav-brand flex min-w-0 items-center gap-2.5 font-semibold"
                      aria-label={`${DEMO_SCENARIOS[scenarioId].name} demo home`}
                    >
                      <DemoScenarioMark scenarioId={scenarioId} className="size-8 shrink-0" />
                      <span className="min-w-0">
                        <span className="block max-w-40 truncate text-sm">
                          {DEMO_SCENARIO_SHELL_NAMES[scenarioId]}
                        </span>
                        <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.13em] text-[var(--admin-nav-muted)]">
                          Demo
                        </span>
                      </span>
                    </Link>
                  ) : (
                    <Logo
                      href="/admin/today"
                      ariaLabel={`${tenant.brand.name} Revenue OS home`}
                      size="sm"
                      className="admin-nav-brand shrink-0"
                    />
                  )}
                  <div className="flex items-center gap-1">
                    <NotificationBell placement="mobile" />
                    <button
                      type="button"
                      onClick={() => setSearchOpen(true)}
                      className="admin-nav-control inline-flex size-11 items-center justify-center rounded-[var(--admin-control-radius)] transition-[color,background-color,transform] duration-150 active:scale-[0.96]"
                      aria-label="Open command palette"
                    >
                      <Search className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </header>

                <AnimatePresence initial={false}>
                  {mobileOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                      <motion.button
                        type="button"
                        aria-label="Dismiss navigation"
                        className="admin-overlay-backdrop absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setMobileOpen(false)}
                      />
                      <motion.aside
                        ref={mobileDrawerRef}
                        id="admin-mobile-navigation"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Admin navigation"
                        className="admin-mobile-sheet admin-sidebar absolute bottom-2 right-2 top-2 flex w-[min(22rem,calc(100vw-1rem))] flex-col rounded-[var(--admin-surface-radius)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
                        initial={{ opacity: 0, x: 30, scale: 0.985 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 22, scale: 0.99 }}
                        transition={{ type: "spring", duration: 0.34, bounce: 0 }}
                      >
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
                            window.setTimeout(
                              () => window.dispatchEvent(new CustomEvent("admin:open-ai")),
                              220,
                            );
                          }}
                          priorityCount={priorityCount}
                          demoScenarioId={scenarioId}
                          navigationSections={visibleNavSections}
                          workspaceSlug={workspaceSlug}
                          workspaceName={workspaceName}
                          workspaces={workspaces}
                          onSwitchWorkspace={switchWorkspace}
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
                  recordResults={searchRecords}
                  searchingRecords={searchingRecords}
                  recordSearchError={recordSearchError}
                  onRetryRecords={() => {
                    searchInputRef.current?.focus();
                    void searchForRecords(searchQuery.trim());
                  }}
                  onSelectPage={(href) => {
                    router.push(href);
                    closeSearch();
                  }}
                  onSelectAction={(action) => {
                    closeSearch();
                    window.requestAnimationFrame(action.run);
                  }}
                  inputRef={searchInputRef}
                />

                <main
                  id="main-content"
                  ref={mainRef}
                  tabIndex={-1}
                  inert={mobileOpen}
                  className="admin-main min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(8rem,calc(7rem+env(safe-area-inset-bottom)))] pt-[calc(76px+env(safe-area-inset-top))] sm:px-6 lg:px-8 lg:pb-12 lg:pt-0 xl:px-10"
                >
                  <div
                    className="admin-workspace-toolbar hidden items-center justify-between gap-4 sm:flex"
                    data-admin-workspace-toolbar
                  >
                    {breadcrumbs.length > 1 && (
                      <nav
                        className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--admin-muted)]"
                        aria-label="Breadcrumb"
                      >
                        {breadcrumbs.map((crumb, index) => (
                          <span
                            key={`${crumb.href}-${index}`}
                            className="flex min-w-0 items-center gap-1.5"
                          >
                            {index > 0 && <span className="opacity-45">/</span>}
                            <Link
                              href={crumb.href}
                              className={cn(
                                "truncate transition-colors duration-150 hover:text-[var(--admin-ink)]",
                                index === breadcrumbs.length - 1 && "text-[var(--admin-ink)]",
                              )}
                              aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}
                            >
                              {crumb.label}
                            </Link>
                          </span>
                        ))}
                      </nav>
                    )}
                    {breadcrumbs.length <= 1 && (
                      <p className="admin-workspace-name">
                        {scenarioId ? DEMO_SCENARIOS[scenarioId].name : workspaceName}
                      </p>
                    )}
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent("admin:open-ai"))}
                        className="admin-button admin-button--ghost admin-workspace-tool"
                      >
                        <Bot className="size-3.5" />
                        Ask AI
                        <kbd className="ml-1 rounded-md bg-[var(--admin-surface-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-muted)]">
                          ⌘J
                        </kbd>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchOpen(true)}
                        className="admin-button admin-button--secondary admin-workspace-tool"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Search
                        <kbd className="ml-1 rounded-md bg-[var(--admin-surface-subtle)] px-1.5 py-0.5 font-mono text-[10px]">
                          ⌘K
                        </kbd>
                      </button>
                    </div>
                  </div>
                  <div
                    className="admin-route-frame"
                    data-navigation-pending={routeIsPending ? "true" : "false"}
                  >
                    <AdminRouteStage routeKey={routeKey}>
                      <AdminErrorBoundary key={routeKey}>
                        {moduleDisabled ? <ModuleDisabledNotice module={owningModule} /> : children}
                      </AdminErrorBoundary>
                    </AdminRouteStage>
                  </div>
                </main>

                <nav
                  inert={mobileOpen}
                  style={{ "--admin-mobile-dock-index": mobileDockIndex } as CSSProperties}
                  className="admin-mobile-dock fixed inset-x-4 bottom-[max(0.55rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-4 items-stretch rounded-[var(--admin-surface-radius)] p-1 lg:hidden"
                  aria-label="Primary navigation"
                >
                  <span className="admin-mobile-dock-active" aria-hidden="true" />
                  {mobilePrimaryLinks.map((link) => {
                    const committed = isActive(link.href);
                    const active = isPendingActive(link.href) || (!pendingAdminPath && committed);
                    return (
                      <Link
                        key={link.id}
                        href={link.href}
                        prefetch
                        aria-current={committed ? "page" : undefined}
                        data-pending={isPendingActive(link.href) ? "true" : undefined}
                        className={cn(
                          "admin-mobile-dock-item relative flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--admin-surface-radius)] px-1 text-[9px] font-semibold transition-[color,background-color,transform] duration-200 active:scale-[0.96]",
                          active && "is-active",
                        )}
                      >
                        <link.icon className="relative z-10 size-[17px]" aria-hidden="true" />
                        <span className="relative z-10 max-w-full truncate">
                          {link.id === "contacts" ? "Records" : link.label}
                        </span>
                      </Link>
                    );
                  })}
                  <button
                    ref={mobileMenuButtonRef}
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    className={cn(
                      "admin-mobile-dock-item relative flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--admin-surface-radius)] px-1 text-[9px] font-semibold transition-[color,background-color,transform] duration-200 active:scale-[0.96]",
                      mobileDockIndex === mobilePrimaryLinks.length && "is-active",
                    )}
                    aria-label="Open More"
                    aria-expanded={mobileOpen}
                    aria-controls="admin-mobile-navigation"
                  >
                    <MoreHorizontal className="relative z-10 size-[18px]" aria-hidden="true" />
                    <span className="relative z-10">More</span>
                  </button>
                </nav>

                <EmailComposeModal
                  isOpen={composeOpen}
                  onClose={() => setComposeOpen(false)}
                  recipientEmail=""
                  initialSubject={composeDraft.subject}
                  initialBody={composeDraft.body}
                />
                <AdminCreateTaskModal />
                <AdminFounderNoteModal />
                <AdminAIPanel />
                <Toaster />
                <AdminShortcuts />
                <CommandCenterPwa
                  key={`${workspaceSlug}:${userId}`}
                  tenantSlug={workspaceSlug}
                  userId={userId}
                  enabled={!scenarioId && !isAuthRoute}
                />
              </div>
            </AdminConfirmationProvider>
          </MotionConfig>
        </AdminAIProvider>
      </AdminThemeProvider>
    </AdminQueryProvider>
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
  navigationSections,
  workspaceSlug,
  workspaceName,
  workspaces,
  onSwitchWorkspace,
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
  navigationSections: AdminNavSection[];
  workspaceSlug: string;
  workspaceName: string;
  workspaces: WorkspaceOption[];
  onSwitchWorkspace: (slug: string) => void;
}) {
  const groups = groupSidebarLinks(navigationSections);
  const activeGroup = groups.find((group) =>
    [group.primary, ...group.links].some((link) => link && isActive(link.href)),
  )?.id;
  const { pendingHref } = useNavigationRuntime();
  const pendingPath = pendingHref
    ? new URL(pendingHref, "http://accelerate.local").pathname.replace(
        /^\/demo\/command-center\/[^/]+/,
        "/admin",
      )
    : null;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [recordsMoreOverride, setRecordsMoreOverride] = useState<boolean | null>(null);
  const demoScenario = demoScenarioId ? DEMO_SCENARIOS[demoScenarioId] : null;

  return (
    <>
      <div
        className={cn(
          "mb-5 flex shrink-0 items-center",
          collapsed ? "flex-col gap-1.5" : "justify-between gap-2 px-1",
        )}
        data-admin-sidebar-header
      >
        {onClose ? (
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2" aria-label="Workspace tools">
            <button
              type="button"
              onClick={onOpenSearch}
              className="admin-nav-utility inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--admin-control-radius)] px-3 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]"
            >
              <Search className="size-4" />
              Search
            </button>
            <button
              type="button"
              onClick={onOpenAI}
              className="admin-nav-utility inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--admin-control-radius)] px-3 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]"
            >
              <Bot className="size-4" />
              Ask AI
            </button>
          </div>
        ) : collapsed ? (
          <Link
            href="/admin/today"
            onClick={onNavigate}
            aria-label={
              demoScenario
                ? `${demoScenario.name} demo home`
                : `${tenant.brand.name} Revenue OS home`
            }
            className="admin-nav-brand admin-nav-control logo-link grid size-10 place-items-center rounded-[var(--admin-control-radius)] transition-[background-color,transform] duration-150 active:scale-[0.96]"
          >
            {demoScenarioId ? (
              <DemoScenarioMark scenarioId={demoScenarioId} className="size-8" />
            ) : (
              <LogoMark className="h-4 w-8" />
            )}
          </Link>
        ) : demoScenarioId && demoScenario ? (
          <Link
            href="/admin/today"
            onClick={onNavigate}
            aria-label={`${demoScenario.name} demo home`}
            className="admin-nav-brand flex min-w-0 items-center gap-2.5 rounded-[var(--admin-control-radius)] py-1 pr-1 transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.98]"
          >
            <DemoScenarioMark scenarioId={demoScenarioId} className="size-9 shrink-0" />
            <span className="min-w-0">
              <span className="block text-pretty text-[13px] font-semibold leading-4">
                {DEMO_SCENARIO_SHELL_NAMES[demoScenarioId]}
              </span>
              <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.13em] text-[var(--admin-nav-muted)]">
                Demo workspace
              </span>
            </span>
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
        <div
          className={cn("flex shrink-0 items-center", collapsed ? "flex-col gap-1" : "gap-0.5")}
          data-admin-sidebar-controls
        >
          {!onClose && <NotificationBell placement="sidebar" />}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="admin-nav-control grid size-10 shrink-0 place-items-center rounded-[var(--admin-control-radius)] transition-[background-color,color,transform] duration-150 active:scale-[0.96]"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-[17px]" />
              ) : (
                <PanelLeftClose className="size-[17px]" />
              )}
            </button>
          )}
          {onClose && (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="admin-nav-control grid size-11 shrink-0 place-items-center rounded-[var(--admin-control-radius)] transition-[background-color,color,transform] duration-150 active:scale-[0.96]"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
      </div>

      <nav
        className="admin-nav-scroll flex-1 space-y-1 overflow-y-auto overscroll-contain"
        aria-label="Admin navigation"
      >
        {groups.map((group) => {
          const primary = group.primary!;
          const active = activeGroup === group.id;
          const expanded = !collapsed && (openGroup === group.id || (openGroup === null && active));
          const panelId = `${idPrefix}-nav-${group.id}`;
          const Icon = group.icon;
          const extraLinks =
            group.id === "records"
              ? group.links.filter((link) => !primaryRecordLinks.has(link.id))
              : [];
          const directLinks =
            group.id === "records"
              ? group.links.filter((link) => primaryRecordLinks.has(link.id))
              : group.links;
          const recordsMoreExpanded =
            recordsMoreOverride ?? extraLinks.some((link) => isActive(link.href));
          const renderChildLink = (link: AdminNavLink) => {
            const selected = isActive(link.href);
            return (
              <Link
                key={link.id}
                href={link.href}
                onClick={() => {
                  setOpenGroup(null);
                  setRecordsMoreOverride(null);
                  onNavigate?.();
                }}
                title={link.description}
                aria-current={selected ? "page" : undefined}
                data-pending={pendingPath === link.href && !selected ? "true" : undefined}
                className="admin-nav-link flex min-h-10 items-center gap-2 rounded-[var(--admin-control-radius)] px-2.5 text-xs font-medium transition-[color,background-color] duration-150"
              >
                <link.icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{link.label}</span>
              </Link>
            );
          };
          return (
            <section key={group.id} data-nav-section={group.label}>
              <div className="flex items-center gap-0.5">
                <Link
                  href={primary.href}
                  onClick={() => {
                    setOpenGroup(null);
                    setRecordsMoreOverride(null);
                    onNavigate?.();
                  }}
                  aria-label={collapsed ? group.label : undefined}
                  title={collapsed ? group.label : primary.description}
                  aria-current={isActive(primary.href) ? "page" : undefined}
                  data-pending={
                    pendingPath === primary.href && !isActive(primary.href) ? "true" : undefined
                  }
                  className={cn(
                    "admin-nav-link group relative flex min-h-11 min-w-0 flex-1 items-center rounded-[var(--admin-control-radius)] text-[13.5px] font-semibold transition-[color,background-color,transform] duration-150 active:scale-[0.96]",
                    collapsed ? "justify-center" : "gap-3 px-2.5",
                    active &&
                      !isActive(primary.href) &&
                      "bg-[var(--admin-nav-hover)] text-[var(--admin-nav-ink)]",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="min-w-0 flex-1 truncate">{group.label}</span>}
                  {group.id === "today" && priorityCount > 0 && (
                    <span
                      className={cn(
                        "rounded-full bg-[var(--admin-nav-hover)] px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums",
                        collapsed && "absolute right-0 top-0 size-2 p-0 text-transparent",
                      )}
                      aria-label={`${priorityCount} urgent priorities`}
                    >
                      {priorityCount > 99 ? "99+" : priorityCount}
                    </span>
                  )}
                  {active && (
                    <motion.span
                      layoutId={`${idPrefix}-nav-active`}
                      className="admin-nav-active-indicator absolute inset-y-2 -left-4 w-0.5 rounded-r"
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </Link>
                {!collapsed && group.links.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpenGroup(expanded ? "" : group.id)}
                    aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label} links`}
                    aria-controls={panelId}
                    aria-expanded={expanded}
                    className="admin-nav-control grid size-10 shrink-0 place-items-center rounded-[var(--admin-control-radius)]"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                )}
              </div>
              {group.links.length > 0 && !collapsed && (
                <div
                  id={panelId}
                  inert={!expanded}
                  aria-hidden={!expanded}
                  className={cn(
                    "admin-nav-disclosure grid",
                    expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="space-y-0.5 pb-1 pl-6 pt-0.5">
                      {directLinks.map(renderChildLink)}
                      {extraLinks.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setRecordsMoreOverride(!recordsMoreExpanded)}
                            aria-expanded={recordsMoreExpanded}
                            aria-controls={`${panelId}-more`}
                            className="admin-nav-link flex min-h-10 w-full items-center justify-between rounded-[var(--admin-control-radius)] px-2.5 text-left text-xs font-medium transition-colors duration-150"
                          >
                            More records
                            <ChevronDown
                              className={cn(
                                "size-3.5 transition-transform duration-200",
                                recordsMoreExpanded && "rotate-180",
                              )}
                              aria-hidden="true"
                            />
                          </button>
                          <div
                            id={`${panelId}-more`}
                            inert={!recordsMoreExpanded}
                            aria-hidden={!recordsMoreExpanded}
                            className={cn(
                              "admin-nav-disclosure grid",
                              recordsMoreExpanded
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0",
                            )}
                          >
                            <div className="min-h-0 space-y-0.5 overflow-hidden pl-2">
                              {extraLinks.map(renderChildLink)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </nav>

      <div className="admin-nav-footer mt-3 shrink-0 border-t pt-3">
        {!collapsed && !demoScenarioId && (
          <div className="mb-2 px-1">
            <label
              htmlFor={`${idPrefix}-workspace`}
              className="mb-1 block px-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-[var(--admin-nav-faint)]"
            >
              Workspace
            </label>
            <div className="admin-nav-utility relative rounded-[var(--admin-control-radius)] shadow-sm">
              <select
                id={`${idPrefix}-workspace`}
                value={workspaceSlug}
                onChange={(event) => onSwitchWorkspace(event.target.value)}
                className="min-h-11 w-full appearance-none cursor-pointer rounded-[var(--admin-control-radius)] bg-transparent py-2 pl-3 pr-9 text-xs font-semibold outline-none transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-white/45 active:scale-[0.98]"
                aria-label="Switch workspace"
              >
                {(workspaces.length
                  ? workspaces
                  : [
                      {
                        id: workspaceSlug,
                        slug: workspaceSlug,
                        name: workspaceName,
                        status: "active",
                      },
                    ]
                ).map((workspace) => (
                  <option key={workspace.id} value={workspace.slug}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 opacity-60"
                aria-hidden="true"
              />
            </div>
          </div>
        )}
        {!collapsed && demoScenarioId && (
          <p className="mb-1 px-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-[var(--admin-nav-faint)]">
            Workspace
          </p>
        )}
        {!demoScenarioId && (
          <Link
            href="/demo/command-center"
            target="_blank"
            onClick={onNavigate}
            aria-label="Open demo workspace"
            title={collapsed ? "Open demo workspace" : undefined}
            data-admin-demo-link
            className={cn(
              "admin-nav-demo-link mb-1 flex min-h-10 items-center rounded-[var(--admin-control-radius)] text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96]",
              collapsed ? "justify-center" : "gap-3 px-2.5",
            )}
          >
            <MonitorPlay className="h-4 w-4 shrink-0" />{" "}
            {!collapsed && (
              <>
                <span>Demo workspace</span>
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-white/52" />
              </>
            )}
          </Link>
        )}
        <AdminAppearancePicker collapsed={collapsed} demoScenarioId={demoScenarioId} />
        {demoScenarioId && (
          <div className="mt-1">
            <AdminDemoControls collapsed={collapsed} controlsId={`${idPrefix}-demo-controls`} />
          </div>
        )}
        {!demoScenarioId && (
          <>
            <Link
              href={siteUrl()}
              target="_blank"
              onClick={onNavigate}
              title={collapsed ? "View live site" : undefined}
              className={cn(
                "admin-nav-utility flex min-h-10 items-center rounded-[var(--admin-control-radius)] text-xs transition-[color,background-color,transform] duration-150 active:scale-[0.96]",
                collapsed ? "justify-center" : "gap-3 px-2.5",
              )}
            >
              <ArrowUpRight className="h-4 w-4" /> {!collapsed && "View live site"}
            </Link>
            <button
              type="button"
              onClick={async () => {
                onNavigate?.();
                await onSignOut();
              }}
              title={collapsed ? "Sign out" : undefined}
              className={cn(
                "admin-nav-utility flex min-h-10 w-full items-center rounded-[var(--admin-control-radius)] text-xs transition-[color,background-color,transform] duration-150 active:scale-[0.96]",
                collapsed ? "justify-center" : "gap-3 px-2.5",
              )}
            >
              <LogOut className="h-4 w-4" /> {!collapsed && "Sign out"}
            </button>
          </>
        )}
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
  recordResults,
  searchingRecords,
  recordSearchError,
  onRetryRecords,
  onSelectPage,
  onSelectAction,
  inputRef,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  actions: CommandAction[];
  pageResults: AdminNavLink[];
  recordResults: SearchRecord[];
  searchingRecords: boolean;
  recordSearchError: string;
  onRetryRecords: () => void;
  onSelectPage: (href: string) => void;
  onSelectAction: (action: CommandAction) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const listId = useId();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const orderedRecords = useMemo(
    () =>
      searchRecordGroups.flatMap((group) =>
        recordResults.filter((record) => record.kind === group.kind),
      ),
    [recordResults],
  );
  const items = useMemo(
    () => [
      ...actions.map((action) => ({ kind: "action" as const, action })),
      ...pageResults.map((page) => ({ kind: "page" as const, page })),
      ...orderedRecords.map((record) => ({ kind: "record" as const, record })),
    ],
    [actions, pageResults, orderedRecords],
  );

  const activeIndex = Math.min(selectedIndex, Math.max(0, items.length - 1));

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setSelectedIndex(0);
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, inputRef]);

  const select = (index: number) => {
    const item = items[index];
    if (!item) return;
    if (item.kind === "action") onSelectAction(item.action);
    if (item.kind === "page") onSelectPage(item.page.href);
    if (item.kind === "record") onSelectPage(item.record.href);
  };

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title="Admin command palette"
      ariaLabel="Admin command palette"
      align="top"
      maxWidth="lg"
      className="max-sm:fixed max-sm:inset-0 max-sm:max-w-none"
    >
      <div className="admin-dialog-surface relative flex h-dvh w-full flex-col overflow-hidden bg-[var(--admin-surface)] text-[var(--admin-ink)] sm:h-auto sm:max-w-xl">
        <div className="flex min-h-[calc(3.75rem+env(safe-area-inset-top))] items-end gap-3 border-b border-[var(--admin-border)] px-4 pb-3 pt-[env(safe-area-inset-top)] sm:min-h-14 sm:items-center sm:py-0">
          <Search className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search workspace"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={items.length ? `${listId}-${activeIndex}` : undefined}
            value={query}
            onChange={(event) => {
              setSelectedIndex(0);
              onQueryChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((current) => Math.min(current + 1, Math.max(0, items.length - 1)));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((current) => Math.max(current - 1, 0));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                select(activeIndex);
              }
              if (event.key === "Escape") onClose();
            }}
            placeholder="Search records, pages, or run a command…"
            className="min-w-0 flex-1 bg-transparent text-base text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)] sm:text-sm focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2"
          />
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-lg bg-[var(--admin-surface-subtle)] text-[var(--admin-muted)] transition-[color,transform] active:scale-[0.96] sm:hidden"
            aria-label="Close search"
          >
            <X className="size-4" />
          </button>
          <kbd className="hidden rounded-md bg-[var(--admin-surface-subtle)] px-1.5 py-1 font-mono text-[9px] text-[var(--admin-muted)] sm:block">
            ESC
          </kbd>
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="min-h-0 flex-1 overflow-y-auto p-2 sm:max-h-[58vh]"
        >
          {actions.length > 0 && (
            <ResultSection label="Actions">
              {actions.map((action, index) => (
                <CommandRow
                  id={`${listId}-${index}`}
                  key={action.label}
                  icon={action.icon}
                  label={action.label}
                  description={action.description}
                  selected={activeIndex === index}
                  onClick={() => onSelectAction(action)}
                />
              ))}
            </ResultSection>
          )}
          {pageResults.length > 0 && (
            <ResultSection label="Pages">
              {pageResults.map((page, index) => {
                const itemIndex = actions.length + index;
                return (
                  <CommandRow
                    id={`${listId}-${itemIndex}`}
                    key={page.href}
                    icon={page.icon}
                    label={page.label}
                    description={page.description}
                    selected={activeIndex === itemIndex}
                    onClick={() => onSelectPage(page.href)}
                  />
                );
              })}
            </ResultSection>
          )}
          {searchRecordGroups.map((group) => {
            const matches = recordResults.filter((record) => record.kind === group.kind);
            if (matches.length === 0) return null;
            const icon = {
              people: User,
              work: CheckSquare,
              opportunities: ArrowUpRight,
              clients: UsersRound,
              proposals: ReceiptText,
            }[group.kind];
            return (
              <ResultSection key={group.kind} label={group.label}>
                {matches.map((record) => (
                  <CommandRow
                    id={`${listId}-${actions.length + pageResults.length + orderedRecords.indexOf(record)}`}
                    key={`${record.kind}:${record.id}`}
                    icon={icon}
                    label={record.label}
                    description={record.description}
                    selected={
                      activeIndex ===
                      actions.length + pageResults.length + orderedRecords.indexOf(record)
                    }
                    onClick={() => onSelectPage(record.href)}
                  />
                ))}
              </ResultSection>
            );
          })}
          {searchingRecords && (
            <p className="px-3 py-4 text-center text-xs text-[var(--admin-muted)]">
              Searching records…
            </p>
          )}
          {recordSearchError && (
            <div
              role="alert"
              className="m-2 rounded-[var(--admin-surface-radius)] bg-[var(--admin-surface-subtle)] p-3"
            >
              <p className="text-sm font-semibold">{recordSearchError}</p>
              {recordResults.length > 0 && (
                <p className="admin-copy mt-1 text-xs">Previously loaded matches remain visible.</p>
              )}
              <button
                type="button"
                onClick={onRetryRecords}
                className="admin-button admin-button--secondary mt-3"
              >
                Retry search
              </button>
            </div>
          )}
          {!searchingRecords && !recordSearchError && items.length === 0 && query.trim() && (
            <p className="px-3 py-8 text-center text-sm text-[var(--admin-muted)]">
              {query.trim().length < 3
                ? "Type at least 3 characters to search workspace records."
                : "No matching records, pages, or commands."}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--admin-muted)] sm:pb-2">
          <span className="flex items-center gap-1.5">
            <Command className="h-3 w-3" /> Command Center
          </span>
          <span>↑↓ navigate · ↵ open</span>
        </div>
      </div>
    </AdminDialog>
  );
}

function ResultSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section role="group" aria-label={label} className="mb-2 last:mb-0">
      <p className="px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-[var(--admin-muted)]">
        {label}
      </p>
      {children}
    </section>
  );
}

function CommandRow({
  id,
  icon: Icon,
  label,
  description,
  selected,
  onClick,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <button
      ref={rowRef}
      id={id}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      data-command-selected={selected || undefined}
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-[var(--admin-control-radius)] px-3 text-left transition-[background-color,color,transform] duration-100 active:scale-[0.985] sm:min-h-12",
        selected
          ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
          : "text-[var(--admin-ink)] hover:bg-[var(--admin-surface-subtle)]",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--admin-control-radius)]",
          selected ? "bg-white/12" : "bg-[var(--admin-surface-subtle)] text-[var(--admin-muted)]",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span
          className={cn(
            "block truncate text-[11px]",
            selected ? "text-current opacity-80" : "text-[var(--admin-muted)]",
          )}
        >
          {description}
        </span>
      </span>
      <span className="font-mono text-[10px] opacity-40">↵</span>
    </button>
  );
}
