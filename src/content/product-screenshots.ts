import type { WorkImage } from "./work";

export type ProductScreenshot = WorkImage & {
  /** The exact demo scenario/route this screenshot was captured from, so a
      viewer can jump straight into the live, interactive version. */
  demoHref: string;
};

/** Real screenshots of the real demo, not mockups: seven screens across five
    fictional businesses and five of the product's built-in appearances.
    Shared between the Open Source page and the Command Center page so
    both draw on one source of truth instead of maintaining separate
    screenshot sets. Use a new filename when refreshing a screenshot so
    previously optimized images cannot hide an interface update. */
export const PRODUCT_SCREENSHOTS: ProductScreenshot[] = [
  {
    kind: "image",
    src: "/images/open-source/slide-today-paper-20261010-review.png",
    alt: "Today, with sales, customer follow-up, delivery and billing reviews in the Paper appearance for a fictional roofing business.",
    caption: "Today · Paper theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/northline-roofing/today",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-pipeline-night-20261010.png",
    alt: "Pipeline, a nine-stage opportunity board, in the Night appearance for a fictional law firm.",
    caption: "Pipeline · Night theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/alder-ridge-law/pipeline",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-conversations-paper-20261010.png",
    alt: "Conversations, a linked reply-ready inbox, in the Paper appearance for a fictional roofing business.",
    caption: "Conversations · Paper theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/northline-roofing/conversations",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-collections-night.png",
    alt: "Collections, with unpaid invoice balances and payment follow-up for a fictional law firm, in the Night appearance.",
    caption: "Collections · Night theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/alder-ridge-law/collections",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-delivery-signal.png",
    alt: "Client onboarding, preparing owned delivery tasks from a won opportunity for a fictional advisory firm, in the Signal appearance.",
    caption: "Client onboarding · Signal theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/ledgerstone-advisory/client-onboarding",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-website-studio.png",
    alt: "Website and pages, with fictional real estate content ready to edit and preview, in the Studio appearance.",
    caption: "Website & pages · Studio theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/hearthline-realty/site",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-ai-frost-20261010.png",
    alt: "The AI workspace, grounded chat with visible evidence, in the Frost appearance for a fictional nonprofit network.",
    caption: "AI Workspace · Frost theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/common-table-network/ai",
  },
];
