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
  return Array.from(elements).map((el) => ({
    id: el.id,
    text: el.textContent || "",
    level: parseInt(el.tagName[1] ?? "2"),
  }));
};

export function TableOfContents() {
  const [headings, setHeadings] = useState<TocItem[]>(() => readHeadings());
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const article = document.querySelector("[data-article-content]");
    if (!article) return;

    const observer = new MutationObserver(() => {
      setHeadings(readHeadings());
    });

    observer.observe(article, { childList: true, subtree: true });
    return () => observer.disconnect();
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
      { rootMargin: "-80px 0px -80% 0px" }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-4 rounded-full bg-gold" />
        <h4 className="font-display text-sm font-semibold text-white-primary">
          On this page
        </h4>
      </div>
      <ul className="space-y-1 border-l border-border-glass ml-0.5">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={cn(
                "block text-sm transition-all duration-200 py-1.5 -ml-px border-l-2",
                heading.level === 3 ? "pl-6" : "pl-4",
                activeId === heading.id
                  ? "text-gold-light font-medium border-l-[var(--gold-base)]"
                  : "text-white-muted hover:text-white-secondary border-l-transparent"
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
