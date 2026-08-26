import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import type { Article } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/constants";
import { formatDateOnly } from "@/lib/date-format";

interface ArticleCardProps {
  article: Article;
  index?: number;
  showCategory?: boolean;
}

const formatDate = (date: string) =>
  formatDateOnly(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function ArticleCard({
  article,
  index,
  showCategory = true,
}: ArticleCardProps) {
  return (
    <Link
      href={`/learn/${article.slug}`}
      data-cursor="link"
      className="learning-card group flex h-full min-h-[17rem] flex-col p-6 sm:p-7"
    >
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white-muted">
          {showCategory && (
            <span className="text-heading">
              {CATEGORY_LABELS[article.frontmatter.category]}
            </span>
          )}
          <span>{formatDate(article.frontmatter.date)}</span>
        </div>
        {index != null && (
          <span className="font-mono text-xs tabular-nums text-white-muted" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>

      <h3 className="max-w-[27ch] text-balance font-display text-xl font-medium leading-[1.2] tracking-[-0.02em] text-heading sm:text-2xl">
        {article.frontmatter.title}
      </h3>
      <p className="mt-4 line-clamp-3 max-w-[58ch] flex-1 text-pretty text-sm leading-relaxed text-white-secondary">
        {article.frontmatter.excerpt}
      </p>

      <div className="mt-8 flex items-center justify-between border-t border-[var(--rule)] pt-4 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-white-muted">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {article.readingTime}
        </span>
        <span className="inline-flex items-center gap-2 text-heading">
          Read guide
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
