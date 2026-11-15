/**
 * Fictional Command Board for the shared demo engine. Boards live in session
 * state; station records come through the demo workspace graph, and summaries,
 * install planning and skill availability use the same functions as the live
 * board, over the rows the rest of the demo shows.
 */
import {
  COMMAND_BOARD_SOURCES,
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
  BOARD_SOURCE_ADAPTERS,
  boardReadsFromGraph,
  boardSkills,
  summarizeBoards,
  type BoardSourceReads,
} from "@/lib/revenue-os/command-board-summary";
import { GRAPH_MAX_LIMIT, type WorkspaceGraph } from "@/lib/revenue-os/graph-adapter-contract";
import { demoWorkspaceGraph, type DemoGraphRows } from "./graph-runtime";
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
  // Collection cases carry the billing contact's name, so balance stations split by name.
  const residents = ["okafor", "kowalczyk", "solberg"];
  const lawnAccounts = ["henriksen", "ruiz", "tanaka"];
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
          rent: residents,
          income: residents,
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
        invoices: lawnAccounts,
        customers: ["lawn customer", "hoa"],
        "growth-report": ["lawn", "mowing", "quote", "estimate", "cleanup", "aeration"],
      }),
    },
  ];
}

/** Station records through the demo graph read, the path the live board takes. */
export function demoBoardReads(
  rows: DemoGraphRows,
  tenantConfig: { modules?: Partial<Record<string, boolean>> },
): BoardSourceReads {
  return boardReadsFromGraph(
    COMMAND_BOARD_SOURCES.map((source) => {
      const query = new URLSearchParams({
        adapters: BOARD_SOURCE_ADAPTERS[source],
        open: "true",
        links: "false",
        limit: String(GRAPH_MAX_LIMIT),
      });
      return demoWorkspaceGraph(rows, query, tenantConfig).body as WorkspaceGraph;
    }),
  );
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
