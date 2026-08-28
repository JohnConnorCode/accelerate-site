"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

export type NavigationKind = "push" | "replace" | "pop";
export type NavigationScroll = "top" | "preserve" | "restore";

export interface NavigationIntent {
  href: string;
  kind: NavigationKind;
  scroll: NavigationScroll;
}

interface NavigationRuntimeValue {
  pending: boolean;
  pendingHref: string | null;
  shouldAnimateRoute: boolean;
  beginNavigation: (intent: NavigationIntent) => void;
  registerAdminScroller: (node: HTMLElement | null) => void;
  registerLoadingBoundary: (id: string, active: boolean) => void;
}

const NavigationRuntimeContext = createContext<NavigationRuntimeValue | null>(null);
const ENTRY_KEY = "__accelerateNavigationId";
const POSITION_KEY = "accelerate:navigation-positions";
const MAX_PERSISTED_POSITIONS = 64;

type NavigationState = Record<string, unknown> & { [ENTRY_KEY]?: string };
type PositionMap = Map<string, number>;

let positionCache: PositionMap | null = null;
let positionPersistHandle: number | null = null;

function newEntryId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function readPositions(): PositionMap {
  if (positionCache) return positionCache;
  const entries: Array<[string, number]> = [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(POSITION_KEY) || "{}") as Record<string, unknown>;
    for (const [id, value] of Object.entries(parsed).slice(-MAX_PERSISTED_POSITIONS)) {
      if (Number.isFinite(value)) entries.push([id, Math.max(0, Math.round(Number(value)))]);
    }
  } catch {
    // A malformed legacy receipt must never block navigation or restoration.
  }
  positionCache = new Map(entries);
  return positionCache;
}

function flushPositions() {
  if (!positionCache) return;
  if (positionPersistHandle !== null) {
    window.cancelIdleCallback?.(positionPersistHandle);
    window.clearTimeout(positionPersistHandle);
    positionPersistHandle = null;
  }
  try {
    sessionStorage.setItem(POSITION_KEY, JSON.stringify(Object.fromEntries(positionCache)));
  } catch {
    // Scroll restoration is best-effort when storage is unavailable or full.
  }
}

function schedulePositionFlush() {
  if (positionPersistHandle !== null) return;
  if ("requestIdleCallback" in window) {
    positionPersistHandle = window.requestIdleCallback(() => flushPositions(), { timeout: 1_500 });
    return;
  }
  positionPersistHandle = Number(globalThis.setTimeout(flushPositions, 250));
}

function writePosition(id: string, value: number) {
  const positions = readPositions();
  positions.delete(id);
  positions.set(id, Math.max(0, Math.round(value)));
  while (positions.size > MAX_PERSISTED_POSITIONS) {
    const oldest = positions.keys().next().value;
    if (!oldest) break;
    positions.delete(oldest);
  }
  schedulePositionFlush();
}

function currentHistoryState(): NavigationState {
  const value = history.state;
  return value && typeof value === "object" ? value as NavigationState : {};
}

function ensureEntryId() {
  const state = currentHistoryState();
  if (state[ENTRY_KEY]) return state[ENTRY_KEY];
  const id = newEntryId();
  history.replaceState({ ...state, [ENTRY_KEY]: id }, "", location.href);
  return id;
}

