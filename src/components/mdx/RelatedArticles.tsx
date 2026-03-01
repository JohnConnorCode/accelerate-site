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
    <section className="mt-16">
      <h3 className="font-display text-xl font-semibold text-white-primary mb-6">
        Related Articles
      </h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/learn/${article.slug}`}
            className="group glass rounded-lg p-5 transition-all hover:border-border-gold"
          >
            <span className="text-xs text-gold-light">
              {CATEGORY_LABELS[article.frontmatter.category]}
            </span>
            <h4 className="mt-2 mb-2 font-display text-sm font-semibold text-white-primary group-hover:text-gold-gradient transition-colors line-clamp-2">
              {article.frontmatter.title}
            </h4>
            <div className="flex items-center gap-2 text-xs text-white-muted">
              <Clock className="h-3 w-3" />
              {article.readingTime}
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-xs text-white-muted group-hover:text-gold-light transition-colors">
              Read more <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
