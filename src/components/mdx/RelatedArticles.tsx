import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { Article } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/mdx";

interface RelatedArticlesProps {
  articles: Article[];
}

export function RelatedArticles({ articles }: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-base)] mb-3">
        Keep Reading
      </p>
      <h3 className="font-display text-2xl font-bold text-white mb-8">
        Related Articles
      </h3>
      <div className="grid gap-5 sm:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/learn/${article.slug}`}
            className="group glass rounded-xl p-6 transition-all hover:border-[var(--border-gold)] hover:-translate-y-0.5 flex flex-col h-full"
          >
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[rgba(212,175,55,0.1)] text-[var(--gold-light)] border border-[rgba(212,175,55,0.2)] self-start mb-3">
              {CATEGORY_LABELS[article.frontmatter.category]}
            </span>
            <h4 className="font-display text-sm font-semibold text-[var(--white-primary)] group-hover:text-gold-gradient transition-colors line-clamp-2 mb-2 flex-1">
              {article.frontmatter.title}
            </h4>
            <p className="text-xs text-[var(--white-muted)] line-clamp-2 mb-4">
              {article.frontmatter.excerpt}
            </p>
            <div className="flex items-center justify-between text-xs text-[var(--white-muted)] mt-auto pt-3 border-t border-[var(--border-subtle)]">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {article.readingTime}
              </span>
              <span className="inline-flex items-center gap-1 group-hover:text-[var(--gold-light)] transition-colors">
                Read <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
