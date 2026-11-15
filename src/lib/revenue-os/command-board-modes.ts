/**
 * Mode templates. Installing a mode copies its template into the workspace's
 * own board document, which the workspace can then change like any other
 * configuration. A new mode is new data here, never new board code.
 */
import { z } from "zod";
import {
  commandBoardDocumentSchema,
  commandBoardKeySchema,
  type CommandBoardDocument,
  type CommandBoardSnapshot,
  type CommandBoardSource,
} from "./command-board-contract";

type Station = CommandBoardDocument["phases"][number]["stations"][number];
type Icon = CommandBoardDocument["anchor"]["icon"];

const station = (
  key: string,
  label: string,
  icon: Icon,
  subtitle: string,
  source: CommandBoardSource,
  match: string[] = [],
  skills: string[] = [],
): Station => ({ key, label, icon, subtitle, sources: [{ source, match }], skills });

const conversations = {
  key: "conversations",
  label: "Conversations",
  icon: "messages" as const,
  slot: "right" as const,
  sources: [{ source: "conversations" as const, match: [] }],
};

export const COMMAND_BOARD_MODES = {
  service: {
    label: "Service Mode",
    description:
      "Win, do and bill service work, with skills that draft the next message for review.",
    template: (anchorLabel: string): CommandBoardDocument =>
      commandBoardDocumentSchema.parse({
        version: 1,
        anchor: { label: anchorLabel, icon: "leaf", detail: "Service Mode" },
        mode: { key: "service", label: "Service Mode" },
        satellites: [conversations],
        phases: [
          {
            key: "acquire",
            label: "Acquire",
            icon: "search",
            stations: [
              station(
                "text-back",
                "Instant Text-Back",
                "message",
                "Reply when a caller is not answered",
                "conversations",
                ["text", "call"],
                ["Instant Text-Back"],
              ),
              station(
                "quote",
                "Instant Quote",
                "receipt",
                "Price the job on the spot",
                "opportunities",
                ["quote", "estimate"],
                ["Instant Quote"],
              ),
              station(
                "quote-follow-up",
                "Quote Follow-Up",
                "bell",
                "Nudge open quotes",
                "opportunities",
                ["quote"],
                ["Quote Follow-Up"],
              ),
            ],
          },
          {
            key: "execute",
            label: "Execute",
            icon: "hammer",
            stations: [
              station(
                "reminders",
                "Booking Reminders",
                "calendar",
                "Remind customers before visits",
                "tasks",
                ["visit", "appointment", "booking"],
                ["Booking Reminders"],
              ),
              station("crews", "Crew Schedule", "users", "Who is where today", "tasks", [
                "crew",
                "schedule",
              ]),
              station(
                "completion",
                "Job Completion",
                "check",
                "Finished work and photos",
                "tasks",
                ["complete", "photos", "job"],
              ),
            ],
          },
          {
            key: "accounts",
            label: "Account & Equipment Management",
            short: "Accounts",
            icon: "wrench",
            stations: [
              station(
                "invoices",
                "Invoice Chaser",
                "wallet",
                "Follow up on unpaid invoices",
                "collections",
                [],
                ["Invoice Chaser"],
              ),
              station("customers", "Customer Accounts", "users", "Recurring customers", "contacts"),
              station(
                "equipment",
                "Equipment Service",
                "wrench",
                "Mowers, trimmers and trucks",
                "tasks",
                ["mower", "equipment", "truck", "blade"],
              ),
            ],
          },
          {
            key: "growth",
            label: "Business & Fleet Asset Growth",
            short: "Growth",
            icon: "trending",
            stations: [
              station(
                "reviews",
                "Review Request",
                "star",
                "Ask happy customers for reviews",
                "conversations",
                ["review"],
                ["Review Request"],
              ),
              station("fleet", "Fleet Utilization", "truck", "How hard the fleet works", "tasks", [
                "fleet",
                "trailer",
                "route",
              ]),
              station(
                "growth-report",
                "Growth Report",
                "line",
                "Revenue and new customers",
                "opportunities",
              ),
            ],
          },
        ],
      }),
  },
  "real-estate": {
    label: "Real Estate Mode",
    description: "Acquire, execute, manage and grow properties from one desk.",
    template: (anchorLabel: string): CommandBoardDocument =>
      commandBoardDocumentSchema.parse({
        version: 1,
        anchor: { label: anchorLabel, icon: "layers", detail: "Real Estate Mode" },
        mode: { key: "real-estate", label: "Real Estate Mode" },
        satellites: [conversations],
        phases: [
          {
            key: "acquire",
            label: "Acquire",
            icon: "search",
            segments: [
              {
                key: "deal-pipeline",
                label: "1A Deal Pipeline",
                icon: "target",
                description: "Properties you're looking to buy",
                stations: [
                  station(
                    "prospects",
                    "Prospects",
                    "target",
                    "Homes on the short list",
                    "opportunities",
                    ["prospect", "walkthrough", "showing"],
                  ),
                  station(
                    "underwriting",
                    "Underwriting",
                    "chart",
                    "Numbers before an offer",
                    "tasks",
                    ["underwrit", "estimate", "cap rate"],
                  ),
                  station(
                    "offers",
                    "Offers",
                    "signature",
                    "Offers out and responses",
                    "opportunities",
                    ["offer", "counter"],
                    ["Prepare an offer"],
                  ),
                ],
              },
              {
                key: "brokerage",
                label: "1B Brokerage",
                icon: "handshake",
                description: "Brokers, outreach and off-market leads",
                stations: [
                  station("brokers", "Broker Network", "users", "Who sends you deals", "contacts", [
                    "broker",
                    "realty",
                  ]),
                  station(
                    "outreach",
                    "Outreach",
                    "megaphone",
                    "Letters, calls and follow-up",
                    "conversations",
                    ["owner", "outreach"],
                  ),
                  station(
                    "off-market",
                    "Off-Market Leads",
                    "eye",
                    "Owners open to selling",
                    "opportunities",
                    ["off-market", "off market"],
                  ),
                ],
              },
            ],
          },
          {
            key: "execute",
            label: "Execute",
            icon: "hammer",
            segments: [
              {
                key: "projects",
                label: "2A Projects",
                icon: "ruler",
                description: "Milestones, timeline and site updates",
                stations: [
                  station(
                    "milestones",
                    "Milestones",
                    "check",
                    "Where each project stands",
                    "tasks",
                    ["milestone", "install", "countertop", "cabinet"],
                  ),
                  station("timeline", "Timeline", "calendar", "Start and finish dates", "tasks", [
                    "start",
                    "finish",
                    "schedule",
                  ]),
                  station(
                    "site-updates",
                    "Site Updates",
                    "eye",
                    "Latest from the job site",
                    "conversations",
                    ["site", "photos", "update"],
                  ),
                ],
              },
              {
                key: "team-permits",
                label: "2B Team & Permits",
                icon: "users",
                description: "Contractors, designers and permits",
                stations: [
                  station(
                    "contractors",
                    "Contractors",
                    "hammer",
                    "Crews on each project",
                    "tasks",
                    ["contractor", "crew", "electrician", "plumber"],
                  ),
                  station("designers", "Designers", "ruler", "Layouts and finishes", "tasks", [
                    "design",
                    "finishes",
                    "layout",
                  ]),
                  station("permits", "Permits", "file", "Applications and inspections", "tasks", [
                    "permit",
                    "inspection",
                  ]),
                ],
              },
              {
                key: "budget-draws",
                label: "2C Budget & Draws",
                icon: "chart",
                description: "Spending vs plan and lender draws",
                stations: [
                  station(
                    "budget",
                    "Budget vs Plan",
                    "chart",
                    "Spending against the plan",
                    "tasks",
                    ["budget"],
                  ),
                  station(
                    "draws",
                    "Lender Draws",
                    "dollar",
                    "Draw requests and releases",
                    "approvals",
                    ["draw"],
                  ),
                  station(
                    "change-orders",
                    "Change Orders",
                    "receipt",
                    "Approved scope changes",
                    "approvals",
                    ["change order"],
                  ),
                ],
              },
            ],
          },
          {
            key: "pm",
            label: "PM",
            icon: "clipboard",
            segments: [
              {
                key: "marketing-funnel",
                label: "3A Marketing & Funnel",
                icon: "megaphone",
                description: "Get open rooms seen and toured",
                stations: [
                  station(
                    "listings",
                    "Listings",
                    "megaphone",
                    "Where open rooms are posted",
                    "tasks",
                    ["listing"],
                  ),
                  station("tours", "Tours", "calendar", "Scheduled showings", "tasks", ["tour"]),
                  station(
                    "inquiries",
                    "Inquiries",
                    "message",
                    "New questions about rooms",
                    "conversations",
                    ["room", "inquiry", "available"],
                  ),
                ],
              },
              {
                key: "screening-lease",
                label: "3B Screening & Lease",
                icon: "signature",
                description: "Applicants, screening and leases",
                stations: [
                  station("applicants", "Applicants", "users", "People who applied", "contacts", [
                    "applicant",
                  ]),
                  station(
                    "screening",
                    "Screening",
                    "check",
                    "Background and income checks",
                    "tasks",
                    ["screening", "background"],
                  ),
                  station(
                    "leases",
                    "Leases",
                    "signature",
                    "Agreements out for signature",
                    "approvals",
                    ["lease"],
                  ),
                ],
              },
              {
                key: "rent-roll",
                label: "3C Rent Roll & Ops",
                icon: "wallet",
                description: "Residents, rooms and rent",
                stations: [
                  station("residents", "Residents", "users", "Who lives where", "contacts", [
                    "resident",
                  ]),
                  station("rooms", "Rooms", "home", "Room status and pricing", "tasks", ["room"]),
                  station(
                    "rent",
                    "Rent Collected",
                    "wallet",
                    "This month's payments",
                    "collections",
                  ),
                ],
              },
              {
                key: "maintenance-turns",
                label: "3D Maintenance & Turns",
                icon: "wrench",
                description: "Repairs, calls and room turnovers",
                stations: [
                  station("work-orders", "Work Orders", "wrench", "Repairs in progress", "tasks", [
                    "repair",
                    "fix",
                    "leak",
                    "vent",
                  ]),
                  station("turns", "Room Turns", "home", "Cleaning between residents", "tasks", [
                    "turn",
                    "clean",
                  ]),
                  station("vendors", "Vendor Calls", "bell", "Calls to schedule", "conversations", [
                    "vendor",
                    "crew",
                    "plumber",
                  ]),
                ],
              },
            ],
          },
          {
            key: "am",
            label: "AM",
            icon: "trending",
            segments: [
              {
                key: "performance",
                label: "4A Performance",
                icon: "line",
                description: "Income, expenses and NOI",
                stations: [
                  station("income", "Income", "dollar", "Rent and other income", "collections"),
                  station("expenses", "Expenses", "receipt", "Operating costs", "approvals", [
                    "invoice",
                    "bill",
                  ]),
                  station("noi", "NOI", "line", "Net operating income", "tasks", [
                    "noi",
                    "statement",
                  ]),
                ],
              },
              {
                key: "value-debt",
                label: "4B Value & Debt",
                icon: "dollar",
                description: "What it's worth and what's owed",
                stations: [
                  station("valuation", "Valuation", "chart", "Estimated value", "tasks", [
                    "appraisal",
                    "valuation",
                  ]),
                  station("loans", "Loans", "file", "Balances and rates", "tasks", [
                    "loan",
                    "lender",
                  ]),
                  station("equity", "Equity", "trending", "Value minus debt", "tasks", ["equity"]),
                ],
              },
              {
                key: "plans-exit",
                label: "4C Plans & Exit",
                icon: "calendar",
                description: "Big repairs and hold, refinance or sell",
                stations: [
                  station(
                    "capital-plan",
                    "Capital Plan",
                    "wrench",
                    "Large repairs ahead",
                    "tasks",
                    ["roof", "capital"],
                  ),
                  station(
                    "hold-refi-sell",
                    "Hold, Refi or Sell",
                    "trending",
                    "Options under review",
                    "opportunities",
                    ["refinance", "sale"],
                  ),
                  station(
                    "plan-timeline",
                    "Timeline",
                    "calendar",
                    "Key dates for the plan",
                    "tasks",
                    ["plan"],
                  ),
                ],
              },
              {
                key: "reports-records",
                label: "4D Reports & Records",
                icon: "file",
                description: "Owner reports and property documents",
                stations: [
                  station("owner-reports", "Owner Reports", "file", "Monthly summaries", "tasks", [
                    "owner report",
                  ]),
                  station(
                    "documents",
                    "Documents",
                    "file",
                    "Leases, deeds and insurance",
                    "tasks",
                    ["document", "insurance", "deed"],
                  ),
                  station("tax", "Tax Records", "receipt", "Receipts and filings", "tasks", [
                    "tax",
                    "receipt",
                  ]),
                ],
              },
            ],
          },
        ],
      }),
  },
} as const;

