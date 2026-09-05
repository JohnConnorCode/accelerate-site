"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { searchEntries } from "@/lib/search/score";
import type { SearchEntry } from "@/lib/search";

type LoadState = "idle" | "loading" | "ready" | "error";

/** Fetch the shared public index once on demand; typing and ranking stay local. */
export function DocsSearch() {
  const id = useId();
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const results = useMemo(() => searchEntries(entries, query.trim(), 8), [entries, query]);
  async function load() {
    if (state === "ready" || state === "loading") return;
    setState("loading");
    try {
      const response = await fetch("/api/search");
      if (!response.ok) throw new Error("Search unavailable");
      const data = (await response.json()) as { entries?: SearchEntry[] };
      if (!Array.isArray(data.entries)) throw new Error("Search unavailable");
      setEntries(data.entries.filter((entry) => entry.group === "Docs"));
      setState("ready");
    } catch {
      setState("error");
    }
  }
  const searching = query.trim().length > 0;
  return (
    <section aria-label="Search documentation" className="mb-8">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-heading">
        Search the docs
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-[var(--rule)] bg-[var(--surface-bg)] px-3 focus-within:ring-2 focus-within:ring-[var(--fg)]">
        <Search className="h-4 w-4 shrink-0 text-white-secondary" aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={query}
          onFocus={() => void load()}
          onChange={(event) => {
            setQuery(event.target.value);
            void load();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder="Try approvals, import contacts, or MCP…"
          className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-heading outline-none"
          autoComplete="off"
          aria-controls={`${id}-results`}
        />
        {searching && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--rule)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div id={`${id}-results`}>
        {searching && (
          <p role="status" className="mt-3 text-sm text-white-secondary">
            {state === "loading" || state === "idle"
              ? "Loading guides…"
              : state === "error"
                ? "Search is unavailable. You can still browse every guide below."
                : results.length
                  ? `${results.length} matching guides`
                  : "No matching guides. Try fewer words or browse a section below."}
          </p>
        )}
        {searching && state === "error" && (
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 min-h-10 text-sm font-medium underline"
          >
            Retry search
          </button>
        )}
        {searching && state === "ready" && results.length > 0 && (
          <ul className="mt-3 divide-y divide-[var(--rule)] rounded-xl border border-[var(--rule)] px-4">
            {results.map((entry) => (
              <li key={entry.id}>
                <Link href={entry.href} onClick={() => setQuery("")} className="block py-4">
                  <span className="block font-medium text-heading underline decoration-transparent underline-offset-4 hover:decoration-current">
                    {entry.title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-white-secondary">
                    {entry.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
