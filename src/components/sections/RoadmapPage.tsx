import { Suspense } from "react";
import Link from "next/link";
import { Section, Eyebrow, Heading } from "@/components/v2/studio/primitives";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { featureBacklog } from "../../../scripts/feature-backlog-data.mjs";
import { buildDependencyGraph } from "../../../scripts/lib/feature-board-graph.mjs";
import { parseAcceptanceLines, type FeaturePriority, type FeatureStatus } from "@/lib/feature-board";
import { type PublicRoadmapCard } from "@/lib/roadmap";
import { RoadmapExplorer, RoadmapExplorerFromUrl } from "@/components/sections/RoadmapExplorer";

interface ManifestCard {
  seed_key: string;
  title: string;
  description: string;
  status: FeatureStatus;
  priority: FeaturePriority;
  labels: string[];
  notes: string;
  acceptance_criteria: string;
}

function loadPublicRoadmapCards(): PublicRoadmapCard[] {
  const cards = featureBacklog as ManifestCard[];
  const graph = buildDependencyGraph(cards);
  return cards.map((card) => {
    const depKeys = graph.edges.get(card.seed_key) ?? [];
    const ready =
      (card.status === "backlog" || card.status === "planned") &&
      depKeys.every((key: string) => graph.byKey.get(key)?.status === "shipped");
    return {
      seedKey: card.seed_key,
      title: card.title,
      description: card.description,
      status: card.status,
      priority: card.priority,
      category: card.labels.find((label) => label.startsWith("category:"))?.slice("category:".length) ?? null,
      capabilities: card.labels
        .filter((label) => label.startsWith("capability:"))
        .map((label) => label.slice("capability:".length)),
      acceptance: parseAcceptanceLines(card.acceptance_criteria),
      ready,
    };
  });
}

export function RoadmapPageContent() {
  const cards = loadPublicRoadmapCards();

  return (
    <Section width="wide" className="page-offset-roomy pb-24">
      <AnimateOnScroll as="div">
        <Eyebrow>Roadmap</Eyebrow>
        <Heading size={2} as="h1" className="mt-4 max-w-3xl leading-[1.04]">
          What&apos;s shipped, in progress, and <span className="display-italic">planned</span> next.
        </Heading>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white-secondary">
          Generated from{" "}
          <Link
            href="https://github.com/JohnConnorCode/accelerate-site/blob/main/scripts/feature-backlog-data.mjs"
            className="underline underline-offset-4"
          >
            scripts/feature-backlog-data.mjs
          </Link>
          , the same file the app reads. Search it, filter it, and open any card for its acceptance
          criteria. Nothing here is summarized or reworded from the source.
        </p>
        <p className="mt-4 max-w-2xl text-sm text-white-muted">
          Cards marked Ready have every declared dependency shipped, so they can be picked up without
          waiting on other work. A curated subset is also mirrored to{" "}
          <Link
            href="https://github.com/JohnConnorCode/accelerate-site/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22"
            className="underline underline-offset-4"
          >
            GitHub Issues labeled help wanted
          </Link>
          .
        </p>
      </AnimateOnScroll>

      <Suspense fallback={<RoadmapExplorer cards={cards} />}>
        <RoadmapExplorerFromUrl cards={cards} />
      </Suspense>

      <p className="mt-16 max-w-2xl text-sm text-white-muted">
        Extend this manifest to propose new work. Do not start a second roadmap in a fork. See{" "}
        <Link href="/open-source" className="underline underline-offset-4">
          Open Source
        </Link>{" "}
        for how to contribute.
      </p>
    </Section>
  );
}