export type CommandBoardModeKey = keyof typeof COMMAND_BOARD_MODES;
export const COMMAND_BOARD_MODE_KEYS = Object.keys(COMMAND_BOARD_MODES) as CommandBoardModeKey[];

export const commandBoardInstallSchema = z
  .object({
    mode: z.enum(COMMAND_BOARD_MODE_KEYS as [CommandBoardModeKey, ...CommandBoardModeKey[]]),
    label: z.string().trim().min(1).max(60),
    boardKey: commandBoardKeySchema,
    requestId: z.uuid(),
  })
  .strict();
export type CommandBoardInstall = z.infer<typeof commandBoardInstallSchema>;

/**
 * Decide what installing a mode means for the boards a workspace already has:
 * the same mode under the same key changes nothing, a different board under
 * that key is a conflict, and otherwise the template is appended to the desk.
 */
export function planBoardInstall(
  boards: CommandBoardSnapshot["boards"],
  request: CommandBoardInstall,
):
  | { kind: "existing"; board: CommandBoardSnapshot["boards"][number] }
  | { kind: "conflict" }
  | { kind: "new"; position: number; document: CommandBoardDocument } {
  const current = boards.find((board) => board.boardKey === request.boardKey);
  if (current)
    return current.document.mode.key === request.mode
      ? { kind: "existing", board: current }
      : { kind: "conflict" };
  return {
    kind: "new",
    position: boards.length ? Math.max(...boards.map((board) => board.position)) + 1 : 0,
    document: COMMAND_BOARD_MODES[request.mode].template(request.label),
  };
}
