import { DEMO_BUSINESS_PROFILES, type DemoBusinessProfile } from "./business-profiles";
import type { TenantConfig } from "@/config/tenant";
import {
  ALDER_RIDGE_PROFILE,
  COMMON_TABLE_PROFILE,
  HEARTHLINE_PROFILE,
  LEDGERSTONE_PROFILE,
  NORTHLINE_PROFILE,
  type DemoScenarioContentProfile,
} from "./scenario-profiles";

export type DemoScenarioId =
  | "northline-roofing"
  | "alder-ridge-law"
  | "ledgerstone-advisory"
  | "hearthline-realty"
  | "common-table-network";
export type DemoAppearance = "light" | "dark" | "signal" | "studio" | "frost";

export interface DemoScenarioSummary {
  id: DemoScenarioId;
  name: string;
  category: string;
  description: string;
  accent: string;
  appearance: DemoAppearance;
  story: string[];
}

interface DemoPerson {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
}
interface DemoOpportunity {
  id: string;
  name: string;
  personId: string;
  company: string;
  stage: string;
  value: number;
  source: string;
  nextAction: string;
}
interface DemoConversation {
  id: string;
  personId: string;
  subject: string;
  intent: string;
  unread: number;
  messages: Array<{ id: string; direction: "inbound" | "outbound"; body: string; at: string }>;
}
interface DemoTask {
  id: string;
  title: string;
  personId: string;
  dueOffset: number;
  priority: string;
  status: string;
}
interface DemoAction {
  id: string;
  title: string;
  personId: string;
  type: string;
  description: string;
  body?: string;
}

export interface DemoScenarioPack extends DemoScenarioSummary {
  version: 3;
  tenant: TenantConfig;
  people: DemoPerson[];
  opportunities: DemoOpportunity[];
  conversations: DemoConversation[];
  tasks: DemoTask[];
  actions: DemoAction[];
  content: DemoScenarioContentProfile;
  business: DemoBusinessProfile;
}

