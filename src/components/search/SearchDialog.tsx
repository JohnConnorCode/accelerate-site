"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppNavigation } from "@/components/navigation/NavigationRuntime";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Search, CornerDownLeft, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import type { SearchEntry, SearchGroup } from "@/lib/search";
import { searchEntries } from "@/lib/search/score";
import { cn } from "@/lib/utils";

/**
 * Site-wide search.
 *
 * The index is fetched once on first open and filtered in the browser, so every
 * keystroke is instant and costs nothing. It is small enough that this is the
 * right trade: a few dozen entries beats a request per character on every
 * measure that matters here.
 *
 * Keyboard first, because anyone who reaches for search already knows what they
 * want. Cmd/Ctrl+K or / opens it, arrows move, Enter navigates, Escape closes.
 */

const GROUP_ORDER: SearchGroup[] = [
  "Pages",
  "Industries",
  "Services",
  "Packages",
  "Articles",
  "Changelog",
];

/** Shown before anything is typed: the things people actually look for. */
const SUGGESTED = ["Pricing", "Nonprofits", "Book a call", "Command Center"];

function useSearchIndex(open: boolean) {
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || entries || failed) return;
    let cancelled = false;
    fetch("/api/search")
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error(String(response.status))),
      )
      .then((data: { entries: SearchEntry[] }) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entries, failed]);

  return { entries, failed };
}

