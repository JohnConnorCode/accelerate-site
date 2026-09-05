"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Linkedin } from "lucide-react";
import { HeroEntranceItem, PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import {
  Section,
  Container,
  Eyebrow,
  Heading,
  BookCallButton,
  CallTerms,
} from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
import { TEAM_MEMBERS, getTeamMember } from "@/content/team";
import { TeamCard } from "@/components/team/TeamCard";
import { Reveal, FadeImage } from "@/components/team/TeamReveal";

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

export function TeamBioContent({ slug }: { slug: string }) {
  const member = getTeamMember(slug);
  if (!member) return null;
  const index = TEAM_MEMBERS.findIndex((m) => m.slug === slug);
  const prev = index > 0 ? TEAM_MEMBERS[index - 1] : null;
  const next = index >= 0 && index < TEAM_MEMBERS.length - 1 ? TEAM_MEMBERS[index + 1] : null;

  return (
    <>
      <PublicHeroEntrance className="page-offset-roomy relative overflow-hidden pb-20">
        <Container width="wide">
          <HeroEntranceItem step={1}>
            <Link
              href="/team"
              className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white-muted transition-colors hover:text-heading"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All team members
            </Link>
          </HeroEntranceItem>
          <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <HeroEntranceItem step={2} className="mx-auto w-full max-w-sm lg:mx-0">
              <div className="relative">
                <span
                  className="pointer-events-none absolute -right-4 -top-6 select-none font-display text-[7rem] font-extrabold leading-none text-[color-mix(in_srgb,var(--fg)_8%,transparent)]"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {member.portraitShape === "circle" ? (
                  <div className="team-card-float relative mx-auto aspect-square w-full overflow-hidden rounded-full ring-1 ring-[color-mix(in_srgb,var(--fg)_16%,transparent)]">
                    <FadeImage
                      src={member.image}
                      alt={member.imageAlt}
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      priority
                      className="[&>img]:h-full [&>img]:w-full [&>img]:object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute -left-3 -top-3 h-full w-full border border-[color-mix(in_srgb,var(--fg)_25%,transparent)]" aria-hidden="true" />
                    <div className="team-card-float relative aspect-[4/5] overflow-hidden bg-[var(--bg-subtle)] motion-reduce:transform-none">
                      <FadeImage
                        src={member.image}
                        alt={member.imageAlt}
                        sizes="(max-width: 1024px) 100vw, 40vw"
                        priority
                        className="[&>img]:h-full [&>img]:w-full [&>img]:object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            </HeroEntranceItem>
            <div className="min-w-0">
              <HeroEntranceItem step={2}>
                <Eyebrow className="mb-5">{member.role}</Eyebrow>
              </HeroEntranceItem>
              <HeroEntranceItem step={3}>
                <RevealHeading
                  as="h1"
                  className={HERO_HEADING}
                  lead={member.name}
                  entrance="parent"
                />
              </HeroEntranceItem>
              <HeroEntranceItem step={4}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-white-secondary">
                  {member.summary}
                </p>
                {member.linkedin && (
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-heading"
                  >
                    <Linkedin className="h-4 w-4" aria-hidden="true" />
                    Connect on LinkedIn
                  </a>
                )}
              </HeroEntranceItem>
            </div>
          </div>
        </Container>
      </PublicHeroEntrance>

      <Section width="text" divide>
        <div className="flex flex-col gap-6">
          {member.bio.map((paragraph, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <p className="text-base leading-relaxed text-white-secondary">{paragraph}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {member.highlights.length > 0 && (
        <Section width="text" divide>
          <Eyebrow className="mb-8">highlights</Eyebrow>
          <ol className="flex flex-col">
            {member.highlights.map((highlight, i) => (
              <Reveal key={highlight} delay={Math.min(i, 3) * 0.06}>
                <li className="group flex items-baseline gap-5 border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-5 transition-colors last:border-b hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]">
                  <span className="font-mono text-[0.62rem] tracking-[0.2em] text-white-muted transition-colors group-hover:text-heading" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-base leading-relaxed text-white-primary">{highlight}</span>
                </li>
              </Reveal>
            ))}
          </ol>
        </Section>
      )}

      {(prev || next) && (
        <Section width="wide" divide>
          <div className="grid gap-4 sm:grid-cols-2">
            {prev ? (
              <Reveal>
                <Link
                  href={`/team/${prev.slug}`}
                  rel="prev"
                  className="team-card-float group flex h-full items-center gap-4 border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] bg-[var(--bg)] p-4 motion-reduce:transform-none"
                >
                  <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <FadeImage
                      src={prev.image}
                      alt=""
                      sizes="64px"
                      className="saturate-[0.85] transition-all duration-500 group-hover:scale-[1.08] group-hover:saturate-100 motion-reduce:transition-none [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
                    />
                  </span>
                  <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
                  <span>
                    <span className="block font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted">
                      Previous
                    </span>
                    <span className="block font-display text-lg font-bold text-heading">
                      {prev.name}
                    </span>
                  </span>
                </Link>
              </Reveal>
            ) : (
              <span />
            )}
            {next && (
              <Reveal delay={0.08}>
                <Link
                  href={`/team/${next.slug}`}
                  rel="next"
                  className="team-card-float group flex h-full items-center justify-end gap-4 border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] bg-[var(--bg)] p-4 text-right motion-reduce:transform-none"
                >
                  <span>
                    <span className="block font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted">
                      Next{next.group === "Advisors" ? " advisor" : ""}
                    </span>
                    <span className="block font-display text-lg font-bold text-heading">
                      {next.name}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
                  <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <FadeImage
                      src={next.image}
                      alt=""
                      sizes="64px"
                      className="saturate-[0.85] transition-all duration-500 group-hover:scale-[1.08] group-hover:saturate-100 motion-reduce:transition-none [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
                    />
                  </span>
                </Link>
              </Reveal>
            )}
          </div>
        </Section>
      )}

      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">work with us</Eyebrow>
            <Heading size={1} as="h2">
              Work with {firstName(member.name)}&apos;s team.
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Thirty minutes about how the business works and where AI or automation
              may be useful.
            </p>
            <BookCallButton location="team-bio" />
            <CallTerms />
          </div>
        </div>
      </Section>

      {TEAM_MEMBERS.length > 1 && (
        <Section width="wide" divide>
          <Eyebrow className="mb-8">the rest of the team</Eyebrow>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM_MEMBERS.filter((m) => m.slug !== slug)
              .slice(0, 3)
              .map((other, i) => (
                <TeamCard key={other.slug} member={other} index={i} />
              ))}
          </div>
        </Section>
      )}
    </>
  );
}
