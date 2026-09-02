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
/** Only the two smallest, most immediately relevant buckets (what's being
 *  built right now, and what's stuck) stay fully expanded by default. The
 *  rest are one click away, never hidden, just not forced on every visitor
 *  before they can reach anything else. */
const COLLAPSIBLE_STATUSES = new Set<FeatureStatus>(["backlog", "shipped", "planned"]);

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

function RoadmapCardBody({ card }: { card: RoadmapCard }) {
  return (
    <>
      <p className="mt-2 text-sm text-body">{card.description}</p>
      <ul className="mt-4 space-y-1.5">
        {acceptanceLines(card).map((line) => (
          <li key={line} className="flex gap-2 text-sm text-body">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
            {line}
          </li>
        ))}
      </ul>
    </>
  );
}

function RoadmapCardHeader({ card }: { card: RoadmapCard }) {
  const category = categoryLabel(card);
  return (
    <>
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
    </>
  );
}

/**
 * `collapsible` is for statuses with no natural size limit (today: backlog,
 * 92 cards and growing, and shipped, the project's full shipped history).
 * Rendering those in full, unconditionally, is what made this page tens of
 * thousands of pixels tall the moment the backlog carried more than a
 * handful of entries — every card's full description and every acceptance
 * line, all expanded, all the time. Collapsing behind <details> keeps every
 * word reachable (nothing is summarized or reworded, matching this page's
 * own stated promise) without forcing a visitor to scroll past all of it to
 * reach anything else.
 */
function RoadmapCardRow({ card, collapsible }: { card: RoadmapCard; collapsible: boolean }) {
  const className =
    "rounded-[20px] border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] p-6";
  if (!collapsible) {
    return (
      <div className={className}>
        <RoadmapCardHeader card={card} />
        <RoadmapCardBody card={card} />
      </div>
    );
  }
  return (
    <details className={`group ${className}`}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <RoadmapCardHeader card={card} />
      </summary>
      <p className="mt-2 text-xs text-white-muted group-open:hidden">
        Full description and acceptance criteria →
      </p>
      <div className="hidden group-open:block">
        <RoadmapCardBody card={card} />
      </div>
    </details>
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
                <RoadmapCardRow
                  key={card.seed_key}
                  card={card}
                  collapsible={COLLAPSIBLE_STATUSES.has(status)}
                />
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
