import type { Metadata } from "next";
import Link from "next/link";
import { seoMetadata } from "@/lib/og";
import { ActivityStream } from "@/components/ui/ActivityStream";
import { Button } from "@/components/ui/Button";
import { HeroArtwork } from "@/components/home/HeroArtwork";
import { StyleGuideTokens } from "@/components/ui/StyleGuideTokens";
import { homeActivity } from "@/content/home-activity";
import { ADMIN_APPEARANCES } from "@/lib/admin/appearances";

export const metadata: Metadata = {
  ...seoMetadata({
    title: "Style guide",
    description: "Live design tokens and shared primitives.",
    path: "/style-guide",
  }),
  robots: { index: false, follow: false },
};

export default function StyleGuide() {
  return (
    <div className="wrap pb-24 pt-40 text-[var(--fg)]">
      <h1 className="h1">The Accelerate design system</h1>
      <p className="lede mt-6 max-w-2xl">
        One identity for the public site and the Command Center. Values below come from the active
        stylesheet and update with the appearance.
      </p>
      <section className="mt-20 border-t border-[var(--rule)] pt-10" aria-labelledby="guide-color">
        <h2 className="h2 mb-8" id="guide-color">
          Ink, paper and rules
        </h2>
        <StyleGuideTokens tokens={["--fg", "--bg", "--mid", "--soft", "--rule"]} swatches />
        <p className="mt-6 text-[var(--mid)]">
          Signal is reserved for completed system work, as shown in the activity stream below.
        </p>
      </section>
      <section className="mt-20 border-t border-[var(--rule)] pt-10" aria-labelledby="guide-type">
        <h2 className="h2 mb-8" id="guide-type">
          Three steps, one type family
        </h2>
        <StyleGuideTokens tokens={["--type-display", "--type-section", "--type-title"]} />
        <div className="mt-10 space-y-8">
          <p className="h1">Display, once per page</p>
          <p className="h2">Section, for the next idea</p>
          <p className="h3">Title, for cards and groups</p>
          <p className="text-lg">
            Funnel Sans carries body copy and interface text. Funnel Display carries headings and
            numerals.
          </p>
          <p className="font-mono text-sm tabular-nums">
            JetBrains Mono · 09:12 · Data, timestamps and labels
          </p>
        </div>
      </section>
      <section
        className="mt-20 border-t border-[var(--rule)] pt-10"
        aria-labelledby="guide-controls"
      >
        <h2 className="h2 mb-8" id="guide-controls">
          Shared controls
        </h2>
        <div className="flex flex-wrap gap-4">
          <Button>Primary action</Button>
          <Button variant="secondary">Secondary action</Button>
          <Button variant="ghost">Ghost action</Button>
          <Button disabled>Unavailable</Button>
        </div>
        <p className="mt-6 text-[var(--mid)]">
          Links and buttons share the same recipe, focus ring and press feedback.
        </p>
      </section>
      <section className="mt-20 border-t border-[var(--rule)] pt-10" aria-labelledby="guide-proof">
        <h2 className="h2 mb-8" id="guide-proof">
          Show the work
        </h2>
        <div className="hero-statement-main">
          <ActivityStream {...homeActivity} />
          <div>
            <HeroArtwork />
          </div>
        </div>
        <p className="mt-6 text-[var(--mid)]">
          Hollow marks identify people. Filled signal marks identify system actions. The labeled
          flow follows the same language.
        </p>
      </section>
      <section className="mt-20 border-t border-[var(--rule)] pt-10" aria-labelledby="guide-modes">
        <h2 className="h2 mb-8" id="guide-modes">
          Modes of work
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {ADMIN_APPEARANCES.map((mode) => (
            <article key={mode.id} className="border-t border-[var(--rule)] pt-5">
              <h3 className="h3">{mode.label}</h3>
              <p className="mt-3 text-[var(--mid)]">{mode.description}</p>
            </article>
          ))}
        </div>
        <Link href="/demo/command-center" className="btn mt-8">
          Try the modes in the fictional demo
        </Link>
      </section>
    </div>
  );
}
