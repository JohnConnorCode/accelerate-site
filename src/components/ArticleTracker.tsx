"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

interface ArticleTrackerProps {
  slug: string;
  category: string;
  funnelStage: string;
}

export function ArticleTracker({ slug, category, funnelStage }: ArticleTrackerProps) {
  const hasFired50 = useRef(false);
  const hasFired100 = useRef(false);

  useEffect(() => {
    trackEvent("Article Read", { slug, category, funnel_stage: funnelStage });
  }, [slug, category, funnelStage]);

  useEffect(() => {
    const article = document.querySelector("[data-article-content]");
    if (!article) return;

    const handleScroll = () => {
      const rect = article.getBoundingClientRect();
      const articleHeight = rect.height;
      const scrolledPast = -rect.top;
      const viewportHeight = window.innerHeight;
      const scrollableHeight = articleHeight - viewportHeight;

      if (scrollableHeight <= 0) return;

      const progress = scrolledPast / scrollableHeight;

      if (progress >= 0.5 && !hasFired50.current) {
        hasFired50.current = true;
        trackEvent("Article Scroll 50%", { slug });
      }

      if (progress >= 0.95 && !hasFired100.current) {
        hasFired100.current = true;
        trackEvent("Article Scroll 100%", { slug });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [slug]);

  return null;
}
