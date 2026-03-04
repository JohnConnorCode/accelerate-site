"use client";

import { ExternalLink } from "lucide-react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

interface ToolRecommendationProps {
  name: string;
  description: string;
  pricing: string;
  link?: string;
  bestFor?: string;
}

export function ToolRecommendation({
  name,
  description,
  pricing,
  link,
  bestFor,
}: ToolRecommendationProps) {
  const pathname = usePathname();
  const slug = pathname.startsWith("/learn/") ? pathname.replace("/learn/", "") : pathname;

  const handleClick = () => {
    trackEvent("Outbound Tool Click", { article: slug, tool: name, href: link || "" });
  };

  return (
    <div className="my-6 glass rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-display font-semibold text-white-primary m-0">
            {name}
          </h4>
          <p className="mt-1 mb-0 text-sm text-white-secondary">{description}</p>
          {bestFor && (
            <p className="mt-2 mb-0 text-xs text-white-muted">
              Best for: {bestFor}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-semibold text-gold-gradient">
            {pricing}
          </span>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
              className="mt-2 flex items-center gap-1 text-xs text-white-muted hover:text-white-primary transition-colors"
            >
              Visit <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
