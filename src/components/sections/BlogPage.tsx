"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
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
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="orb-gold top-[-10%] right-[-5%]" />
          <div className="orb-white bottom-[-15%] left-[-10%]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <AnimateOnScroll>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
              style={{
                fontFamily:
                  "var(--font-space-grotesk), var(--font-inter), sans-serif",
              }}
            >
              Insights &{" "}
              <span className="text-gold-gradient">Resources</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
              Practical advice on AI, automation, and digital growth for small
              businesses. No fluff, just what works.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Blog Grid */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {blogPosts.map((post) => (
              <AnimateOnScroll key={post.slug} variants={fadeUp}>
                <GlassCard
                  hover="lift"
                  padding="none"
                  className="h-full flex flex-col"
                >
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <Badge variant="gold">{post.category}</Badge>
                      <span className="text-xs text-white/40">
                        {post.readTime}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold text-white mb-3 leading-snug">
                      {post.title}
                    </h2>

                    <p className="text-sm text-white/60 leading-relaxed mb-4 line-clamp-2 flex-1">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--border-glass)]">
                      <span className="text-xs text-white/40">
                        {formatDate(post.date)}
                      </span>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white link-gold-underline transition-colors"
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
