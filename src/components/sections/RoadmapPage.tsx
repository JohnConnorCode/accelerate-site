import Link from "next/link";
import { Section, Container, Eyebrow, Heading } from "@/components/v2/studio/primitives";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { featureBacklog } from "../../../scripts/feature-backlog-data.mjs";
import { FEATURE_STATUS_META, type FeatureStatus } from "@/lib/feature-board";

interface RoadmapCard {
  seed_key: string;
  title: string;
  description: string;
  status: FeatureStatus;
  priority: "urgent" | "high" | "medium" | "low";
  labels: string[];
  acceptance_criteria: string;
}

const STATUS_ORDER: FeatureStatus[] = ["in_progress", "planned", "blocked", "backlog", "shipped"];

function acceptanceLines(card: RoadmapCard): string[] {
  return card.acceptance_criteria
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

function categoryLabel(card: RoadmapCard): string | null {
  const category = card.labels.find((label) => label.startsWith("category:"));
  return category ? category.slice("category:".length) : null;
}

function RoadmapCardRow({ card }: { card: RoadmapCard }) {
  const category = categoryLabel(card);
  return (
    <div className="rounded-[20px] border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] p-6">
      <div className="flex flex-wrap items-center gap-2">
        {category && (
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted">
            {category}
          </span>
        )}
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted">
          {card.priority}
        </span>
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold tracking-[-0.02em] text-heading">
        {card.title}
      </h3>
      <p className="mt-2 text-sm text-body">{card.description}</p>
      <ul className="mt-4 space-y-1.5">
        {acceptanceLines(card).map((line) => (
          <li key={line} className="flex gap-2 text-sm text-body">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RoadmapPageContent() {
  const cards = featureBacklog as RoadmapCard[];
  const byStatus = new Map<FeatureStatus, RoadmapCard[]>();
  for (const card of cards) {
    const list = byStatus.get(card.status) ?? [];
    list.push(card);
    byStatus.set(card.status, list);
  }

  return (
    <>
      <Section width="wide" className="pt-32 sm:pt-40">
        <AnimateOnScroll as="div">
          <Eyebrow>Roadmap</Eyebrow>
          <Heading size={1} as="h1" className="mt-4 max-w-3xl">
            What&apos;s shipped, in progress, and planned next.
          </Heading>
          <p className="mt-6 max-w-2xl text-lg text-body">
            This is generated from{" "}
            <Link
              href="https://github.com/JohnConnorCode/accelerate-site/blob/main/scripts/feature-backlog-data.mjs"
              className="underline"
            >
              scripts/feature-backlog-data.mjs
            </Link>
            , the same file the app reads. Every card here carries its own acceptance criteria;
            nothing on this page is summarized or reworded from the source.
          </p>
        </AnimateOnScroll>
      </Section>

      {STATUS_ORDER.map((status) => {
        const list = byStatus.get(status);
        if (!list?.length) return null;
        const meta = FEATURE_STATUS_META[status];
        return (
          <Section key={status} width="wide" divide>
            <AnimateOnScroll as="div">
              <Eyebrow>
                {meta.label} · {list.length}
              </Eyebrow>
              <p className="mt-2 max-w-xl text-sm text-white-muted">{meta.description}</p>
            </AnimateOnScroll>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {list.map((card) => (
                <RoadmapCardRow key={card.seed_key} card={card} />
              ))}
            </div>
          </Section>
        );
      })}

      <Section width="wide" divide>
        <Container width="narrow">
          <p className="text-sm text-white-muted">
            Extend this manifest to propose new work; don&apos;t start a second roadmap in a fork.
            See{" "}
            <Link href="/open-source" className="underline">
              Open Source
            </Link>{" "}
            for how to contribute.
          </p>
        </Container>
      </Section>
    </>
  );
}
