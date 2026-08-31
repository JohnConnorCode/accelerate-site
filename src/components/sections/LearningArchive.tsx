import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ArticleSummary } from "@/lib/types";
import { ArticleCard } from "@/components/mdx/ArticleCard";
import { AnimateOnScroll, EntranceGroup, EntranceItem } from "@/components/ui/AnimateOnScroll";
import { Container, Eyebrow } from "@/components/v2/studio/primitives";

export function LearningArchive({
  eyebrow,
  title,
  description,
  articles,
  showCategory = true,
}: {
  eyebrow: string;
  title: string;
  description: string;
  articles: ArticleSummary[];
  showCategory?: boolean;
}) {
  return (
    <>
      <section className="pb-20 pt-36 sm:pb-24 sm:pt-40">
        <Container width="wide">
          <EntranceGroup className="max-w-4xl">
            <EntranceItem>
              <Link
                href="/learn"
                className="mb-10 inline-flex min-h-10 items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-white-muted transition-colors hover:text-heading"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                All guides
              </Link>
            </EntranceItem>
            <EntranceItem>
              <Eyebrow className="mb-6">{eyebrow}</Eyebrow>
            </EntranceItem>
            <EntranceItem>
              <h1 className="max-w-[18ch] text-balance font-display text-[clamp(2.75rem,7vw,6.5rem)] font-medium leading-[0.95] tracking-[-0.045em] text-heading">
                {title}
              </h1>
            </EntranceItem>
            <EntranceItem>
              <div className="mt-8 flex flex-col gap-4 border-t border-[var(--rule)] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-pretty leading-relaxed text-white-secondary">{description}</p>
                <p className="shrink-0 font-mono text-xs tabular-nums uppercase tracking-[0.14em] text-white-muted">
                  {articles.length} {articles.length === 1 ? "guide" : "guides"}
                </p>
              </div>
            </EntranceItem>
          </EntranceGroup>
        </Container>
      </section>

      <section className="section-divide pb-28 pt-12 sm:pt-16">
        <Container width="wide">
          {articles.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2">
              {articles.map((article, index) => (
                <AnimateOnScroll key={article.slug} as="article" delay={(index % 2) * 0.06}>
                  <ArticleCard article={article} index={index} showCategory={showCategory} />
                </AnimateOnScroll>
              ))}
            </div>
          ) : (
            <p className="py-20 text-center text-white-muted">
              No published guides here yet. Check back soon.
            </p>
          )}
        </Container>
      </section>
    </>
  );
}
