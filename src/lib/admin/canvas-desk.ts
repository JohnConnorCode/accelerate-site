/**
 * Desk datum: the shape a board projects onto the canvas. Anchors are
 * businesses, hubs are modes' phases, segments group stations, and stations
 * show live rows read from source records. The sample desk below is fictional
 * data in the MLIVM prototype's structure, for development preview and QA.
 */
import type { CanvasNode, CanvasStatus } from "./canvas-model";

export type DeskIcon =
  | "layers"
  | "leaf"
  | "home"
  | "messages"
  | "search"
  | "hammer"
  | "clipboard"
  | "trending"
  | "target"
  | "handshake"
  | "ruler"
  | "users"
  | "chart"
  | "megaphone"
  | "signature"
  | "wallet"
  | "wrench"
  | "line"
  | "dollar"
  | "calendar"
  | "file"
  | "check"
  | "eye"
  | "message"
  | "receipt"
  | "star"
  | "truck"
  | "bell";

export interface DeskDatum {
  icon: DeskIcon;
  /** Short line under a circle label, or a segment's description. */
  detail?: string;
  /** Label for the farthest zoom level when the full label cannot fit a circle. */
  short?: string;
  /** Station subtitle. */
  subtitle?: string;
  rows?: readonly { label: string; value: string }[];
  /** Skills or tools a station uses, shown in its detail. */
  skills?: readonly string[];
}

export type DeskNode = CanvasNode<DeskDatum>;

type StationSpec = [title: string, icon: DeskIcon, subtitle: string, rows: [string, string][], status?: CanvasStatus, skills?: string[]];

function station(parentId: string, key: string, [title, icon, subtitle, rows, status, skills]: StationSpec): DeskNode {
  return {
    id: `${parentId}:${key}`,
    parentId,
    kind: "station",
    label: title,
    status,
    data: { icon, subtitle, rows: rows.map(([label, value]) => ({ label, value })), skills },
  };
}

function segment(parentId: string, key: string, label: string, icon: DeskIcon, detail: string, stations: StationSpec[]): DeskNode[] {
  const id = `${parentId}:${key}`;
  return [
    { id, parentId, kind: "segment", label, data: { icon, detail } },
    ...stations.map((spec, index) => station(id, String(index + 1), spec)),
  ];
}

const PROPERTY_A = "412 Dune Ridge Rd";
const PROPERTY_B = "88 Willow Bend";

