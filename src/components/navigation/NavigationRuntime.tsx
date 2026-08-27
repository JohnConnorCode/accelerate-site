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
  shouldAnimateRoute: boolean;
  beginNavigation: (intent: NavigationIntent) => void;
  registerAdminScroller: (node: HTMLElement | null) => void;
}

const NavigationRuntimeContext = createContext<NavigationRuntimeValue | null>(null);
const ENTRY_KEY = "__accelerateNavigationId";
const POSITION_KEY = "accelerate:navigation-positions";

type NavigationState = Record<string, unknown> & { [ENTRY_KEY]?: string };

function newEntryId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function readPositions() {
  try {
    return JSON.parse(sessionStorage.getItem(POSITION_KEY) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function writePosition(id: string, value: number) {
  const positions = readPositions();
  positions[id] = Math.max(0, Math.round(value));
  sessionStorage.setItem(POSITION_KEY, JSON.stringify(positions));
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

export function NavigationRuntime({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const currentEntryId = useRef("");
  const intent = useRef<NavigationIntent | null>(null);
  const popTargetId = useRef<string | null>(null);
  const adminScroller = useRef<HTMLElement | null>(null);
  const [pending, setPending] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const isAdminPath = useCallback((path = pathname) => (
    path.startsWith("/admin") || path.startsWith("/demo/command-center/")
  ), [pathname]);

  const getScrollPosition = useCallback((path = previousPathname.current) => {
    if (isAdminPath(path) && adminScroller.current) return adminScroller.current.scrollTop;
    return window.scrollY;
  }, [isAdminPath]);

  const setScrollPosition = useCallback((value: number, path = pathname) => {
    const next = Math.max(0, value);
    if (isAdminPath(path) && adminScroller.current) {
      adminScroller.current.scrollTo({ top: next, behavior: "instant" });
      return;
    }
    window.scrollTo({ top: next, behavior: "instant" });
  }, [isAdminPath, pathname]);

  const saveCurrentPosition = useCallback(() => {
    if (!currentEntryId.current) return;
    writePosition(currentEntryId.current, getScrollPosition());
  }, [getScrollPosition]);

  const beginNavigation = useCallback((nextIntent: NavigationIntent) => {
    saveCurrentPosition();
    intent.current = nextIntent;
    setHasNavigated(true);
    setPending(true);
  }, [saveCurrentPosition]);

  const registerAdminScroller = useCallback((node: HTMLElement | null) => {
    adminScroller.current = node;
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

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedActivation(event)) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.download) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      beginNavigation({ href: url.href, kind: "push", scroll: "top" });
    };

    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick, true);
    return () => {
      history.scrollRestoration = previousScrollRestoration;
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick, true);
    };
  }, [beginNavigation, saveCurrentPosition]);

  useEffect(() => {
    const target = isAdminPath() ? adminScroller.current : window;
    if (!target) return;
    const onScroll = () => saveCurrentPosition();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [isAdminPath, pathname, saveCurrentPosition]);

  useLayoutEffect(() => {
    if (previousPathname.current === pathname) return;
    const restoreTimers: number[] = [];
    let focusFrame = 0;
    let focusedTarget: HTMLElement | null = null;

    const recordedIntent = intent.current;
    const nextIntent = recordedIntent || { href: location.href, kind: "push" as const, scroll: "top" as const };
    const state = currentHistoryState();
    let nextId = state[ENTRY_KEY];
    if (!nextId) {
      nextId = newEntryId();
      history.replaceState({ ...state, [ENTRY_KEY]: nextId }, "", location.href);
    }
    currentEntryId.current = nextId;

    const positions = readPositions();
    const restoresHistory = nextIntent.kind === "pop" || (!recordedIntent && positions[nextId] !== undefined);
    const target = restoresHistory
      ? positions[popTargetId.current || nextId] || 0
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
    setPending(false);

    const focusDestination = () => {
      const root = isAdminPath(pathname) ? adminScroller.current : document.getElementById("main-content");
      const heading = root?.querySelector<HTMLElement>("h1, [data-route-heading]");
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
    };
    focusFrame = requestAnimationFrame(() => {
      focusDestination();
      // A streamed route can replace its first loading tree after the commit.
      // Re-run once after that bounded handoff so focus lands on the real page
      // heading rather than returning to the persistent navigation control.
      if (!restoresHistory) {
        restoreTimers.push(window.setTimeout(focusDestination, 80));
        restoreTimers.push(window.setTimeout(focusDestination, 320));
        restoreTimers.push(window.setTimeout(focusDestination, 720));
        restoreTimers.push(window.setTimeout(focusDestination, 1200));
      }
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      restoreTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [getScrollPosition, isAdminPath, pathname, setScrollPosition]);

  const value = useMemo<NavigationRuntimeValue>(() => ({
    pending,
    shouldAnimateRoute: hasNavigated,
    beginNavigation,
    registerAdminScroller,
  }), [beginNavigation, hasNavigated, pending, registerAdminScroller]);

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
