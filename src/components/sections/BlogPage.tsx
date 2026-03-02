"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { PageHero } from "@/components/ui/PageHero";
import { fadeUp } from "@/lib/animations";
import { blogPosts } from "@/content/blog-posts";

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BlogPageContent() {
  return (
    <>
      {/* Hero */}
      <PageHero
        label="Blog"
        title={<>Insights &{" "}<span className="text-gold-gradient">Resources</span></>}
        description="Practical advice on AI, automation, and digital growth for small businesses. No fluff, just what works."
      />

      <div className="section-divider" />

      {/* Blog Grid */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {blogPosts.map((post) => (
              <AnimateOnScroll key={post.slug} variants={fadeUp}>
                <GlassCard
                  hover="lift"
                  padding="none"
                  className="h-full flex flex-col"
                >
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)]">{post.category}</span>
                      <span className="text-xs text-[var(--white-muted)]">
                        {post.readTime}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-3 leading-snug">
                      {post.title}
                    </h2>

                    <p className="text-sm text-[var(--white-secondary)] leading-relaxed mb-4 line-clamp-2 flex-1">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--border-glass)]">
                      <span className="text-xs text-[var(--white-muted)]">
                        {formatDate(post.date)}
                      </span>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm text-[var(--white-secondary)] hover:text-[var(--white-primary)] link-gold-underline transition-colors"
                      >
                        Read More
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </GlassCard>
              </AnimateOnScroll>
            ))}
          </StaggerContainer>
        </div>
      </section>
    </>
  );
}