function isModifiedActivation(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function isAdminPath(path: string) {
  return path.startsWith("/admin") || path.startsWith("/demo/command-center/");
}

export function NavigationRuntime({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const currentEntryId = useRef("");
  const intent = useRef<NavigationIntent | null>(null);
  const popTargetId = useRef<string | null>(null);
  const adminScroller = useRef<HTMLElement | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [loadingBoundaries, setLoadingBoundaries] = useState<Set<string>>(() => new Set());
  const [hasNavigated, setHasNavigated] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const getScrollPosition = useCallback((path = previousPathname.current) => {
    if (isAdminPath(path) && adminScroller.current) return adminScroller.current.scrollTop;
    return window.scrollY;
  }, []);

  const setScrollPosition = useCallback((value: number, path = location.pathname) => {
    const next = Math.max(0, value);
    if (isAdminPath(path) && adminScroller.current) {
      adminScroller.current.scrollTo({ top: next, behavior: "instant" });
      return;
    }
    window.scrollTo({ top: next, behavior: "instant" });
  }, []);

  const saveCurrentPosition = useCallback(() => {
    if (!currentEntryId.current) return;
    writePosition(currentEntryId.current, getScrollPosition());
  }, [getScrollPosition]);

  const beginNavigation = useCallback((nextIntent: NavigationIntent) => {
    saveCurrentPosition();
    intent.current = nextIntent;
    setHasNavigated(true);
    setPendingHref(nextIntent.href);
    setPending(true);
  }, [saveCurrentPosition]);

  const registerAdminScroller = useCallback((node: HTMLElement | null) => {
    adminScroller.current = node;
  }, []);

  const registerLoadingBoundary = useCallback((id: string, active: boolean) => {
    setLoadingBoundaries((current) => {
      const next = new Set(current);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const previousScrollRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    currentEntryId.current = ensureEntryId();

    const onPopState = (event: PopStateEvent) => {
      saveCurrentPosition();
      const state = event.state && typeof event.state === "object" ? event.state as NavigationState : {};
      popTargetId.current = state[ENTRY_KEY] || null;
      intent.current = { href: location.href, kind: "pop", scroll: "restore" };
      setHasNavigated(true);
      setPending(true);
    };
    const onPageHide = () => flushPositions();

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedActivation(event)) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.download) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      beginNavigation({ href: url.href, kind: "push", scroll: "top" });
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("click", onClick, true);
    readPositions();
    schedulePositionFlush();
    return () => {
      flushPositions();
      history.scrollRestoration = previousScrollRestoration;
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("click", onClick, true);
    };
  }, [beginNavigation, saveCurrentPosition]);

  useLayoutEffect(() => {
    document.documentElement.dataset.navigationPhase = pending ? "pending" : "idle";
    return () => {
      document.documentElement.dataset.navigationPhase = "idle";
    };
  }, [pending]);

  useEffect(() => {
    const target = isAdminPath(pathname) ? adminScroller.current : window;
    if (!target) return;
    const onScroll = () => saveCurrentPosition();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [pathname, saveCurrentPosition]);

  useLayoutEffect(() => {
    if (previousPathname.current === pathname) return;
    const restoreTimers: number[] = [];
    let focusFrame = 0;
    let focusObserver: MutationObserver | null = null;
    let focusedTarget: HTMLElement | null = null;

    const recordedIntent = intent.current;
    const nextIntent = recordedIntent || { href: location.href, kind: "push" as const, scroll: "top" as const };
    const state = currentHistoryState();
    let nextId = state[ENTRY_KEY];
    // Next preserves arbitrary fields from the previous history state when it
    // creates a client-side entry. A push must still receive a distinct id or
    // the destination's top-of-page scroll overwrites the origin receipt and
    // Back can no longer restore it.
    if (!nextId || (nextIntent.kind === "push" && nextId === currentEntryId.current)) {
      nextId = newEntryId();
      history.replaceState({ ...state, [ENTRY_KEY]: nextId }, "", location.href);
    }
    currentEntryId.current = nextId;

    const positions = readPositions();
    const recordedPosition = positions.get(popTargetId.current || nextId);
    const restoresHistory = nextIntent.kind === "pop" || (!recordedIntent && positions.has(nextId));
    const target = restoresHistory
      ? recordedPosition || 0
      : nextIntent.scroll === "preserve"
        ? getScrollPosition(previousPathname.current)
        : 0;

    setScrollPosition(target, pathname);
    if (restoresHistory) {
      // Next and client-fetched route content can adjust layout after the route
      // commit. Re-assert the stored history position across that bounded
      // settling window, stopping as soon as the destination can hold it.
      for (const delay of [0, 50, 150, 300, 600, 1000]) {
        restoreTimers.push(window.setTimeout(() => setScrollPosition(target, pathname), delay));
      }
    }

    previousPathname.current = pathname;
    popTargetId.current = null;
    intent.current = null;
    setPendingHref(null);
    setPending(false);

    const focusDestination = () => {
      const root = isAdminPath(pathname) ? adminScroller.current : document.getElementById("main-content");
      if (root?.querySelector("[data-admin-route-loading]")) return false;
      const heading = root?.querySelector<HTMLElement>("h1, [data-route-heading]");
      // Client admin pages may commit a local data placeholder before their
      // real page header exists. The heading is the semantic destination; the
      // persistent application viewport is not a successful forward handoff.
      if (isAdminPath(pathname) && !heading) return false;
      const focusTarget = heading || root;
      if (!restoresHistory && focusTarget) {
        const active = document.activeElement;
        const canRefocus = !focusedTarget
          || active === document.body
          || active === focusedTarget
          || !document.contains(focusedTarget);
        if (canRefocus) {
          if (!focusTarget.hasAttribute("tabindex")) focusTarget.setAttribute("tabindex", "-1");
          focusTarget.focus({ preventScroll: true });
          focusedTarget = focusTarget;
        }
      }
      setAnnouncement(document.title);
      return Boolean(focusTarget);
    };
    // Next performs its own focus cleanup as the committed tree settles. Two
    // animation frames place our semantic handoff after that browser-visible
    // commit without guessing at network time or delaying interaction.
    focusFrame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => {
        const root = isAdminPath(pathname) ? adminScroller.current : document.getElementById("main-content");
        if (!restoresHistory && root) {
          // A client-data boundary can replace an already-focused heading after
          // the first commit. Keep the route-scoped observer alive until the next
          // pathname so that replacement receives the same semantic handoff.
          // The interaction guard prevents this from stealing focus once the
          // operator has deliberately moved to another control.
          focusObserver = new MutationObserver(() => {
            focusDestination();
          });
          focusObserver.observe(root, { childList: true, subtree: true });
        }
        focusDestination();
      });
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      focusObserver?.disconnect();
      restoreTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [getScrollPosition, pathname, setScrollPosition]);

  const value = useMemo<NavigationRuntimeValue>(() => ({
    pending: pending || loadingBoundaries.size > 0,
    pendingHref,
    shouldAnimateRoute: hasNavigated,
    beginNavigation,
    registerAdminScroller,
    registerLoadingBoundary,
  }), [beginNavigation, hasNavigated, loadingBoundaries, pending, pendingHref, registerAdminScroller, registerLoadingBoundary]);

  return (
    <NavigationRuntimeContext.Provider value={value}>
      {children}
      <div className="navigation-progress" data-active={pending ? "true" : "false"} aria-hidden="true"><span /></div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </NavigationRuntimeContext.Provider>
  );
}

export function useNavigationRuntime() {
  const value = useContext(NavigationRuntimeContext);
  if (!value) throw new Error("useNavigationRuntime must be used inside NavigationRuntime");
  return value;
}

export function useAppNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useNavigationRuntime();

  const navigate = (kind: "push" | "replace", href: string, scroll: NavigationScroll = "top") => {
    const destination = new URL(href, window.location.href);
    if (destination.pathname !== pathname) {
      navigation.beginNavigation({ href: destination.href, kind, scroll });
    }
    router[kind](href, { scroll: false });
  };

  return {
    push: (href: string, scroll: NavigationScroll = "top") => navigate("push", href, scroll),
    replace: (href: string, scroll: NavigationScroll = "top") => navigate("replace", href, scroll),
  };
}
