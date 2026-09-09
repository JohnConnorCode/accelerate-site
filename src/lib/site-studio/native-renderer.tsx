import { CommandCenter } from "@/components/home/CommandCenter";
import { homeCommandCenterSchema } from "./native-templates";
import { HomeSelectedWork } from "@/components/home/HomeSelectedWork";
import { homeWorkSchema } from "./native-templates";
import { Plan } from "@/components/home/Plan";
import { homePlanSchema } from "./native-templates";
import { Trades } from "@/components/home/Trades";
import { homeTradesSchema } from "./native-templates";
import { Systems } from "@/components/home/Systems";
import { FinalCta } from "@/components/home/FinalCta";
import { homeSystemsSchema, homeFinalCtaSchema } from "./native-templates";
import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { HowWeWork } from "@/components/home/HowWeWork";
import { homeHeroSchema, homeMarqueeSchema, homeProcessSchema } from "./native-templates";
import { HeroStatement } from "@/components/home/HeroStatement";
import { Who } from "@/components/home/Who";
import { Faq } from "@/components/home/Faq";
import { homeStatementSchema, homeWhoSchema, homeFaqSchema } from "./native-templates";
import type { WebsitePage } from "./website-document";

type NativeSection = Extract<WebsitePage["content"], { kind: "native" }>["sections"][number];
/** Code-owned visual/interaction components receive content-only props. */
export function renderNativeWebsiteSection(section: NativeSection) {
  switch (section.template) {
    case "home-hero":
      return <Hero content={homeHeroSchema.parse(section.fields)} />;
    case "home-marquee":
      return <Marquee content={homeMarqueeSchema.parse(section.fields)} />;
    case "home-process":
      return <HowWeWork content={homeProcessSchema.parse(section.fields)} />;
    case "home-statement":
      return <HeroStatement content={homeStatementSchema.parse(section.fields)} />;
    case "home-who":
      return <Who content={homeWhoSchema.parse(section.fields)} />;
    case "home-faq":
      return <Faq content={homeFaqSchema.parse(section.fields)} />;
    case "home-systems":
      return <Systems content={homeSystemsSchema.parse(section.fields)} />;
    case "home-final-cta":
      return <FinalCta content={homeFinalCtaSchema.parse(section.fields)} />;
    case "home-trades":
      return <Trades content={homeTradesSchema.parse(section.fields)} />;
    case "home-plan":
      return <Plan content={homePlanSchema.parse(section.fields)} />;
    case "home-work":
      return <HomeSelectedWork content={homeWorkSchema.parse(section.fields)} />;
    case "home-command-center":
      return <CommandCenter content={homeCommandCenterSchema.parse(section.fields)} />;
    default:
      throw new Error(`Website template unavailable: ${section.template}`);
  }
}
