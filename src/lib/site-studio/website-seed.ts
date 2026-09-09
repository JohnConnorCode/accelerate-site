import { tenant } from "@/config/tenant";
import { nativeTemplateDefaults } from "./native-templates";
import { parseWebsiteDocument } from "./website-document";
import { marketingPositioning } from "@/content/marketing-positioning";

export const homeSectionOrder = [
  "home-hero",
  "home-statement",
  "home-marquee",
  "home-systems",
  "home-trades",
  "home-command-center",
  "home-process",
  "home-plan",
  "home-work",
  "home-who",
  "home-faq",
  "home-final-cta",
] as const;

/** Local content only: importing this seed cannot reach the original installation. */
export function createBundledWebsite() {
  return parseWebsiteDocument({
    schemaVersion: 1,
    identity: { name: tenant.brand.name, tagline: marketingPositioning.shortOffer },
    navigation: [],
    footer: { text: "", links: [] },
    theme: {
      accent: "#d8b36a",
      background: "#fbfbfa",
      foreground: "#0b0b0b",
      font: "installation",
      radius: "soft",
    },
    assets: [],
    collections: [],
    pages: [
      {
        id: "home",
        path: "/",
        metadata: {
          title: `${tenant.brand.name} | Custom AI Strategy, Solutions & Execution`,
          description: marketingPositioning.shortOffer,
          noIndex: false,
        },
        content: {
          kind: "native",
          sections: homeSectionOrder.map((template) => ({
            id: template,
            template,
            fields: structuredClone(nativeTemplateDefaults[template]),
            hidden: false,
          })),
        },
      },
    ],
  });
}