/** Fictional sample desk in the MLIVM prototype's structure. */
export function sampleDeskNodes(): DeskNode[] {
  const m = "desk:mlivm";
  const h = "desk:hilawn";
  return [
    { id: m, parentId: null, kind: "anchor", label: "MLIVM LLC", data: { icon: "layers", detail: "Real estate" } },
    { id: `${m}:property`, parentId: m, kind: "satellite", slot: "above", label: PROPERTY_A, data: { icon: "home", detail: "Co-living · 4 rooms" } },
    { id: `${m}:conversations`, parentId: m, kind: "satellite", slot: "right", label: "Conversations", status: "attention", data: { icon: "messages", detail: "2 unread" } },
    { id: `${m}:acquire`, parentId: m, kind: "hub", label: "Acquire", data: { icon: "search", detail: "Pillar 1" } },
    ...segment(`${m}:acquire`, "1a", "1A Deal Pipeline", "target", "Properties you're looking to buy", [
      ["Prospects", "target", "Homes on the short list", [[PROPERTY_B, "Walkthrough Thursday"], ["1420 Harbor St", "Asking $214k"]]],
      ["Underwriting", "chart", "Numbers before an offer", [[PROPERTY_B, "Cap rate 9.1% at 4 rooms"], ["1420 Harbor St", "Needs roof estimate"]], "attention"],
      ["Offers", "signature", "Offers out and responses", [["1420 Harbor St", "Counter due Nov 18"], ["Last accepted", PROPERTY_A]], undefined, ["Prepare an offer"]],
    ]),
    ...segment(`${m}:acquire`, "1b", "1B Brokerage", "handshake", "Brokers, outreach and off-market leads", [
      ["Broker Network", "users", "Who sends you deals", [["Active brokers", "6 this quarter"], ["Top source", "Lakeshore Realty"]]],
      ["Outreach", "megaphone", "Letters, calls and follow-up", [["This week", "14 owners contacted"], ["Replies", "3 interested"]]],
      ["Off-Market Leads", "eye", "Owners open to selling", [["New", "2 leads to review"], ["Oldest open", "11 days"]], "attention"],
    ]),
    { id: `${m}:execute`, parentId: m, kind: "hub", label: "Execute", data: { icon: "hammer", detail: "Pillar 2" } },
    ...segment(`${m}:execute`, "2a", "2A Projects", "ruler", "Milestones, timeline and site updates", [
      ["Milestones", "check", "Where each project stands", [[PROPERTY_A, "Countertops next · Nov 19"], [PROPERTY_B, "Waiting on the purchase"]]],
      ["Timeline", "calendar", "Start and finish dates", [[PROPERTY_A, "Oct 21 → Nov 26"], [PROPERTY_B, "After closing · about 10 weeks"]]],
      ["Site Updates", "eye", "Latest from the job site", [["Latest", "Nov 13 · cabinets in, sink connected"], ["Photos", "6 this week"]]],
    ]),
    ...segment(`${m}:execute`, "2b", "2B Team & Permits", "users", "Contractors, designers and permits", [
      ["Contractors", "hammer", "Crews on each project", [["On site", "2 crews today"], ["Next start", "Electrician · Nov 18"]]],
      ["Designers", "ruler", "Layouts and finishes", [["In review", "Kitchen finishes"], ["Approved", "Bath tile"]]],
      ["Permits", "file", "Applications and inspections", [[PROPERTY_A, "Final inspection pending"], [PROPERTY_B, "Not filed yet"]], "blocked"],
    ]),
    ...segment(`${m}:execute`, "2c", "2C Budget & Draws", "chart", "Spending vs plan and lender draws", [
      ["Budget vs Plan", "chart", "Spending against the plan", [[PROPERTY_A, "$41.2k of $48k"], ["Variance", "+3% on cabinets"]], "ok"],
      ["Lender Draws", "dollar", "Draw requests and releases", [["Draw 3", "Waiting on inspection"], ["Released", "$22k of $36k"]], "attention"],
      ["Change Orders", "receipt", "Approved scope changes", [["Open", "1 awaiting approval"], ["This month", "$1.8k approved"]]],
    ]),
    { id: `${m}:pm`, parentId: m, kind: "hub", label: "PM", data: { icon: "clipboard", detail: "Pillar 3" } },
    ...segment(`${m}:pm`, "3a", "3A Marketing & Funnel", "megaphone", "Get open rooms seen and toured", [
      ["Listings", "megaphone", "Where open rooms are posted", [["Live", "3 listings"], ["Best channel", "Neighborhood group"]]],
      ["Tours", "calendar", "Scheduled showings", [["Today", "2 tours"], ["This week", "7 booked"]], "ok"],
      ["Inquiries", "message", "New questions about rooms", [["New", "4 to answer"], ["Avg reply", "38 minutes"]], "attention"],
    ]),
    ...segment(`${m}:pm`, "3b", "3B Screening & Lease", "signature", "Applicants, screening and leases", [
      ["Applicants", "users", "People who applied", [["In review", "3 applicants"], ["Waiting on ID", "1"]]],
      ["Screening", "check", "Background and income checks", [["Complete", "2 passed"], ["Pending", "1 report"]]],
      ["Leases", "signature", "Agreements out for signature", [["Sent", "Room 2 · awaiting signature"], ["Starts", "Dec 1"]], undefined, ["Approve", "Ignore"]],
    ]),
    ...segment(`${m}:pm`, "3c", "3C Rent Roll & Ops", "wallet", "Residents, rooms and rent", [
      ["Residents", "users", "Who lives where", [[PROPERTY_A, "3 of 4 rooms occupied"], ["Move-ins", "1 on Dec 1"]]],
      ["Rooms", "home", "Room status and pricing", [["Open", "Room 4 · $650 monthly"], ["Turning", "None"]]],
      ["Rent Collected", "wallet", "This month's payments", [["Collected", "$1,950 of $1,950"], ["Late", "None"]], "ok"],
    ]),
    ...segment(`${m}:pm`, "3d", "3D Maintenance & Turns", "wrench", "Repairs, calls and room turnovers", [
      ["Work Orders", "wrench", "Repairs in progress", [["Open", "2 work orders"], ["Oldest", "Dryer vent · 3 days"]], "attention"],
      ["Room Turns", "home", "Cleaning between residents", [["Next", "Room 4 · ready"], ["Average", "2.5 days"]]],
      ["Vendor Calls", "bell", "Calls to schedule", [["Today", "Cleaning crew · 9:00 AM"], ["Waiting", "Plumber callback"]]],
    ]),
    { id: `${m}:am`, parentId: m, kind: "hub", label: "AM", data: { icon: "trending", detail: "Pillar 4" } },
    ...segment(`${m}:am`, "4a", "4A Performance", "line", "Income, expenses and NOI", [
      ["Income", "dollar", "Rent and other income", [["This month", "$1,950"], ["Year to date", "$19,400"]], "ok"],
      ["Expenses", "receipt", "Operating costs", [["This month", "$640"], ["Largest", "Utilities · $310"]]],
      ["NOI", "line", "Net operating income", [["Trailing 12", "$14,900"], ["Trend", "Up 6% vs last year"]]],
    ]),
    ...segment(`${m}:am`, "4b", "4B Value & Debt", "dollar", "What it's worth and what's owed", [
      ["Valuation", "chart", "Estimated value", [[PROPERTY_A, "$238k estimate"], ["Updated", "Nov 1"]]],
      ["Loans", "file", "Balances and rates", [["Balance", "$151k at 7.1%"], ["Next payment", "Dec 1"]]],
      ["Equity", "trending", "Value minus debt", [["Equity", "$87k"], ["Loan to value", "63%"]]],
    ]),
    ...segment(`${m}:am`, "4c", "4C Plans & Exit", "calendar", "Big repairs and hold, refinance or sell", [
      ["Capital Plan", "wrench", "Large repairs ahead", [["Next", "Roof · spring 2027"], ["Reserve", "$6.2k"]]],
      ["Hold, Refi or Sell", "trending", "Options under review", [["Leaning", "Refinance after rehab"], ["Review", "Jan 2027"]]],
      ["Timeline", "calendar", "Key dates for the plan", [["Rehab done", "Late November"], ["Appraisal", "Mid December"]]],
    ]),
    ...segment(`${m}:am`, "4d", "4D Reports & Records", "file", "Owner reports and property documents", [
      ["Owner Reports", "file", "Monthly summaries", [["October", "Ready to review"], ["November", "Drafting"]], "attention"],
      ["Documents", "file", "Leases, deeds and insurance", [["Stored", "42 documents"], ["Expiring", "Insurance · Feb 2027"]]],
      ["Tax Records", "receipt", "Receipts and filings", [["Receipts", "118 this year"], ["Missing", "None"]]],
    ]),
    { id: h, parentId: null, kind: "anchor", label: "HI LAWN LLC", data: { icon: "leaf", detail: "Service Mode" } },
    { id: `${h}:conversations`, parentId: h, kind: "satellite", slot: "right", label: "Conversations", data: { icon: "messages", detail: "All caught up" } },
    { id: `${h}:acquire`, parentId: h, kind: "hub", label: "Acquire", data: { icon: "search", detail: "Win the job" } },
    station(`${h}:acquire`, "1", ["Instant Text-Back", "message", "Reply when a call is missed", [["Today", "3 callers texted back"], ["Booked from text", "1 estimate"]], "ok", ["Instant Text-Back"]]),
    station(`${h}:acquire`, "2", ["Instant Quote", "receipt", "Price the job on the spot", [["Sent today", "4 quotes"], ["Average", "$185 per visit"]], undefined, ["Instant Quote"]]),
    station(`${h}:acquire`, "3", ["Quote Follow-Up", "bell", "Nudge open quotes", [["Open", "6 quotes"], ["Due today", "2 follow-ups"]], "attention", ["Quote Follow-Up"]]),
    { id: `${h}:execute`, parentId: h, kind: "hub", label: "Execute", data: { icon: "hammer", detail: "Do the work" } },
    station(`${h}:execute`, "1", ["Booking Reminders", "calendar", "Remind customers before visits", [["Tomorrow", "9 visits reminded"], ["Confirmed", "7 of 9"]], "ok", ["Booking Reminders"]]),
    station(`${h}:execute`, "2", ["Crew Schedule", "users", "Who is where today", [["Crews out", "3 crews"], ["Next open slot", "Thursday 2:00 PM"]]]),
    station(`${h}:execute`, "3", ["Job Completion", "check", "Finished work and photos", [["Completed", "11 jobs this week"], ["Photos", "All attached"]]]),
    { id: `${h}:accounts`, parentId: h, kind: "hub", label: "Account & Equipment Management", data: { icon: "wrench", detail: "Keep it running", short: "Accounts" } },
    station(`${h}:accounts`, "1", ["Invoice Chaser", "wallet", "Follow up on unpaid invoices", [["Overdue", "3 invoices · $740"], ["Oldest", "18 days"]], "attention", ["Invoice Chaser"]]),
    station(`${h}:accounts`, "2", ["Customer Accounts", "users", "Recurring customers", [["Active", "84 accounts"], ["New this month", "6"]]]),
    station(`${h}:accounts`, "3", ["Equipment Service", "wrench", "Mowers, trimmers and trucks", [["Due", "Mower 2 · blade service"], ["Down", "None"]]]),
    { id: `${h}:growth`, parentId: h, kind: "hub", label: "Business & Fleet Asset Growth", data: { icon: "trending", detail: "Grow the business", short: "Growth" } },
    station(`${h}:growth`, "1", ["Review Request", "star", "Ask happy customers for reviews", [["Sent", "8 this week"], ["New reviews", "3 · 5.0 average"]], "ok", ["Review Request"]]),
    station(`${h}:growth`, "2", ["Fleet Utilization", "truck", "How hard the fleet works", [["This week", "82% of hours booked"], ["Idle", "Trailer 2"]]]),
    station(`${h}:growth`, "3", ["Growth Report", "line", "Revenue and new customers", [["This month", "$18.4k revenue"], ["Versus last month", "Up 9%"]]]),
  ];
}
