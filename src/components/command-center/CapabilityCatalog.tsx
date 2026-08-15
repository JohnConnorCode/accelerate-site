"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/home/reveal";
import {
  CATEGORY_META,
  capabilities,
  type CapabilityCategory,
} from "@/content/command-center";

/* The full surface, filterable. Follows the house filter pattern from
   LearnHub (pill row + search + AnimatePresence keyed on the filter).

   Rows are collapsible <details> — a version that showed every row's detail
   text on screen at once turned 43 rows into a wall the height of several
   screens. But an earlier collapsed version showed NOTHING but the title
   when closed, several of them two words ("Companies", "An API"), which read
   as thin. This splits the difference: collapsed rows are compact (title
   only, one line), and the two-column grid keeps even 43 of them from
   reading as an endless single-file scroll. */

export function CapabilityCatalog() {
  const [active, setActive] = useState<CapabilityCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (id: string) =>
    setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const counts = useMemo(() => {
    const map = new Map<CapabilityCategory, number>();
    for (const c of capabilities) map.set(c.category, (map.get(c.category) ?? 0) + 1);
    return map;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return capabilities.filter((c) => {
      const matchesCategory = active === "all" || c.category === active;
      const matchesQuery =
        !q || c.title.toLowerCase().includes(q) || c.detail.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [active, query]);

  // Group headers only earn their place when the list is long enough to need
  // signposting, which means when no category filter is doing that job already.
  const showGroupHeads = active === "all";

  const groups = useMemo(() => {
    if (!showGroupHeads) {
      const meta = CATEGORY_META.find((c) => c.id === active)!;
      return [{ ...meta, items: filtered }];
    }
    return CATEGORY_META.map((meta) => ({
      ...meta,
      items: filtered.filter((c) => c.category === meta.id),
    })).filter((g) => g.items.length > 0);
  }, [filtered, active, showGroupHeads]);

  const pill = (isActive: boolean) =>
    cn(
      "rounded-full px-4 py-1.5 text-sm transition-colors",
      isActive
        ? "border border-fg bg-[color-mix(in_srgb,var(--fg)_10%,transparent)] text-heading"
        : "border border-rule text-mid hover:border-fg hover:text-heading"
    );

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" data-cursor="link" onClick={() => setActive("all")} className={pill(active === "all")}>
            Everything <span className="opacity-50">{capabilities.length}</span>
          </button>
          {CATEGORY_META.map((cat) => (
            <button
              key={cat.id}
              type="button"
              data-cursor="link"
              onClick={() => setActive(cat.id)}
              className={pill(active === cat.id)}
            >
              <span aria-hidden="true" style={{ color: `rgb(${cat.rgb})` }}>
                {cat.glyph}
              </span>{" "}
              {cat.label} <span className="opacity-50">{counts.get(cat.id) ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="relative lg:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search what it can do"
            aria-label="Search capabilities"
            className="w-full rounded-full border border-rule bg-transparent py-2 pl-10 pr-4 text-sm text-heading placeholder:text-soft focus:border-fg focus:outline-none lg:w-64"
          />
        </div>
      </div>

      <p className="cc-count mb-5">
        {active === "all" && !query.trim()
          ? `${capabilities.length} things it can run for you`
          : `${filtered.length} of ${capabilities.length}`}
        {active !== "all" && (
          <span className="cc-count-b">{CATEGORY_META.find((c) => c.id === active)?.blurb}</span>
        )}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {filtered.length === 0 ? (
            <p className="py-14 text-center text-mid">
              Nothing matches that. It probably still does it, so ask on the call.
            </p>
          ) : (
            // Grouped while showing everything, flat once a category is picked.
            // 43 identical rows in one run is a wall; six labelled blocks is a list.
            groups.map((g) => (
              <section key={g.id} className="mb-7 last:mb-0">
                {showGroupHeads && (
                  <p className="cc-group">
                    <span style={{ color: `rgb(${g.rgb})` }} aria-hidden="true">
                      {g.glyph}
                    </span>
                    {g.label}
                    <span className="cc-group-n">{g.items.length}</span>
                    <span className="cc-group-b">{g.blurb}</span>
                  </p>
                )}
                <div className="cc-cat-list">
                  {g.items.map((cap, i) => (
                    <Reveal
                      key={cap.id}
                      as="details"
                      className="item-rv cc-row"
                      style={{ "--d": `${0.03 * (i % 6)}s` } as CSSProperties}
                      open={open.includes(cap.id)}
                      onClick={(e: MouseEvent) => {
                        e.preventDefault();
                        toggle(cap.id);
                      }}
                    >
                      <summary>
                        <span className="cc-cat" style={{ color: `rgb(${g.rgb})` }} aria-hidden="true">
                          {g.glyph}
                        </span>
                        <span className="cc-sum-title">{cap.title}</span>
                        <span className="pm" />
                      </summary>
                      <div className="cc-ans">
                        <div>
                          <p>
                            {cap.detail}
                            {cap.gated && <span className="cc-chip cc-chip-inline">Waits for your approval</span>}
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </section>
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
