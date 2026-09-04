"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { TeamMember } from "@/content/team";
import { Reveal, FadeImage } from "@/components/team/TeamReveal";
import { cn } from "@/lib/utils";

/**
 * One team member card for the /team index. Uniform circular portraits so
 * mixed headshots read as one deliberate set, on a floating card that lifts
 * with a deepening shadow on hover and focus like the hero demo decks.
 * Entrance is a real scroll reveal (staggered per card), the portrait blooms
 * from slightly desaturated to full color with a slow zoom, and the name
 * gets an underline sweep. The whole card links to the bio page, with a
 * focus ring for keyboard users.
 */
export function TeamCard({ member, index = 0 }: { member: TeamMember; index?: number }) {
  return (
    <Reveal delay={(index % 4) * 0.12}>
      <Link
        href={`/team/${member.slug}`}
        className="team-card-float group relative flex h-full flex-col items-center border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] bg-[var(--bg)] px-6 pb-7 pt-10 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg)] focus-visible:ring-offset-4 motion-reduce:transform-none"
        aria-label={`${member.name}, ${member.role}. Read bio.`}
      >
        <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 font-mono text-[0.62rem] tracking-[0.3em] text-white-muted/70 transition-colors duration-300 group-hover:text-white-muted" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="relative mt-4 block h-44 w-44 overflow-hidden rounded-full bg-[var(--bg-subtle)] ring-1 ring-[color-mix(in_srgb,var(--fg)_16%,transparent)] transition-all duration-500 ease-out group-hover:ring-2 group-hover:ring-[color-mix(in_srgb,var(--fg)_45%,transparent)] group-focus-visible:ring-2 group-focus-visible:ring-[color-mix(in_srgb,var(--fg)_45%,transparent)] sm:h-52 sm:w-52 motion-reduce:transition-none">
          <FadeImage
            src={member.image}
            alt={member.imageAlt}
            sizes="208px"
            className="saturate-[0.88] transition-all duration-700 ease-out group-hover:scale-[1.06] group-hover:saturate-100 group-focus-visible:scale-[1.06] group-focus-visible:saturate-100 motion-reduce:transition-none [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
          />
        </span>
        <h3 className="mt-5 font-display text-[1.7rem] font-bold tracking-[-0.01em] text-heading">
          <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_2px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 ease-out group-hover:bg-[length:100%_2px] group-focus-visible:bg-[length:100%_2px] motion-reduce:transition-none">
            {member.name}
          </span>
        </h3>
        <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white-muted">
          {member.role}
        </p>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-white-secondary">
          {member.summary}
        </p>
        <span className="mt-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-heading">
          Read bio
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45 motion-reduce:transition-none" strokeWidth={2} aria-hidden="true" />
        </span>
      </Link>
    </Reveal>
  );
}

/**
 * The /team grid. Two-by-two on desktop so each card gets room and the
 * second row reveals on scroll rather than with the first. Stagger is
 * handled per-card.
 */
export function TeamGrid({ members }: { members: TeamMember[] }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-x-6 gap-y-14 sm:grid-cols-2">
      {members.map((member, i) => (
        <TeamCard key={member.slug} member={member} index={i} />
      ))}
    </div>
  );
}

/**
 * Compact strip used on /about to point at the full page. Circle portraits
 * render round here too, so the strip matches the grid.
 */
export function TeamPreviewStrip({ members }: { members: TeamMember[] }) {
  const shown = members.slice(0, 4);
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {shown.map((member, i) => (
        <Reveal key={member.slug} delay={i * 0.07}>
          <Link
            href={`/team/${member.slug}`}
            className="team-card-float group block border border-[color-mix(in_srgb,var(--fg)_12%,transparent)] bg-[var(--bg)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg)] focus-visible:ring-offset-2 motion-reduce:transform-none"
            aria-label={`${member.name}, ${member.role}`}
          >
            <div
              className={cn(
                "relative aspect-square overflow-hidden bg-[var(--bg-subtle)]",
                member.portraitShape === "circle" && "rounded-full",
              )}
            >
              <FadeImage
                src={member.image}
                alt=""
                sizes="(max-width: 640px) 50vw, 25vw"
                className="saturate-[0.82] transition-all duration-700 ease-out group-hover:scale-[1.05] group-hover:saturate-100 motion-reduce:transition-none [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
              />
            </div>
            <p className="mt-3 font-display text-base font-bold text-heading">{member.name}</p>
            <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white-muted">
              {member.role}
            </p>
          </Link>
        </Reveal>
      ))}
      <Reveal delay={shown.length * 0.07} className="sm:col-span-2 lg:col-span-4">
        <Link
          href="/team"
          className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-heading"
        >
          Meet the whole team
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
        </Link>
      </Reveal>
    </div>
  );
}
