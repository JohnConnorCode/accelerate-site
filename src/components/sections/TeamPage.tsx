"use client";

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
import { TEAM_MEMBERS } from "@/content/team";
import { TeamGrid } from "@/components/team/TeamCard";

export function TeamPageContent() {
  return (
    <>
      <PublicHeroEntrance className="page-offset-roomy relative overflow-hidden pb-20">
        <Container width="wide">
          <div className="max-w-3xl">
            <HeroEntranceItem step={1}>
              <Eyebrow className="mb-7">the team</Eyebrow>
            </HeroEntranceItem>
            <HeroEntranceItem step={2}>
              <RevealHeading
                as="h1"
                className={HERO_HEADING}
                lead="Operators and advisors"
                accent="behind the work."
                entrance="parent"
              />
            </HeroEntranceItem>
            <HeroEntranceItem step={3}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                Operators who build and run AI systems for real businesses, backed
                by advisors who have done it at serious scale.
              </p>
            </HeroEntranceItem>
          </div>
        </Container>
      </PublicHeroEntrance>

      <Section width="wide" divide>
        <TeamGrid members={TEAM_MEMBERS} />
      </Section>

      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">work with us</Eyebrow>
            <Heading size={1} as="h2">
              Meet us on a call.
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Thirty minutes about how the business works and where AI or automation
              may be useful.
            </p>
            <BookCallButton location="team" />
            <CallTerms />
          </div>
        </div>
      </Section>
    </>
  );
}
