import type { WorkImage } from "./work";

export type ProductScreenshot = WorkImage & {
  /** The exact demo scenario/route this screenshot was captured from, so a
      viewer can jump straight into the live, interactive version. */
  demoHref: string;
};

/** Real screenshots of the real demo, not mockups: seven screens, seven
    fictional businesses, all five of the product's built-in appearances.
    Shared between the Open Source page and the Command Center page so
    both draw on one source of truth instead of maintaining separate
    screenshot sets. Recapture and replace in place if the UI changes
    enough to make one of these stale. */
export const PRODUCT_SCREENSHOTS: ProductScreenshot[] = [
  {
    kind: "image",
    src: "/images/open-source/slide-today-paper.png",
    alt: "Today, the operator priority queue and approval decisions, in the Paper appearance for a fictional roofing business.",
    caption: "Today · Paper theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/northline-roofing/today",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-pipeline-night.png",
    alt: "Pipeline, a nine-stage opportunity board, in the Night appearance for a fictional law firm.",
    caption: "Pipeline · Night theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/alder-ridge-law/pipeline",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-conversations-paper.png",
    alt: "Conversations, a linked reply-ready inbox, in the Paper appearance for a fictional roofing business.",
    caption: "Conversations · Paper theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/northline-roofing/conversations",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-revenue-night.png",
    alt: "Revenue, monthly recurring revenue and client value over time, in the Night appearance for a fictional law firm.",
    caption: "Revenue · Night theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/alder-ridge-law/revenue",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-features-signal.png",
    alt: "The Feature Board kanban, the same public roadmap system, in the Signal appearance for a fictional advisory firm.",
    caption: "Feature Board · Signal theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/ledgerstone-advisory/features",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-analytics-studio.png",
    alt: "Analytics, revenue facts and forecasts from canonical records, in the Studio appearance for a fictional real estate team.",
    caption: "Analytics · Studio theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/hearthline-realty/analytics",
  },
  {
    kind: "image",
    src: "/images/open-source/slide-ai-frost.png",
    alt: "The AI workspace, grounded chat with visible evidence, in the Frost appearance for a fictional nonprofit network.",
    caption: "AI Workspace · Frost theme",
    width: 1400,
    height: 875,
    presentation: "interface",
    demoHref: "/demo/command-center/common-table-network/ai",
  },
];
