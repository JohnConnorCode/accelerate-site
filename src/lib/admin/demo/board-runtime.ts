/**
 * Fictional Command Board for the shared demo engine. Boards live in session
 * state; summaries, install planning, skill availability and record links use
 * the same functions as the live board, over the rows the rest of the demo shows.
 */
import {
  boardRecordHref,
  commandBoardDocumentSchema,
  commandBoardSaveSchema,
  type CommandBoardDocument,
  type CommandBoardSnapshot,
} from "@/lib/revenue-os/command-board-contract";
import {
  COMMAND_BOARD_MODES,
  commandBoardInstallSchema,
  planBoardInstall,
} from "@/lib/revenue-os/command-board-modes";
import {
  boardSkills,
  summarizeBoards,
  type BoardSourceReads,
  type BoardSourceRecord,
} from "@/lib/revenue-os/command-board-summary";
import type { DemoScenarioPack } from "./scenarios";

export type DemoBoardState = {
  boards: CommandBoardSnapshot["boards"];
  receipts: Record<string, { fingerprint: string; result: unknown }>;
};

type Board = CommandBoardSnapshot["boards"][number];

/** Narrow a template's keywords where two businesses on one desk share a source. */
function withMatches(
  document: CommandBoardDocument,
  overrides: Record<string, string[]>,
  satellites: CommandBoardDocument["satellites"] = document.satellites,
): CommandBoardDocument {
  const tune = <S extends { key: string; sources: { source: string; match: string[] }[] }>(
    station: S,
  ) =>
    overrides[station.key]
      ? {
          ...station,
          sources: station.sources.map((s) => ({ ...s, match: overrides[station.key]! })),
        }
      : station;
  return commandBoardDocumentSchema.parse({
    ...document,
    satellites,
    phases: document.phases.map((phase) => ({
      ...phase,
      stations: phase.stations.map(tune),
      segments: phase.segments.map((segment) => ({
        ...segment,
        stations: segment.stations.map(tune),
      })),
    })),
  });
}

/** The MLIVM desk: a real estate board and a service board side by side. */
export function seedDemoBoards(pack: DemoScenarioPack): Board[] {
  if (pack.id !== "mlivm") return [];
  const estate = COMMAND_BOARD_MODES["real-estate"].template("MLIVM LLC");
  const service = COMMAND_BOARD_MODES.service.template("HI LAWN LLC");
  return [
    {
      boardKey: "mlivm-llc",
      position: 0,
      revision: 1,
      document: withMatches(
        estate,
        {
          contractors: ["contractor", "electrician"],
          inquiries: ["available", "inquiry"],
          rooms: ["pricing", "vacancy"],
          rent: ["resident"],
          income: ["resident"],
        },
        [
          {
            key: "portfolio",
            label: "412 Dune Ridge Rd",
            icon: "home",
            slot: "above",
            detail: "Co-living · 5 rooms",
            sources: [{ source: "tasks", match: ["dune ridge"] }],
          },
          ...estate.satellites,
        ],
      ),
    },
    {
      boardKey: "hi-lawn-llc",
      position: 1,
      revision: 1,
      document: withMatches(service, {
        invoices: ["lawn customer", "hoa"],
        customers: ["lawn customer", "hoa"],
        "growth-report": ["lawn", "mowing", "quote", "estimate", "cleanup", "aeration"],
      }),
    },
  ];
}

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");
const today = () => new Date().toISOString().slice(0, 10);

