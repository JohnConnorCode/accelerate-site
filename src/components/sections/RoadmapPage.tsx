"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Search, X, Send } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Eyebrow, Heading } from "@/components/v2/studio/primitives";
import { cn } from "@/lib/utils";
import { FEATURE_STATUS_META, type FeatureStatus } from "@/lib/feature-board";
import type { PublicRoadmapCard } from "@/lib/roadmap";

const COLUMN_ORDER: FeatureStatus[] = [
  "in_progress",
  "in_review",
  "planned",
  "blocked",
  "backlog",
  "shipped",
];

function acceptanceLines(card: PublicRoadmapCard): string[] {
  return card.acceptance_criteria
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

function RoadmapCard({ card }: { card: PublicRoadmapCard }) {
  const [open, setOpen] = useState(false);
  const lines = acceptanceLines(card);
  return (
    <div
      id={`roadmap-${card.seed_key}`}
      className="scroll-mt-24 rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] p-5 backdrop-blur-md transition-colors hover:border-[var(--border-glass-hover)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        {card.category && (
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gold">
            {card.category}
          </span>
        )}
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted">
          {card.priority}
        </span>
      </div>
      <h3 className="mt-2 font-display text-base font-semibold leading-snug tracking-[-0.01em] text-heading">
        <Link
          href={`/roadmap#roadmap-${encodeURIComponent(card.seed_key)}`}
          className="underline decoration-dotted underline-offset-4 hover:text-gold"
        >
          {card.title}
        </Link>
      </h3>
      {card.description && (
        <p className="mt-2 text-sm leading-relaxed text-white-secondary">{card.description}</p>
      )}
      {lines.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-3 text-xs font-medium text-white-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-gold"
          >
            {open ? "Hide acceptance criteria" : `Acceptance criteria (${lines.length})`}
          </button>
          {open && (
            <ul className="mt-3 space-y-1.5 border-t border-border-glass pt-3">
              {lines.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-white-secondary">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current text-white-muted"
                  />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SuggestForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setState("sending");
    setErrorMessage("");
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          description: data.get("description"),
          email: data.get("email"),
          company: data.get("company"), // honeypot
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Something went wrong.");
      setState("sent");
      form.reset();
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (state === "sent") {
    return (
      <p className="mt-4 rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] p-4 text-sm text-white-secondary">
        Thanks. It&apos;s in front of the team now. Suggestions that get triaged show up here with
        the rest of the roadmap.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <div>
        <label htmlFor="suggest-title" className="sr-only">
          Feature title
        </label>
        <input
          id="suggest-title"
          name="title"
          required
          maxLength={120}
          placeholder="What should we build?"
          className="admin-field w-full rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] px-3.5 py-2.5 text-sm text-heading placeholder:text-white-muted focus:border-border-gold focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="suggest-description" className="sr-only">
          Description
        </label>
        <textarea
          id="suggest-description"
          name="description"
          required
          maxLength={2000}
          rows={3}
          placeholder="What problem does it solve?"
          className="admin-field w-full resize-none rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] px-3.5 py-2.5 text-sm text-heading placeholder:text-white-muted focus:border-border-gold focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="suggest-email" className="sr-only">
          Email (optional)
        </label>
        <input
          id="suggest-email"
          name="email"
          type="email"
          maxLength={254}
          placeholder="Email (optional, if you want a reply)"
          className="admin-field w-full rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] px-3.5 py-2.5 text-sm text-heading placeholder:text-white-muted focus:border-border-gold focus:outline-none"
        />
      </div>
      {state === "error" && <p className="text-sm text-rose-400">{errorMessage}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border-gold bg-gold/10 px-4 py-2.5 text-sm font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {state === "sending" ? "Sending…" : "Suggest a feature"}
      </button>
    </form>
  );
}

export function RoadmapPageContent({
  cards,
  availability = "ready",
}: {
  cards: PublicRoadmapCard[];
  availability?: "ready" | "unconfigured" | "unavailable";
}) {
  const [query, setQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<FeatureStatus | "all">("all");
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [showSuggest, setShowSuggest] = useState(false);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<FeatureStatus, number>> = {};
    for (const card of cards) counts[card.status] = (counts[card.status] ?? 0) + 1;
    return counts;
  }, [cards]);

  const categories = useMemo(
    () => [...new Set(cards.map((c) => c.category).filter((c): c is string => Boolean(c)))].sort(),
    [cards],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (activeStatus !== "all" && card.status !== activeStatus) return false;
      if (activeCategory !== "all" && card.category !== activeCategory) return false;
      if (!q) return true;
      return card.title.toLowerCase().includes(q) || card.description.toLowerCase().includes(q);
    });
  }, [cards, query, activeStatus, activeCategory]);

  const byStatus = useMemo(() => {
    const map = new Map<FeatureStatus, PublicRoadmapCard[]>();
    for (const card of filtered) {
      const list = map.get(card.status) ?? [];
      list.push(card);
      map.set(card.status, list);
    }
    return map;
  }, [filtered]);

  const hasFilters = activeStatus !== "all" || activeCategory !== "all" || query.trim().length > 0;

  const statusPill = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] transition-colors",
      active
        ? "border-border-gold text-gold"
        : "border-border-glass text-white-muted hover:border-[var(--border-glass-hover)] hover:text-heading",
    );

  return (
    <Section width="wide" className="page-offset-roomy">
      {/* hero */}
      <Eyebrow className="mb-7">Roadmap</Eyebrow>
      <Heading size={2} as="h1" className="max-w-3xl leading-[1.04]">
        Shipped, in progress, and <span className="display-italic">planned next.</span>
      </Heading>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-white-secondary">
        {availability === "ready"
          ? "Read live from the same board the team works from, acceptance criteria included."
          : availability === "unconfigured"
            ? "This installation is ready to explore. Connect a workspace to publish its roadmap."
            : "The roadmap is temporarily unavailable. Please try again shortly."}{" "}
        See{" "}
        <Link href="/open-source" className="underline">
          Open Source
        </Link>{" "}
        for the code behind it.
      </p>

      {/* filter bar: search first, then status, then categories */}
      <div className="mt-10 border-y border-border-glass py-6" aria-label="Filter the roadmap">
        <div className="max-w-xl">
          <label htmlFor="roadmap-search" className="sr-only">
            Search the roadmap
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
            <input
              id="roadmap-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the roadmap…"
              className="admin-field w-full rounded-full border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] py-2.5 pl-10 pr-9 text-sm text-heading placeholder:text-white-muted focus:border-border-gold focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white-muted transition-colors hover:text-heading"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div
          className="mt-4 flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Filter by status"
        >
          <button
            type="button"
            onClick={() => setActiveStatus("all")}
            aria-pressed={activeStatus === "all"}
            className={statusPill(activeStatus === "all")}
          >
            All ({cards.length})
          </button>
          {COLUMN_ORDER.map((status) => {
            const count = statusCounts[status];
            if (!count) return null;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setActiveStatus(status)}
                aria-pressed={activeStatus === status}
                className={statusPill(activeStatus === status)}
              >
                {FEATURE_STATUS_META[status].label} ({count})
              </button>
            );
          })}
        </div>

        {categories.length > 1 && (
          <div
            className="mt-2.5 flex gap-2 overflow-x-auto pb-1"
            role="group"
            aria-label="Filter by category"
          >
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-[0.7rem] font-medium transition-colors",
                activeCategory === "all"
                  ? "border-border-gold text-gold"
                  : "border-border-glass text-white-muted hover:border-[var(--border-glass-hover)] hover:text-heading",
              )}
            >
              All categories
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={activeCategory === category}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[0.7rem] font-medium capitalize transition-colors",
                  activeCategory === category
                    ? "border-border-gold text-gold"
                    : "border-border-glass text-white-muted hover:border-[var(--border-glass-hover)] hover:text-heading",
                )}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-white-muted" aria-live="polite">
          {hasFilters
            ? `${filtered.length} of ${cards.length} items match.`
            : `${cards.length} items across ${byStatus.size} stages.`}
        </p>
      </div>

      {/* stacked status sections */}
      <div aria-live="polite" className="mt-12 flex flex-col gap-14">
        {filtered.length === 0 && (
          <p className="text-sm text-white-secondary">
            {availability === "unconfigured" ? (
              <>
                No workspace data is connected.{" "}
                <Link href="/demo/command-center/northline-roofing" className="underline">
                  Explore the fictional Command Center
                </Link>{" "}
                or follow the{" "}
                <Link href="/docs/self-hosting/overview" className="underline">
                  setup guide
                </Link>
                .
              </>
            ) : availability === "unavailable" ? (
              "The connected roadmap could not be loaded. Please try again shortly."
            ) : hasFilters ? (
              "No roadmap items match your search or filter."
            ) : (
              "Nothing here yet."
            )}
          </p>
        )}
        {COLUMN_ORDER.map((status) => {
          const list = byStatus.get(status);
          if (!list?.length) return null;
          const meta = FEATURE_STATUS_META[status];
          return (
            <section key={status} aria-label={meta.label}>
              <AnimateOnScroll as="div">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    aria-hidden
                    className={cn("h-2 w-2 shrink-0 self-center rounded-full", meta.accent)}
                  />
                  <h2 className="font-mono text-[0.75rem] uppercase tracking-[0.2em] text-heading">
                    {meta.label} · {list.length}
                  </h2>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-white-muted">{meta.description}</p>
              </AnimateOnScroll>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((card, i) => (
                  <AnimateOnScroll key={card.seed_key} as="div" delay={Math.min(i, 5) * 0.04}>
                    <RoadmapCard card={card} />
                  </AnimateOnScroll>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* suggest */}
      {availability === "ready" && (
        <div className="mt-16 grid gap-8 border-t border-border-glass pt-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div>
            <h2 className="font-display text-2xl font-semibold text-heading">Got an idea?</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white-secondary">
              Suggest a feature. A founder reviews every submission before it appears here.
            </p>
          </div>
          <div>
            {!showSuggest && (
              <button
                type="button"
                onClick={() => setShowSuggest(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border-glass px-4 py-2 text-sm font-medium text-heading transition-colors hover:border-border-gold hover:text-gold"
              >
                <Send className="h-4 w-4 text-gold" />
                Suggest a feature
              </button>
            )}
            {showSuggest && <SuggestForm />}
          </div>
        </div>
      )}
    </Section>
  );
}