export function SearchDialog({
  open,
  onOpenChangeAction,
}: {
  open: boolean;
  onOpenChangeAction: (next: boolean) => void;
}) {
  const router = useAppNavigation();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { entries, failed } = useSearchIndex(open);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => (entries && query.trim() ? searchEntries(entries, query) : []),
    [entries, query],
  );

  // Grouped for display, but the flat list is what the arrow keys walk, so the
  // highlighted row and the row Enter opens can never disagree.
  const grouped = useMemo(() => {
    const buckets = new Map<SearchGroup, SearchEntry[]>();
    for (const entry of results) {
      if (!buckets.has(entry.group)) buckets.set(entry.group, []);
      buckets.get(entry.group)!.push(entry);
    }
    return GROUP_ORDER.filter((group) => buckets.has(group)).map((group) => ({
      group,
      items: buckets.get(group)!,
    }));
  }, [results]);

  const flat = useMemo(() => grouped.flatMap((bucket) => bucket.items), [grouped]);

  // Clamped rather than reset from an effect, so the highlighted row can never
  // point past the end of a shrinking result list.
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : 0;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!next) {
        setQuery("");
        setActive(0);
      }
      onOpenChangeAction(next);
    },
    [onOpenChangeAction],
  );

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const go = useCallback(
    (entry: SearchEntry) => {
      setOpen(false);
      router.push(entry.href);
    },
    [setOpen, router],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (flat.length ? (current + 1) % flat.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (flat.length ? (current - 1 + flat.length) % flat.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = flat[activeIndex];
      if (entry) go(entry);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[100] bg-[rgba(11,11,11,0.5)] backdrop-blur-[4px]"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild onKeyDown={onKeyDown} aria-label="Search the site">
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.99 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-[12vh] z-[101] w-[min(43rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--rule)] bg-[color-mix(in_srgb,var(--fg)_5%,var(--bg))] shadow-[0_40px_90px_-30px_rgba(11,11,11,0.6)] dark:border-[var(--rule-dark)]"
              >
                <Dialog.Title className="sr-only">Search</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Search pages, industries, and articles. Use the arrow keys to move and Enter to
                  open.
                </Dialog.Description>

                <div className="flex items-center gap-3 border-b border-[var(--rule)] px-5 dark:border-[var(--rule-dark)]">
                  {entries === null && !failed ? (
                    <Loader2 className="size-[18px] shrink-0 animate-spin text-[var(--soft)]" />
                  ) : (
                    <Search className="size-[18px] shrink-0 text-[var(--soft)]" />
                  )}
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActive(0);
                    }}
                    placeholder="Search pages, industries, and articles"
                    aria-label="Search query"
                    className="h-16 w-full bg-transparent font-[var(--body)] text-[17px] text-[var(--fg)] outline-none placeholder:text-[var(--soft)]"
                  />
                  <kbd className="hidden shrink-0 rounded-md border border-[var(--rule)] px-1.5 py-0.5 font-[var(--util)] text-[10px] uppercase tracking-[0.08em] text-[var(--soft)] sm:block dark:border-[var(--rule-dark)]">
                    Esc
                  </kbd>
                </div>

                <div
                  ref={listRef}
                  className="max-h-[min(26rem,54vh)] overflow-y-auto overscroll-contain"
                >
                  {failed && (
                    <p className="px-5 py-10 text-center font-[var(--body)] text-[14px] text-[var(--mid)]">
                      Search is unavailable right now. Try the navigation, or{" "}
                      <a href="/contact" className="underline underline-offset-4">
                        get in touch
                      </a>
                      .
                    </p>
                  )}

                  {!failed && !query.trim() && (
                    <div className="px-5 py-6">
                      <p className="font-[var(--util)] text-[10px] uppercase tracking-[0.14em] text-[var(--soft)]">
                        Try
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {SUGGESTED.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              setQuery(suggestion);
                              setActive(0);
                            }}
                            className="rounded-full border border-[var(--rule)] px-3 py-1.5 font-[var(--body)] text-[13px] text-[var(--mid)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)] dark:border-[var(--rule-dark)]"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!failed && query.trim() && entries !== null && flat.length === 0 && (
                    <p className="px-5 py-10 text-center font-[var(--body)] text-[14px] text-[var(--mid)]">
                      Nothing matches <span className="text-[var(--fg)]">{query}</span>. Try a
                      different word, or{" "}
                      <a href="/contact" className="underline underline-offset-4">
                        ask us directly
                      </a>
                      .
                    </p>
                  )}

                  {grouped.map((bucket) => (
                    <div key={bucket.group} className="py-2">
                      <p className="px-5 py-1.5 font-[var(--util)] text-[10px] uppercase tracking-[0.14em] text-[var(--soft)]">
                        {bucket.group}
                      </p>
                      {bucket.items.map((entry) => {
                        const index = flat.indexOf(entry);
                        const isActive = index === activeIndex;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            data-active={isActive}
                            onMouseMove={() => setActive(index)}
                            onClick={() => go(entry)}
                            className={cn(
                              "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
                              isActive
                                ? "bg-[var(--surface-bg-strong)]"
                                : "hover:bg-[var(--surface-bg)]",
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-[var(--body)] text-[15px] text-[var(--fg)]">
                                {entry.title}
                              </span>
                              {entry.description && (
                                <span className="mt-0.5 block truncate font-[var(--body)] text-[13px] text-[var(--soft)]">
                                  {entry.description}
                                </span>
                              )}
                            </span>
                            {isActive && (
                              <CornerDownLeft className="size-3.5 shrink-0 text-[var(--soft)]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="hidden items-center gap-4 border-t border-[var(--rule)] px-5 py-2.5 font-[var(--util)] text-[10px] uppercase tracking-[0.1em] text-[var(--soft)] sm:flex dark:border-[var(--rule-dark)]">
                  <span className="flex items-center gap-1">
                    <ArrowUp className="size-3" />
                    <ArrowDown className="size-3" /> Move
                  </span>
                  <span className="flex items-center gap-1">
                    <CornerDownLeft className="size-3" /> Open
                  </span>
                  <span className="ml-auto">
                    {flat.length ? `${flat.length} result${flat.length === 1 ? "" : "s"}` : ""}
                  </span>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/**
 * Global shortcut wiring, kept separate so the header only owns the button.
 * `/` is deliberately ignored while the visitor is typing somewhere else.
 */
export function useSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpen();
      } else if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);
}
