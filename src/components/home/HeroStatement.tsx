"use client";

import Link from "next/link";
import { homeStatementContent } from "@/content/site-studio/home";
import type { HomeStatementContent } from "@/lib/site-studio/native-templates";
import { Reveal } from "./reveal";

/** The original hero explanation, held for the next scroll beat. */
export function HeroStatement({
  content = homeStatementContent,
}: {
  content?: HomeStatementContent;
}) {
  return (
    <Reveal sequence as="section" className="hero-statement">
      <div className="wrap hero-statement-layout">
        <div className="hero-statement-aside">
          <p className="label" data-home-step="0">
            {content.eyebrow}
          </p>
          <nav aria-label="Explore the homepage" className="home-section-links" data-home-step="3">
            <Link href={content.systemsHref}>
              {content.systemsLabel} <span aria-hidden="true">↓</span>
            </Link>
            <Link href={content.workHref}>
              {content.workLabel} <span aria-hidden="true">↓</span>
            </Link>
            <Link href={content.productHref}>
              {content.productLabel} <span aria-hidden="true">↓</span>
            </Link>
          </nav>
        </div>
        <div>
          <p className="hero-statement-copy" data-home-step="1">
            {content.heading}
          </p>
          <p className="hero-statement-detail" data-home-step="2">
            {content.body}
          </p>
        </div>
      </div>
    </Reveal>
  );
}