const UUIDS = Array.from(
  { length: 80 },
  (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function tenant(
  name: string,
  domain: string,
  founder: string,
  industry: string,
  stageLabels: Record<string, string>,
  accentColor: string,
): TenantConfig {
  const first = founder.split(" ")[0]!;
  return {
    brand: {
      name,
      domain,
      siteUrl: `https://${domain}`,
      logoMark: name.slice(0, 1),
      accentColor,
      tagline: `${industry} operations`,
      emailFooter: `${name} · Fictional demo workspace`,
    },
    founder: {
      name: first,
      fullName: founder,
      email: `${first.toLowerCase()}@${domain}`,
      systemActorEmail: `system@${domain}`,
    },
    capabilities: { publicBooking: false },
    ai: {
      businessDescriptor: `${name}, a fictional ${industry}`,
      voice: "Be concise, specific, and operational.",
      positioning: `Help ${name} turn inquiries into well-served customers while protecting staff time.`,
    },
    booking: { url: `https://${domain}/book`, path: "/book", schedulerUrl: null },
    pipeline: { stageLabels },
    playbooks: [],
    external: { vercelProjectUrl: null, supabaseProjectRef: null },
  };
}

const CONTENT_PROFILES: Record<DemoScenarioId, DemoScenarioContentProfile> = {
  "northline-roofing": NORTHLINE_PROFILE,
  "alder-ridge-law": ALDER_RIDGE_PROFILE,
  "ledgerstone-advisory": LEDGERSTONE_PROFILE,
  "hearthline-realty": HEARTHLINE_PROFILE,
  "common-table-network": COMMON_TABLE_PROFILE,
};

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function supportingPeople(
  profile: DemoScenarioContentProfile,
  domain: string,
  start: number,
): DemoPerson[] {
  return profile.supportingPeople.map((item, index) => ({
    id: UUIDS[start + index]!,
    name: item.name,
    email: `${slug(item.name)}@${domain}`,
    phone: `(312) 555-${String(1100 + index).slice(-4)}`,
    company: item.company,
    role: item.role,
  }));
}

function makePack(input: {
  id: DemoScenarioId;
  name: string;
  category: string;
  description: string;
  accent: string;
  appearance: DemoAppearance;
  founder: string;
  domain: string;
  industry: string;
  story: string[];
  stages: Record<string, string>;
  corePeople: Array<[string, string, string, string]>;
}): DemoScenarioPack {
  const profile = CONTENT_PROFILES[input.id];
  const core = input.corePeople.map(([name, email, company, role], index) => ({
    id: UUIDS[index]!,
    name,
    email: `${email}@${input.domain}`,
    phone: `(312) 555-${String(1010 + index).slice(-4)}`,
    company,
    role,
  }));
  const people = [...core, ...supportingPeople(profile, input.domain, 12)];
  const stageKeys = [
    "new",
    "contacted",
    "qualified",
    "meeting",
    "proposal",
    "negotiation",
    "won",
    "lost",
    "nurture",
  ];
  const opportunities: DemoOpportunity[] = profile.opportunities.map((item, index) => ({
    id: UUIDS[42 + index]!,
    name: item.name,
    personId: people[index]!.id,
    company: people[index]!.company,
    stage: stageKeys[index % stageKeys.length]!,
    value: item.value,
    source: item.source,
    nextAction: item.nextAction,
  }));
  const conversations: DemoConversation[] = profile.conversations.map((item, index) => ({
    id: UUIDS[60 + index]!,
    personId: people[index]!.id,
    subject: item.subject,
    intent: item.intent,
    unread: index < 4 ? 1 : 0,
    messages: [
      { id: `msg-${index}-1`, direction: "inbound", body: item.inbound, at: ago(18 + index * 7) },
      { id: `msg-${index}-2`, direction: "outbound", body: item.outbound, at: ago(15 + index * 7) },
      { id: `msg-${index}-3`, direction: "inbound", body: item.followUp, at: ago(5 + index * 4) },
    ],
  }));
  const tasks: DemoTask[] = profile.tasks.map((title, index) => ({
    id: `task-${input.id}-${index}`,
    title,
    personId: people[index]!.id,
    dueOffset: index - 4,
    priority: index < 3 ? "high" : "normal",
    status: index > 14 ? "completed" : "pending",
  }));
  const actions: DemoAction[] = profile.actionReasons.map((description, index) => ({
    id: `action-${input.id}-${index}`,
    title: index % 2 ? opportunities[index]!.nextAction : `Reply to ${people[index]!.name}`,
    personId: people[index]!.id,
    type: index % 2 ? "transition_opportunity" : "send_gmail_reply",
    description,
    body:
      index % 2
        ? undefined
        : profile.replyBodies[Math.floor(index / 2) % profile.replyBodies.length],
  }));
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    description: input.description,
    accent: input.accent,
    appearance: input.appearance,
    story: input.story,
    version: 3,
    business: DEMO_BUSINESS_PROFILES[input.id],
    tenant: tenant(
      input.name,
      input.domain,
      input.founder,
      input.industry,
      input.stages,
      input.accent,
    ),
    people,
    opportunities,
    conversations,
    tasks,
    actions,
    content: profile,
  };
}

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenarioPack> = {
  "northline-roofing": makePack({
    id: "northline-roofing",
    name: "Northline Roofing & Exteriors",
    category: "Home services",
    description: "Storm response, inspections, estimates, production, invoices, and referrals.",
    accent: "#d97706",
    appearance: "studio",
    founder: "Evan Cole",
    domain: "northlineroofing.example",
    industry: "roofing and exterior services company",
    story: [
      "Triage a storm inquiry",
      "Confirm an inspection",
      "Advance the estimate",
      "Resolve a production exception",
      "Review attributed revenue",
    ],
    stages: {
      new: "New inquiry",
      qualified: "Inspection qualified",
      meeting: "Inspection booked",
      proposal: "Estimate sent",
      negotiation: "Decision pending",
      won: "Job won",
      lost: "Not moving forward",
      nurture: "Seasonal follow-up",
    },
    corePeople: [
      ["Lena Walsh", "lena.walsh", "Walsh Residence", "Homeowner"],
      ["Andre Coleman", "andre.coleman", "Coleman Residence", "Homeowner"],
      ["Tessa Moore", "tessa.moore", "Moore Residence", "Property manager"],
      ["Grant Ellis", "grant.ellis", "Ellis Residence", "Homeowner"],
      ["Monica Reed", "monica.reed", "Lakeview HOA", "Board president"],
      ["Owen Park", "owen.park", "Park Residence", "Homeowner"],
    ],
  }),
  "alder-ridge-law": makePack({
    id: "alder-ridge-law",
    name: "Alder Ridge Injury Law",
    category: "Law firms",
    description:
      "After-hours intake, conflict review, consultations, retainers, and secure onboarding.",
    accent: "#b45309",
    appearance: "dark",
    founder: "Jordan Pierce",
    domain: "alderridgelaw.example",
    industry: "personal injury law firm",
    story: [
      "Review a complete after-hours intake",
      "Clear the conflict check",
      "Confirm the consultation",
      "Stage the secure follow-up",
      "Inspect intake and engagement evidence",
    ],
    stages: {
      new: "New intake",
      qualified: "Conflict cleared",
      meeting: "Consultation booked",
      proposal: "Engagement offered",
      negotiation: "Attorney review",
      won: "Retained",
      lost: "Not retained",
      nurture: "Future follow-up",
    },
    corePeople: [
      ["Sofia Rivera", "sofia.rivera", "Rivera Household", "Prospective client"],
      ["Malcolm Bennett", "malcolm.bennett", "Bennett Household", "Prospective client"],
      ["Renee Choi", "renee.choi", "Choi Household", "Prospective client"],
      ["Damon Dawson", "damon.dawson", "Dawson Household", "Prospective client"],
      ["Amina Evans", "amina.evans", "Evans Household", "Prospective client"],
      ["Calvin Foster", "calvin.foster", "Foster Household", "Prospective client"],
    ],
  }),
  "ledgerstone-advisory": makePack({
    id: "ledgerstone-advisory",
    name: "Ledgerstone Accounting & Advisory",
    category: "Professional services",
    description:
      "Proposals, document collection, monthly close, reporting, deadlines, and renewals.",
    accent: "#6d28d9",
    appearance: "frost",
    founder: "Morgan Lee",
    domain: "ledgerstoneadvisory.example",
    industry: "accounting and advisory firm",
    story: [
      "Review a qualified advisory inquiry",
      "Open the document checklist",
      "Approve the scoped proposal",
      "Resolve a recurring deadline",
      "Inspect reporting and renewal evidence",
    ],
    stages: {
      new: "New inquiry",
      qualified: "Fit confirmed",
      meeting: "Review booked",
      proposal: "Engagement sent",
      negotiation: "Scope review",
      won: "Client active",
      lost: "Not proceeding",
      nurture: "Future planning",
    },
    corePeople: [
      ["Claire Monroe", "claire.monroe", "Monroe Services", "Chief operating officer"],
      ["Daniel Park", "daniel.park", "Park Family Holdings", "Managing member"],
      ["Amina Shah", "amina.shah", "Summit Engineering", "President"],
      ["Jordan Wells", "jordan.wells", "Riverside Foods", "Finance lead"],
      ["Elias Abbott", "elias.abbott", "Abbott Architecture", "Founder"],
      ["Naomi Blake", "naomi.blake", "Blake Dental Group", "Practice manager"],
    ],
  }),
  "hearthline-realty": makePack({
    id: "hearthline-realty",
    name: "Hearthline Realty Group",
    category: "Real estate",
    description:
      "Portal inquiries, showings, listings, long-term nurture, closings, and referrals.",
    accent: "#7c3aed",
    appearance: "signal",
    founder: "Avery Brooks",
    domain: "hearthlinerealty.example",
    industry: "residential real estate team",
    story: [
      "Prioritize a new portal inquiry",
      "Build the showing route",
      "Advance the listing plan",
      "Resolve a closing exception",
      "Review source-to-closing evidence",
    ],
    stages: {
      new: "New inquiry",
      qualified: "Needs confirmed",
      meeting: "Consultation booked",
      proposal: "Representation offered",
      negotiation: "Active search / listing",
      won: "Closed",
      lost: "Inactive",
      nurture: "Long-term nurture",
    },
    corePeople: [
      ["Maya Carver", "maya.carver", "Carver Household", "Buyer"],
      ["Jordan Langston", "jordan.langston", "Langston Household", "Seller"],
      ["Noor Mehta", "noor.mehta", "Mehta Household", "Relocating buyer"],
      ["Elliot Olsen", "elliot.olsen", "Olsen Household", "Seller"],
      ["Rina Benson", "rina.benson", "Benson Household", "Buyer"],
      ["Calvin Chang", "calvin.chang", "Chang Household", "Seller"],
    ],
  }),
  "common-table-network": makePack({
    id: "common-table-network",
    name: "Common Table Community Network",
    category: "Nonprofits",
    description:
      "Donor stewardship, volunteer coordination, partnerships, grants, and board reporting.",
    accent: "#15803d",
    appearance: "light",
    founder: "Elena Morris",
    domain: "commontablenetwork.example",
    industry: "community food-access nonprofit",
    story: [
      "Thank a first-time donor",
      "Start the second-gift journey",
      "Coordinate a volunteer partner",
      "Reconcile a grant report",
      "Review stewardship and program evidence",
    ],
    stages: {
      new: "New supporter",
      qualified: "Interest confirmed",
      meeting: "Conversation booked",
      proposal: "Invitation shared",
      negotiation: "Decision pending",
      won: "Active supporter",
      lost: "No response",
      nurture: "Stewardship",
    },
    corePeople: [
      ["Avery Hughes", "avery.hughes", "Hughes Household", "First-time donor"],
      ["Marcus Watson", "marcus.watson", "Watson Household", "Donor"],
      ["Renee Pine", "renee.pine", "Pine Family Fund", "Foundation director"],
      ["Theo Carter", "theo.carter", "Cedar Foods", "Community partnerships lead"],
      ["Maya Bryant", "maya.bryant", "Bryant Household", "Donor"],
      ["Caleb Chen", "caleb.chen", "Chen Household", "Monthly donor"],
    ],
  }),
};

export const DEMO_SCENARIO_SUMMARIES: DemoScenarioSummary[] = Object.values(DEMO_SCENARIOS).map(
  ({ id, name, category, description, accent, appearance, story }) => ({
    id,
    name,
    category,
    description,
    accent,
    appearance,
    story,
  }),
);
export const DEMO_SCENARIO_SHELL_NAMES: Record<DemoScenarioId, string> = {
  "northline-roofing": "Northline Roofing",
  "alder-ridge-law": "Alder Ridge Law",
  "ledgerstone-advisory": "Ledgerstone Advisory",
  "hearthline-realty": "Hearthline Realty",
  "common-table-network": "Common Table",
};
export function isDemoScenarioId(value: string): value is DemoScenarioId {
  return value in DEMO_SCENARIOS;
}
