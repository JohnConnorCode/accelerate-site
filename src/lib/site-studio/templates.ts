import type { SiteDocument } from "./document";
import {
  SITE_DOCUMENT_SCHEMA_VERSION,
  SITE_DOCUMENT_ENGINE,
  SITE_DOCUMENT_ENGINE_VERSION,
} from "./document";
import { SITE_ASSET_CATALOG } from "./assets";

/** Built-in service page template: the template-first default when AI
 * generation is unavailable, and the structural starting point AI patches
 * against. Copy is neutral and fixture-free; operators edit it. */

export interface ServiceBrief {
  serviceName: string;
  audience: string;
  outcome: string;
  contactHref?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function servicePageSlug(serviceName: string): string {
  return slugify(serviceName) || "service";
}

export function servicePageTemplate(brief: ServiceBrief): SiteDocument {
  const slug = servicePageSlug(brief.serviceName);
  const heroAsset = SITE_ASSET_CATALOG.find((asset) => asset.kind === "hero")?.id;
  const contactHref = brief.contactHref ?? "/contact";
  return {
    schemaVersion: SITE_DOCUMENT_SCHEMA_VERSION,
    engine: SITE_DOCUMENT_ENGINE,
    engineVersion: SITE_DOCUMENT_ENGINE_VERSION,
    root: [
      {
        id: "hero",
        type: "section",
        styles: { background: "surface", paddingTop: "lg", paddingBottom: "lg" },
        children: [
          {
            id: "hero-main",
            type: "hero",
            props: {
              variant: "split",
              eyebrow: brief.audience,
              heading: brief.serviceName,
              body: brief.outcome,
              primaryCta: { label: "Start a conversation", href: contactHref },
              ...(heroAsset ? { assetId: heroAsset } : {}),
              theme: "light",
            },
          },
        ],
      },
      {
        id: "what-you-get",
        type: "section",
        styles: { paddingTop: "md", paddingBottom: "md" },
        children: [
          {
            id: "what-you-get-grid",
            type: "featureGrid",
            props: {
              title: "What you get",
              items: [
                { title: "Defined scope", body: "A written scope with a fixed starting point." },
                { title: "Named owner", body: "One person accountable for delivery." },
                { title: "Visible progress", body: "Updates you can inspect while work runs." },
              ],
            },
          },
        ],
      },
      {
        id: "questions",
        type: "section",
        styles: { background: "surface", paddingTop: "md", paddingBottom: "md" },
        children: [
          {
            id: "questions-faq",
            type: "faq",
            props: {
              title: "Common questions",
              items: [
                {
                  question: "How do we start?",
                  answer:
                    "With a conversation about the outcome you want and the work consuming your team.",
                },
                {
                  question: "What do you need from us?",
                  answer: "Access to the people doing the work and the systems it runs through.",
                },
              ],
            },
          },
        ],
      },
      {
        id: "next-step",
        type: "section",
        styles: { paddingTop: "md", paddingBottom: "lg" },
        children: [
          {
            id: "next-step-cta",
            type: "ctaBand",
            props: {
              heading: `Talk about ${brief.serviceName}`,
              body: brief.outcome,
              cta: { label: "Start a conversation", href: contactHref },
            },
          },
        ],
      },
    ],
    metadata: {
      title: brief.serviceName,
      slug,
      description: `${brief.serviceName} for ${brief.audience}: ${brief.outcome}`.slice(0, 300),
    },
  };
}
