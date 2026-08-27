import type { TenantConfig } from "@/config/tenant";
import { HARBORLINE_PROFILE, NORTHLINE_PROFILE, SPROUT_PROFILE, type DemoScenarioContentProfile } from "./scenario-profiles";

export type DemoScenarioId = "sprout-and-spark" | "northline-roofing" | "harborline-growth";
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

interface DemoPerson { id: string; name: string; email: string; phone: string; company: string; role: string }
interface DemoOpportunity { id: string; name: string; personId: string; company: string; stage: string; value: number; source: string; nextAction: string }
interface DemoConversation { id: string; personId: string; subject: string; intent: string; unread: number; messages: Array<{ id: string; direction: "inbound" | "outbound"; body: string; at: string }> }
interface DemoTask { id: string; title: string; personId: string; dueOffset: number; priority: string; status: string }
interface DemoAction { id: string; title: string; personId: string; type: string; description: string; body?: string }

export interface DemoScenarioPack extends DemoScenarioSummary {
  version: 2;
  tenant: TenantConfig;
  people: DemoPerson[];
  opportunities: DemoOpportunity[];
  conversations: DemoConversation[];
  tasks: DemoTask[];
  actions: DemoAction[];
  content: DemoScenarioContentProfile;
}

const UUIDS = Array.from({ length: 80 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function tenant(name: string, domain: string, founder: string, industry: string, stageLabels: Record<string, string>): TenantConfig {
  const first = founder.split(" ")[0]!;
  return {
    brand: { name, domain, siteUrl: `https://${domain}`, logoMark: name.slice(0, 1), accentColor: "#7cab2c", tagline: `${industry} operations`, emailFooter: `${name} · Fictional demo workspace` },
    founder: { name: first, fullName: founder, email: `${first.toLowerCase()}@${domain}`, systemActorEmail: `system@${domain}` },
    ai: { businessDescriptor: `${name}, a fictional ${industry}`, voice: "Be concise, specific, and operational.", positioning: `Help ${name} turn inquiries into well-served customers while protecting staff time.` },
    booking: { url: `https://${domain}/book`, path: "/book", schedulerUrl: null },
    pipeline: { stageLabels }, playbooks: [], external: { vercelProjectUrl: null, supabaseProjectRef: null },
  };
}

const CONTENT_PROFILES: Record<DemoScenarioId, DemoScenarioContentProfile> = {
  "sprout-and-spark": SPROUT_PROFILE,
  "northline-roofing": NORTHLINE_PROFILE,
  "harborline-growth": HARBORLINE_PROFILE,
};

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, ""); }

function supportingPeople(profile: DemoScenarioContentProfile, domain: string, start: number): DemoPerson[] {
  return profile.supportingPeople.map((item, index) => ({
    id: UUIDS[start + index]!, name: item.name, email: `${slug(item.name)}@${domain}`,
    phone: `(312) 555-${String(1100 + index).slice(-4)}`, company: item.company, role: item.role,
  }));
}