/** Station records from the demo's existing rows. */
export function demoBoardReads(input: {
  pack: DemoScenarioPack;
  tasks: Row[];
  opportunities: Row[];
  conversations: { id: string; subject: string; unread: number; personId: string }[];
  actions: Row[];
  collections: {
    id: string;
    contactId: string;
    name: string;
    status: string;
    nextAction: string;
  }[];
}): BoardSourceReads {
  const role = (id: string) => input.pack.people.find((person) => person.id === id)?.role ?? "";
  const tasks: BoardSourceRecord[] = input.tasks
    .filter((row) => row.status !== "completed")
    .map((row) => ({
      sourceType: "tasks",
      sourceId: text(row.id),
      title: text(row.title),
      detail: text(row.related_name) || undefined,
      dueAt: text(row.due_date) || null,
      attention: Boolean(row.due_date && text(row.due_date) < today()),
      href: boardRecordHref("tasks", text(row.id)),
    }));
  const opportunities: BoardSourceRecord[] = input.opportunities
    .filter((row) => !["won", "lost"].includes(text(row.stage)))
    .map((row) => ({
      sourceType: "opportunities",
      sourceId: text(row.id),
      title: text(row.name),
      detail: text(row.next_action) || undefined,
      dueAt: text(row.next_action_at) || null,
      href: boardRecordHref("opportunities", text(row.id)),
    }));
  const conversations: BoardSourceRecord[] = input.conversations.map((row) => ({
    sourceType: "conversations",
    sourceId: row.id,
    title: row.subject,
    attention: row.unread > 0,
    href: boardRecordHref("conversations", row.id),
  }));
  const approvals: BoardSourceRecord[] = input.actions
    .filter((row) => row.status === "pending")
    .map((row) => ({
      sourceType: "approvals",
      sourceId: text(row.id),
      title: text(row.title),
      detail: text(row.description) || undefined,
      attention: true,
      href: boardRecordHref("approvals", text(row.id)),
    }));
  const collections: BoardSourceRecord[] = input.collections
    .filter((row) => row.status !== "settled")
    .map((row) => ({
      sourceType: "collections",
      sourceId: row.id,
      title: `${row.name} · ${role(row.contactId) || "Customer"}`,
      detail: row.nextAction,
      attention: true,
      href: boardRecordHref("collections", row.id),
    }));
  const contacts: BoardSourceRecord[] = input.pack.people.map((person) => ({
    sourceType: "contacts",
    sourceId: person.id,
    title: `${person.name} · ${person.role} · ${person.company}`,
    href: boardRecordHref("contacts", person.id, person.email),
  }));
  return { tasks, opportunities, conversations, approvals, collections, contacts };
}

export function demoBoardSnapshot(
  state: DemoBoardState,
  reads: BoardSourceReads,
): CommandBoardSnapshot {
  return {
    boards: state.boards,
    summaries: summarizeBoards(state.boards, reads),
    // Collections is enabled in every demo, so its reminder tool runs Invoice Chaser.
    skills: boardSkills(state.boards, (skill) => skill === "Invoice Chaser"),
    observedAt: new Date().toISOString(),
  };
}

const json = (body: object, status = 200) =>
  new Response(JSON.stringify({ ...body, simulated: true }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Handles /api/admin/board in the demo. Returns null for any other path. */
export function handleDemoBoard(input: {
  path: string;
  method: string;
  body: Record<string, unknown>;
  enabled: boolean;
  /** Seeds lazily, so board state is only built for board requests. */
  state: () => DemoBoardState;
  reads: () => BoardSourceReads;
  save: () => void;
}): Response | null {
  const { path, method, body, enabled } = input;
  if (path !== "/api/admin/board" && path !== "/api/admin/board/install") return null;
  if (!enabled) return json({ error: "Command Board is disabled in this demo workspace." }, 403);
  const state = input.state();
  if (path === "/api/admin/board" && method === "GET")
    return json(demoBoardSnapshot(state, input.reads()));
  // One receipt per request key: a retry replays, a reused key with new content is refused.
  const once = (requestId: string, request: unknown, run: () => object | Response) => {
    const fingerprint = JSON.stringify(request);
    const prior = state.receipts[requestId];
    if (prior)
      return prior.fingerprint === fingerprint
        ? json(prior.result as object)
        : json({ error: "Request key reused with different content." }, 409);
    const result = run();
    if (result instanceof Response) return result;
    state.receipts[requestId] = { fingerprint, result };
    input.save();
    return json(result);
  };
  const put = (board: Board) => {
    state.boards = [...state.boards.filter((b) => b.boardKey !== board.boardKey), board].sort(
      (a, b) => a.position - b.position,
    );
    return { boardKey: board.boardKey, revision: board.revision, position: board.position };
  };
  if (path === "/api/admin/board" && method === "POST") {
    const parsed = commandBoardSaveSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Check the board definition and try again." }, 400);
    const { requestId, ...change } = parsed.data;
    return once(requestId, parsed.data, () => {
      const current = state.boards.find((board) => board.boardKey === change.boardKey);
      if ((current?.revision ?? 0) !== change.revision)
        return json({ error: "This board changed in another session. Reload before saving." }, 409);
      return put({ ...change, revision: change.revision + 1 });
    });
  }
  if (path === "/api/admin/board/install" && method === "POST") {
    const parsed = commandBoardInstallSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Choose a mode and a business name." }, 400);
    const request = parsed.data;
    const plan = planBoardInstall(state.boards, request);
    if (plan.kind === "existing") {
      const { boardKey, revision, position } = plan.board;
      return json({ boardKey, revision, position, installed: false });
    }
    if (plan.kind === "conflict")
      return json({ error: "A different board already uses this key. Choose another name." }, 409);
    return once(request.requestId, request, () => ({
      ...put({
        boardKey: request.boardKey,
        position: plan.position,
        revision: 1,
        document: plan.document,
      }),
      installed: true,
    }));
  }
  return json({ error: "Unsupported Command Board demo operation." }, 404);
}
