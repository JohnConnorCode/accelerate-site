import type { DemoScenarioPack } from "./scenarios";
import type { RadarAssessment } from "@/lib/revenue-os/radar-ranking-contract";
import { RADAR_FACTORS } from "@/lib/revenue-os/radar-ranking-contract";
import type {
  RadarOpportunityView,
  RadarSourceView,
  RadarPacketView,
} from "@/lib/revenue-os/radar-workspace-contract";
export type DemoRadarSource = RadarSourceView & {
  body_text: string;
  contentKey: string;
  author?: string;
  unavailable?: boolean;
};
export type DemoRadarOpportunity = RadarOpportunityView & { updated_at: string };
export type DemoRadarAssessment = {
  id: string;
  opportunity_id: string;
  opportunity_revision: number;
  assessment: RadarAssessment;
  source_snapshots: Array<{ id: string; revision: number; verification: string }>;
  created_at: string;
};
export type DemoRadarReceipt = {
  id: string;
  operation: string;
  entity_id: string;
  operation_key: string;
  inputKey: string;
  actor_email: string;
  created_at: string;
  after_state: Record<string, unknown>;
};
export type DemoRadarState = {
  sources: DemoRadarSource[];
  opportunities: DemoRadarOpportunity[];
  citations: Record<string, Array<{ revision: number; links: RadarPacketView["citations"] }>>;
  assessments: DemoRadarAssessment[];
  assets: Array<{
    id: string;
    opportunityId: string;
    kind: string;
    title: string;
    body_text: string;
    state: string;
    sourceVersionIds: string[];
  }>;
  outcomes: Array<{
    id: string;
    opportunityId: string;
    kind: string;
    description: string;
    verification: string;
  }>;
  history: DemoRadarReceipt[];
  briefs: Record<string, { inputKey: string; bodyText: string }>;
  restrictedContactIds: string[];
};
const id = (group: number, index: number) =>
  `00000000-0000-4000-${group}-${String(index + 1).padStart(12, "0")}`;
/** Authored fictional records; every scenario uses the same transport and selection rules. */
export function seedRadar(pack: DemoScenarioPack): DemoRadarState {
  const topics = [
    "workshop",
    "podcast",
    "newsletter",
    "research",
    "association",
    "workshop",
    "public-affairs",
    "stale-source",
    "unavailable-source",
    "relationship-review",
  ];
  const titles = [
    "Partner workshop invitation",
    "Guest interview opportunity",
    "Newsletter contribution request",
    "Original research collaboration",
    "Association speaker invitation",
    "Second angle on the workshop",
    "Neutral public-affairs source review",
    "A corrected source needs review",
    "Source text is temporarily unavailable",
    "A contact restriction needs attention",
  ];
  const at = new Date().toISOString();
  const sources: DemoRadarSource[] = titles.map((title, i) => ({
    id: id(9100, i),
    source_id: id(9200, i),
    title,
    version: 1,
    revision: 2,
    verification: i === 7 ? "retracted" : i === 8 ? "supplied" : "verified",
    canonicalUrl: `https://${pack.id}.example/radar/${i + 1}`,
    published_at: at,
    body_text:
      i === 6
        ? "Fictional public policy forum: retain neutral source material for manual review. No position or participant is ranked."
        : `Fictional source for ${pack.name}: ${title}. A professional organization is exploring a practical collaboration and asks for a short outline of relevant experience. No booking, coverage or independent recognition is confirmed. ` +
          (i === 0
            ? "This source is fictional and exists to demonstrate source reading, review and citation history. ".repeat(
                30,
              )
            : ""),
    contentKey: `fixture-${i}`,
    unavailable: i === 8,
  }));
  const opportunities: DemoRadarOpportunity[] = titles.map((title, i) => ({
    id: id(9300, i),
    title,
    summary: `${title} could let ${pack.name} contribute useful professional knowledge. Review the supplied evidence and the relationship before making an offer.`,
    recommended_action:
      i === 6
        ? "Read the cited material without scoring public positions"
        : i === 9
          ? "Review the canonical contact restriction before planning any outreach"
          : "Prepare a concise outline of the useful contribution and review it with the owner",
    kind: i === 1 ? "appearance" : i === 2 ? "media" : "partnership",
    state: "needs_review",
    revision: i === 0 ? 3 : 2,
    evidence_revision: 1,
    contact_id: pack.people[i % pack.people.length]!.id,
    company_id: null,
    updated_at: at,
  }));
  const citations = Object.fromEntries(
    opportunities.map((o, i) => [
      o.id,
      [
        {
          revision: 1,
          links: [
            {
              source_version_id: sources[i]!.id,
              observation:
                i === 6
                  ? "A public-affairs source needs neutral manual review"
                  : "The supplied announcement asks for a practical contribution; no agreement is confirmed",
              evidence_id: null,
            },
          ],
        },
      ],
    ]),
  );
  const assessments: DemoRadarAssessment[] = opportunities
    .filter((_, i) => i !== 9)
    .map((o, i) => ({
      id: id(9400, i),
      opportunity_id: o.id,
      opportunity_revision: o.revision,
      assessment: {
        classification: i === 6 ? "public_affairs" : "business",
        classificationReason:
          i === 6
            ? "Public-affairs source material stays in manual review"
            : "A professional knowledge-sharing collaboration",
        topicKey: topics[i]!,
        estimates: Object.fromEntries(
          RADAR_FACTORS.map((key) => [
            key,
            {
              value: i === 6 ? null : 92 - i * 3,
              confidence: "medium",
              rationale: "Fictional operator estimate from the supplied announcement",
              sourceVersionIds: [sources[i]!.id],
            },
          ]),
        ) as RadarAssessment["estimates"],
        effort: 2,
        timeToValue: "week",
        nextAction: o.recommended_action,
        alternatives: ["Ask for more context before preparing an outline"],
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
      source_snapshots: [{ id: sources[i]!.id, revision: 2, verification: "verified" }],
      created_at: at,
    }));
  return {
    sources,
    opportunities,
    citations,
    assessments,
    assets: [
      {
        id: id(9500, 0),
        opportunityId: opportunities[0]!.id,
        kind: "brief",
        title: "Workshop outline: fictional draft",
        body_text: `Draft for ${pack.name}: explain the practical skill, propose a short interactive exercise and ask the partner to review the format. This is not a sent invitation.`,
        state: "draft",
        sourceVersionIds: [sources[0]!.id],
      },
    ],
    outcomes: [],
    history: opportunities.map((o, i) => ({
      id: id(9600, i),
      operation: i === 0 ? "add_asset" : "transition_opportunity",
      entity_id: o.id,
      operation_key: id(9700, i),
      inputKey: "fixture",
      actor_email: pack.tenant.founder.email,
      created_at: at,
      after_state: { id: o.id, revision: o.revision },
    })),
    briefs: {},
    restrictedContactIds: [pack.people[9]!.id],
  };
}
