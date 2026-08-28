import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container, Eyebrow } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";

export default function NotFound() {
  return (
    <section className="page-offset relative flex min-h-[100svh] items-center overflow-hidden bg-[var(--bg)] py-[clamp(3rem,8vw,8rem)]">
      <div aria-hidden className="not-found-grid absolute inset-0 opacity-60" />
      <Container className="relative grid gap-12 lg:grid-cols-[minmax(20rem,.62fr)_minmax(0,1.38fr)] lg:items-end lg:gap-20">
        <AnimateOnScroll className="flex items-end border-b border-[var(--rule)] pb-5 lg:min-h-[25rem]">
          <span aria-hidden className="font-display text-[clamp(8rem,18vw,15rem)] font-medium leading-[.72] tracking-[-.09em] text-[var(--fg)]">404</span>
        </AnimateOnScroll>
        <div className="max-w-3xl">
          <AnimateOnScroll><Eyebrow className="mb-8">Route not found</Eyebrow></AnimateOnScroll>
          <RevealHeading as="h1" lead="This page isn’t part of the system." className="max-w-[12ch] text-balance font-display text-[clamp(3.3rem,8vw,7.5rem)] font-medium leading-[.88] tracking-[-.065em] text-[var(--fg)]" />
          <AnimateOnScroll delay={0.12}>
            <p className="mt-8 max-w-xl text-pretty text-lg leading-8 text-[var(--mid)]">The route may have moved, or the address may be incomplete. Start from the homepage or continue into our selected work.</p>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.2} className="mt-9 flex flex-wrap items-center gap-5">
          <Link
            href="/"
            data-cursor="link"
            className="btn group inline-flex items-center gap-2.5 self-start"
          >
            Back to home
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            href="/work"
            data-cursor="link"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-heading"
          >
            <span className="ink-sweep">View selected work</span>
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          </AnimateOnScroll>
        </div>
      </Container>
    </section>
  );
}
