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
    default:
      throw new Error(`Website template unavailable: ${section.template}`);
  }
}
