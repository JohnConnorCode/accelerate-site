"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const readHeadings = (): TocItem[] => {
  if (typeof document === "undefined") return [];
  const article = document.querySelector("[data-article-content]");
  if (!article) return [];
  const elements = article.querySelectorAll("h2, h3");
  // Only headings rehype-slug actually assigned an id to (article-body h2/h3
  // from markdown). MDX components like StepByStep/CTACard render their own
  // h3s with no id — they have nothing to link to and would collide as
  // duplicate "" keys if included.
  return Array.from(elements)
    .filter((el) => el.id)
    .map((el) => ({
      id: el.id,
      text: el.textContent || "",
      level: parseInt(el.tagName[1] ?? "2"),
    }));
};

export function TableOfContents() {
  // Start empty so the server render and the client's first (hydration) render
  // match — both produce `null`. Headings are read from the DOM after mount,
  // then the TOC fades in. Reading during render would diverge (no `document`
  // on the server) and break hydration of this aside's siblings.
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const article = document.querySelector("[data-article-content]");
    if (!article) return;

    // Read on the next frame (not synchronously in this effect) so the first
    // client render still matches the server's `null` — then the TOC fades in.
    const raf = requestAnimationFrame(() => setHeadings(readHeadings()));

    const observer = new MutationObserver(() => {
      setHeadings(readHeadings());
    });

    observer.observe(article, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -80% 0px" },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className="bg-[var(--surface-bg)] p-5 shadow-[var(--card-shadow)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-4 w-0.5 bg-[var(--fg)]" />
        <h4 className="font-display text-sm font-semibold text-white-primary">On this page</h4>
      </div>
      <ul className="space-y-1 border-l border-border-glass ml-0.5">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={cn(
                "-ml-px block border-l-2 py-1.5 text-sm transition-[color,border-color,transform] duration-200",
                heading.level === 3 ? "pl-6" : "pl-4",
                activeId === heading.id
                  ? "translate-x-0.5 border-l-[var(--fg)] font-medium text-heading"
                  : "text-white-muted hover:text-white-secondary border-l-transparent",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
