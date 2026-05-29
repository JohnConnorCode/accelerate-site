import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container, Eyebrow, Heading } from "@/components/v2/studio/primitives";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-bg-base">
      {/* soft accent glow behind the number, same visual language as Hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(var(--accent-rgb),0.18), transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <Container width="text" className="flex flex-col gap-8">
        <Eyebrow>not found</Eyebrow>
        <Heading size={1}>
          You took a <span className="display-italic">wrong turn.</span>
        </Heading>
        <p className="max-w-xl text-lg leading-relaxed text-white-muted">
          The page you&apos;re looking for doesn&apos;t exist, or it moved while you weren&apos;t
          looking. Head back to the homepage, or grab 30 free minutes with us and we&apos;ll
          help you find what you actually need.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Link
            href="/"
            data-cursor="link"
            className="group inline-flex items-center gap-2.5 self-start rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-btn-text"
          >
            Back to home
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            href="/contact"
            data-cursor="link"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-heading"
          >
            <span className="ink-sweep">Book a Free Discovery Call</span>
            <ArrowUpRight className="h-4 w-4 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </Container>
    </main>
  );
}
