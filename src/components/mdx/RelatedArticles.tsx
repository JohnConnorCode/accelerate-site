import type { ArticleSummary } from "@/lib/types";
import { ArticleCard } from "@/components/mdx/ArticleCard";

interface RelatedArticlesProps {
  articles: ArticleSummary[];
}

export function RelatedArticles({ articles }: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <div>
      <p className="mb-4 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-white-muted">
        Keep reading
      </p>
      <h3 className="mb-10 text-balance font-display text-3xl font-medium tracking-[-0.025em] text-heading">
        Related guides
      </h3>
      <div className="grid gap-5 lg:grid-cols-3">
        {articles.map((article, index) => (
          <ArticleCard key={article.slug} article={article} index={index} />
        ))}
      </div>
    </div>
  );
}
