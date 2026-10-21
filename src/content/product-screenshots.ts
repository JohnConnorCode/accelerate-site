import type { WorkImage } from "./work";

export type ProductScreenshot = WorkImage & {
  /** The exact demo scenario/route this screenshot was captured from, so a
      viewer can jump straight into the live, interactive version. */
  demoHref: string;
};

/** Real screenshots of the demo: seven screens across five example businesses
    and the product's four built-in appearances.
    Shared between the Open Source page and the Command Center page so
    both draw on one source of truth instead of maintaining separate
    screenshot sets. Use a new filename when refreshing a screenshot so
    previously optimized images cannot hide an interface update. */
export const PRODUCT_SCREENSHOTS: ProductScreenshot[] = [
  {
    kind: "image",
    src: "/images/open-source/slide-today-accelerate-20261020-roadmap.png",
    alt: "Today, with customer priorities, delivery work and billing reviews in the Accelerate demo appearance.",
    caption: "Today · Accelerate theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/northline-roofing/today",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-pipeline-night-20261020-roadmap.png",
    alt: "Customer opportunities and next actions on the pipeline board in the Night demo appearance.",
    caption: "Pipeline · Night theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/alder-ridge-law/pipeline",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-conversations-paper-20261020-roadmap.png",
    alt: "Customer conversations and reply context in the Paper demo appearance.",
    caption: "Conversations · Paper theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/northline-roofing/conversations",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-collections-night-20261020-roadmap.png",
    alt: "Overdue invoices, customer context and payment follow-up in the Night demo appearance.",
    caption: "Collections · Night theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/alder-ridge-law/collections",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-delivery-operator-20261020-roadmap.png",
    alt: "Client onboarding tasks with owners and due dates in the Operator demo appearance.",
    caption: "Client onboarding · Operator theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/ledgerstone-advisory/client-onboarding",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-website-accelerate-20261020-roadmap.png",
    alt: "Website editing and page previews in the Accelerate demo appearance.",
    caption: "Website & pages · Accelerate theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/hearthline-realty/site",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-ai-paper-20261020-roadmap.png",
    alt: "The AI workspace with business context and source evidence in the Paper demo appearance.",
    caption: "AI Workspace · Paper theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/common-table-network/ai",
  },
];