function makePack(input: {
  id: DemoScenarioId; name: string; category: string; description: string; accent: string; appearance: DemoAppearance; founder: string; domain: string;
  companyLabel: string; industry: string; story: string[]; stages: Record<string, string>;
  corePeople: Array<[string, string, string, string]>;
  opportunityNames: string[]; subjects: string[]; messages: Array<[string, string]>;
}): DemoScenarioPack {
  const profile = CONTENT_PROFILES[input.id];
  const core = input.corePeople.map(([name, email, company, role], index) => ({ id: UUIDS[index]!, name, email: `${email}@${input.domain}`, phone: `(312) 555-${String(1010 + index).slice(-4)}`, company, role }));
  const people = [...core, ...supportingPeople(profile, input.domain, 12)];
  const stageKeys = ["new", "contacted", "qualified", "meeting", "proposal", "negotiation", "won", "lost", "nurture"];
  const opportunities: DemoOpportunity[] = profile.opportunities.map((item, index) => ({
    id: UUIDS[42 + index]!, name: item.name, personId: people[index]!.id, company: people[index]!.company,
    stage: stageKeys[index % stageKeys.length]!, value: item.value, source: item.source, nextAction: item.nextAction,
  }));
  const conversations: DemoConversation[] = profile.conversations.map((item, index) => ({
    id: UUIDS[60 + index]!, personId: people[index]!.id, subject: item.subject, intent: item.intent, unread: index < 4 ? 1 : 0,
    messages: [
      { id: `msg-${index}-1`, direction: "inbound", body: item.inbound, at: ago(18 + index * 7) },
      { id: `msg-${index}-2`, direction: "outbound", body: item.outbound, at: ago(15 + index * 7) },
      { id: `msg-${index}-3`, direction: "inbound", body: item.followUp, at: ago(5 + index * 4) },
    ],
  }));
  const tasks: DemoTask[] = profile.tasks.map((title, index) => ({ id: `task-${input.id}-${index}`, title, personId: people[index]!.id, dueOffset: index - 4, priority: index < 3 ? "high" : "normal", status: index > 14 ? "completed" : "pending" }));
  const actions: DemoAction[] = profile.actionReasons.map((description, index) => ({
    id: `action-${input.id}-${index}`, title: index % 2 ? opportunities[index]!.nextAction : `Reply to ${people[index]!.name}`,
    personId: people[index]!.id, type: index % 2 ? "transition_opportunity" : "send_gmail_reply", description,
    body: index % 2 ? undefined : profile.replyBodies[Math.floor(index / 2) % profile.replyBodies.length],
  }));
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    description: input.description,
    accent: input.accent,
    appearance: input.appearance,
    story: input.story,
    version: 2,
    tenant: tenant(input.name, input.domain, input.founder, input.industry, input.stages),
    people,
    opportunities,
    conversations,
    tasks,
    actions,
    content: profile,
  };
}

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenarioPack> = {
  "sprout-and-spark": makePack({ id: "sprout-and-spark", name: "Sprout & Spark Kids Studio", category: "Kids enrichment", description: "Trials, camps, enrollments, family communication, and school partnerships.", accent: "#9bc53d", appearance: "light", founder: "Maya Brooks", domain: "sproutandspark.example", companyLabel: "Family", industry: "children's enrichment studio", story: ["Prioritize new family inquiries", "Review a grounded enrollment follow-up", "Open the connected family and trial", "Simulate the reply", "Verify the receipt and enrollment metrics"], stages: { new: "New inquiry", qualified: "Trial recommended", meeting: "Trial booked", proposal: "Enrollment offered", negotiation: "Decision pending", won: "Enrolled", lost: "Not enrolling", nurture: "Future session" }, corePeople: [["Elena Torres", "elena.torres", "Torres Family", "Parent / guardian"], ["Marcus Green", "marcus.green", "Green Family", "Parent / guardian"], ["Priya Shah", "priya.shah", "Shah Family", "Parent / guardian"], ["Nina Collins", "nina.collins", "Oak Street Elementary", "Community coordinator"], ["Devon Price", "devon.price", "Price Family", "Parent / guardian"], ["Samira Ali", "samira.ali", "Ali Family", "Parent / guardian"]], opportunityNames: ["Robotics Club enrollment", "Summer Makers Camp", "Saturday Art Lab", "School enrichment partnership"], subjects: ["Trial class availability", "Summer camp schedule", "Sibling enrollment question", "School partnership follow-up"], messages: [["We loved the studio tour and would like to try the Tuesday robotics group. Is there room next week?", "There is space in Tuesday's trial. I can hold it through tomorrow and send the short registration form."], ["Can you confirm the camp hours and whether before-care is available?", "Camp runs from 9 to 3. Before-care begins at 8, and I included the full schedule below."], ["We are considering enrolling both children. Is there a sibling option?", "Yes. I outlined the sibling rate and the two age-appropriate groups so you can compare them clearly."]] }),
  "northline-roofing": makePack({ id: "northline-roofing", name: "Northline Roofing & Exteriors", category: "Home services", description: "Storm inquiries, inspections, estimates, production, invoices, and referrals.", accent: "#f59e0b", appearance: "studio", founder: "Evan Cole", domain: "northlineroofing.example", companyLabel: "Property", industry: "roofing and exterior services company", story: ["Triage a high-intent storm inquiry", "Confirm an inspection", "Advance the estimate", "Resolve a production exception", "Review attributed revenue"], stages: { new: "New inquiry", qualified: "Inspection qualified", meeting: "Inspection booked", proposal: "Estimate sent", negotiation: "Decision pending", won: "Job won", lost: "Not moving forward", nurture: "Seasonal follow-up" }, corePeople: [["Lena Walsh", "lena.walsh", "Walsh Residence", "Homeowner"], ["Andre Coleman", "andre.coleman", "Coleman Residence", "Homeowner"], ["Tessa Moore", "tessa.moore", "Moore Residence", "Property manager"], ["Grant Ellis", "grant.ellis", "Ellis Residence", "Homeowner"], ["Monica Reed", "monica.reed", "Lakeview HOA", "Board president"], ["Owen Park", "owen.park", "Park Residence", "Homeowner"]], opportunityNames: ["Storm restoration", "Roof replacement", "Gutter and fascia project", "HOA exterior inspection"], subjects: ["Inspection after last night's storm", "Estimate questions", "Material delivery update", "Final invoice and warranty"], messages: [["We found shingles in the yard after the storm. Can someone inspect the roof this week?", "Yes. I reserved Thursday afternoon and included what our inspector will document."], ["We reviewed the estimate and have two questions about the ventilation line items.", "I separated those items and added a plain-language explanation of each option."], ["Is Friday's crew start still confirmed?", "Friday is confirmed. The material delivery was received and the weather window remains clear."]] }),
  "harborline-growth": makePack({ id: "harborline-growth", name: "Harborline Growth Studio", category: "Professional services", description: "Website assessments, discovery, proposals, campaigns, delivery, and reporting.", accent: "#8b5cf6", appearance: "signal", founder: "Avery Stone", domain: "harborlinegrowth.example", companyLabel: "Account", industry: "growth strategy studio", story: ["Review a qualified website assessment", "Open the decision-maker context", "Send the scoped proposal", "Start the approved follow-up", "Inspect campaign and revenue evidence"], stages: { new: "New assessment", qualified: "Discovery qualified", meeting: "Discovery booked", proposal: "Scope sent", negotiation: "In review", won: "Engaged", lost: "Closed", nurture: "Keep warm" }, corePeople: [["Sarah Chen", "sarah.chen", "Northwind Group", "Operations director"], ["Marcus Reyes", "marcus.reyes", "Northwind Group", "CFO"], ["Dana Whitfield", "dana.whitfield", "Whitfield & Co", "Managing partner"], ["Priya Raman", "priya.raman", "Brightwater Labs", "Founder"], ["Ray Atwell", "ray.atwell", "Atwell Construction", "Owner"], ["June Park", "june.park", "Halcyon Legal", "Partner"]], opportunityNames: ["Website conversion rebuild", "Growth operations retainer", "Referral campaign", "Client reporting system"], subjects: ["Website assessment follow-up", "Revised scope", "Referral campaign review", "Monthly reporting questions"], messages: [["The assessment was helpful. Can we talk through the two highest-priority conversion issues?", "Absolutely. I linked each recommendation to the evidence and proposed a focused 30-minute review."], ["Please separate reporting from the main scope so finance can review it independently.", "Done. Reporting is now its own line with timing, ownership, and acceptance criteria."], ["The campaign draft looks right. Can you confirm the exclusion list before launch?", "Confirmed. Existing clients, prior replies, and suppressed contacts are excluded in the dry run."]] }),
};

export const DEMO_SCENARIO_SUMMARIES: DemoScenarioSummary[] = Object.values(DEMO_SCENARIOS).map(({ id, name, category, description, accent, appearance, story }) => ({ id, name, category, description, accent, appearance, story }));
export const DEMO_SCENARIO_SHELL_NAMES: Record<DemoScenarioId, string> = {
  "sprout-and-spark": "Sprout & Spark",
  "northline-roofing": "Northline Roofing",
  "harborline-growth": "Harborline Growth",
};
export function isDemoScenarioId(value: string): value is DemoScenarioId { return value in DEMO_SCENARIOS; }
