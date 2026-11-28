import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  boardNodeId,
  commandBoardDocumentSchema,
  type CommandBoardSnapshot,
} from "../src/lib/revenue-os/command-board-contract";
import {
  COMMAND_BOARD_MODES,
  COMMAND_BOARD_MODE_KEYS,
} from "../src/lib/revenue-os/command-board-modes";
import {
  boardReadsFromGraph,
  boardSources,
  matchesBinding,
  summarizeBoards,
  summarizeStation,
  type BoardSourceReads,
  type BoardSourceRecord,
} from "../src/lib/revenue-os/command-board-summary";
import {
  GRAPH_PROJECTIONS,
  assembleWorkspaceGraph,
  type GraphProjection,
  type WorkspaceGraph,
} from "../src/lib/revenue-os/graph-adapter-contract";
import type { DemoGraphRows } from "../src/lib/admin/demo/graph-runtime";
import {
  commandBoardCanvasNodes,
  commandBoardStations,
} from "../src/lib/admin/command-board-canvas";
import {
  CANVAS_KINDS,
  canvasKindProblems,
  canvasTree,
  layoutCanvasTree,
  canvasVisibleNodes,
} from "../src/lib/admin/canvas-model";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import {
  demoBoardReads,
  handleDemoBoard,
  seedDemoBoards,
  type DemoBoardState,
} from "../src/lib/admin/demo/board-runtime";
import { EXTENSION_MODULES } from "../src/lib/revenue-os/extension-modules.generated";
import { isAiToolModuleEnabled, isModuleEnabled } from "../src/lib/revenue-os/modules";

// Templates: both modes validate, have stable unique ids and the shape the brief asks for.
for (const key of COMMAND_BOARD_MODE_KEYS) {
  const document = COMMAND_BOARD_MODES[key].template("Fictional Business");
  assert.equal(commandBoardDocumentSchema.parse(document).anchor.label, "Fictional Business");
  const stations = commandBoardStations("fixture", document);
  assert.equal(
    new Set(stations.map((s) => s.id)).size,
    stations.length,
    `${key}: station ids are unique`,
  );
  assert(
    stations.every((s) => s.station.sources.length > 0),
    `${key}: every station names a source`,
  );
}
const service = COMMAND_BOARD_MODES.service.template("HI LAWN LLC");
assert.equal(service.phases.length, 4, "Service Mode has four phases");
assert(
  service.phases.every((phase) => phase.stations.length === 3),
  "Service Mode has three stations per phase",
);
const skills = service.phases.flatMap((phase) =>
  phase.stations.flatMap((station) => station.skills),
);
assert.deepEqual(
  skills.sort(),
  [
    "Booking Reminders",
    "Instant Quote",
    "Instant Text-Back",
    "Invoice Chaser",
    "Quote Follow-Up",
    "Review Request",
  ].sort(),
  "Service Mode binds the six skills from the brief",
);
const estate = COMMAND_BOARD_MODES["real-estate"].template("MLIVM LLC");
assert.deepEqual(
  estate.phases.map((phase) => phase.label),
  ["Acquire", "Execute", "PM", "AM"],
);
assert.deepEqual(
  estate.phases.find((phase) => phase.key === "execute")!.segments.map((segment) => segment.label),
  ["2A Projects", "2B Team & Permits", "2C Budget & Draws"],
);

// The contract refuses malformed boards.
assert.throws(() => commandBoardDocumentSchema.parse({ ...service, phases: [] }));
assert.throws(
  () =>
    commandBoardDocumentSchema.parse({
      ...service,
      phases: [{ ...service.phases[0]!, segments: estate.phases[0]!.segments }],
    }),
  /segments or stations/,
  "A phase cannot hold both segments and stations",
);
assert.throws(
  () =>
    commandBoardDocumentSchema.parse({
      ...service,
      phases: [service.phases[0], service.phases[0]],
    }),
  /Duplicate board key path/,
);

// Summaries are computed from records, never stored, and never show a false zero.
const taskRecords: BoardSourceRecord[] = [
  {
    sourceType: "tasks",
    sourceId: "t1",
    title: "Countertop install milestone",
    dueAt: "2026-11-10",
    attention: true,
    href: "/admin/work?task=t1",
  },
  {
    sourceType: "tasks",
    sourceId: "t2",
    title: "Final permit inspection",
    blocked: true,
    href: "/admin/work?task=t2",
  },
  {
    sourceType: "tasks",
    sourceId: "t3",
    title: "Cabinet install milestone",
    dueAt: "2026-11-30",
    href: "/admin/work?task=t3",
  },
];
const reads: BoardSourceReads = {
  tasks: { records: taskRecords, truncated: false },
  conversations: "unavailable",
};
const milestones = summarizeStation("m", [{ source: "tasks", match: ["milestone"] }], reads);
assert.equal(milestones.status, "attention");
assert.deepEqual(milestones.rows, [
  { label: "Open", value: "2 tasks" },
  { label: "Needs you", value: "Countertop install milestone · Nov 10" },
]);
assert.equal(milestones.records.length, 2);
assert.equal(
  summarizeStation("p", [{ source: "tasks", match: ["permit"] }], reads).status,
  "blocked",
);
const idle = summarizeStation("i", [{ source: "tasks", match: ["nothing-matches"] }], reads);
assert.deepEqual([idle.status, idle.rows[0]], ["idle", { label: "Open", value: "Nothing open" }]);
const down = summarizeStation("c", [{ source: "conversations", match: [] }], reads);
assert.deepEqual(
  down.rows[0],
  { label: "Sources", value: "Unavailable right now" },
  "Unavailable is not zero",
);
assert.deepEqual(down.unavailable, ["conversations"]);
assert(
  matchesBinding(taskRecords[0]!, { source: "tasks", match: ["COUNTERTOP"] }),
  "Matching ignores case",
);
assert(
  matchesBinding(
    { ...taskRecords[2]!, detail: "Kitchen phase" },
    { source: "tasks", match: ["kitchen"] },
  ),
  "Keywords match a record's detail as well as its title",
);
assert(
  !matchesBinding(taskRecords[0]!, { source: "opportunities", match: [] }),
  "Sources never cross",
);
assert.deepEqual(
  summarizeStation("m", [{ source: "tasks", match: ["milestone"] }], {
    tasks: { records: taskRecords, truncated: true },
  }).rows[0],
  { label: "Open", value: "2+ tasks" },
  "A source with more open records than were read shows a +",
);

// Graph reads: nodes become station records; a refused source is unavailable, not zero.
const graph = (projections: GraphProjection[], sources: WorkspaceGraph["sources"]) =>
  assembleWorkspaceGraph({
    projections,
    sources,
    links: { state: "skipped", truncated: false },
    perAdapter: 200,
  });
const ready = (adapter: WorkspaceGraph["sources"][number]["adapter"], truncated = false) => ({
  adapter,
  state: "ready" as const,
  nodes: 0,
  truncated,
  nextCursor: null,
});
const graphReads = boardReadsFromGraph(
  [
    graph(
      [
        GRAPH_PROJECTIONS.tasks([
          { id: "t1", title: "Roof milestone", status: "pending", due_date: "2026-11-01" },
        ]),
      ],
      [ready("tasks", true)],
    ),
    graph(
      [
        GRAPH_PROJECTIONS.tasks([
          { id: "t2", title: "Siding milestone", status: "pending", due_date: "2026-12-01" },
        ]),
      ],
      [ready("tasks")],
    ),
    graph(
      [GRAPH_PROJECTIONS.approvals([{ id: "a1", title: "Approve draw", status: "pending" }])],
      [ready("approvals")],
    ),
    graph(
      [],
      [
        {
          adapter: "collection_cases",
          state: "module_disabled",
          nodes: 0,
          truncated: false,
          nextCursor: null,
        },
      ],
    ),
  ],
  "2026-11-14",
);
assert.deepEqual(
  graphReads.tasks !== "unavailable" &&
    graphReads.tasks?.records.map((record) => [
      record.sourceId,
      record.attention,
      record.href,
      record.detail,
    ]),
  [
    ["t1", true, "/admin/work?task=t1", "Due Nov 1"],
    ["t2", false, "/admin/work?task=t2", "Due Dec 1"],
  ],
  "Pages merge, and a task past its date needs a person",
);
assert.equal(graphReads.tasks !== "unavailable" && graphReads.tasks?.truncated, false);
assert.equal(
  graphReads.approvals !== "unavailable" && graphReads.approvals?.records[0]?.attention,
  true,
);
assert.equal(graphReads.collections, "unavailable", "A disabled source is unavailable");
assert.equal(graphReads.contacts, undefined, "An unread source is left out");

// Canvas projection: one anchor per board, unique ids, statuses from summaries, kinds held to the floors.
const boards: CommandBoardSnapshot["boards"] = [
  { boardKey: "mlivm-llc", position: 0, revision: 1, document: estate },
  { boardKey: "hi-lawn-llc", position: 1, revision: 1, document: service },
];
assert.deepEqual(boardSources(boards).sort(), [
  "approvals",
  "collections",
  "contacts",
  "conversations",
  "opportunities",
  "tasks",
]);
const snapshot: CommandBoardSnapshot = {
  boards,
  summaries: summarizeBoards(boards, reads),
  skills: {},
  observedAt: new Date().toISOString(),
};
const nodes = commandBoardCanvasNodes(snapshot);
assert.deepEqual(
  nodes.filter((node) => node.parentId === null).map((node) => node.label),
  ["MLIVM LLC", "HI LAWN LLC"],
);
assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length);
const milestoneNode = nodes.find(
  (node) => node.id === boardNodeId("mlivm-llc", "execute", "projects", "milestones"),
)!;
assert.equal(milestoneNode.status, "attention");
assert.equal(milestoneNode.kind, "station");
assert.deepEqual(canvasKindProblems(CANVAS_KINDS), []);
const visible = canvasVisibleNodes(nodes, boardNodeId("mlivm-llc", "execute"), "path");
const layout = layoutCanvasTree(visible, CANVAS_KINDS, { compact: true });
assert.equal(layout.placements.size, visible.length, "Every visible board node is placed");
assert(canvasTree(nodes).roots.length === 2);

// Demo: the MLIVM desk seeds two boards whose stations find their fictional records.
const pack = DEMO_SCENARIOS.mlivm;
const seeded = seedDemoBoards(pack);
assert.deepEqual(
  seeded.map((board) => board.document.anchor.label),
  ["MLIVM LLC", "HI LAWN LLC"],
);
assert.deepEqual(
  seedDemoBoards(DEMO_SCENARIOS["northline-roofing"]),
  [],
  "Other workspaces start with setup",
);
const demoRows: DemoGraphRows = {
  contacts: pack.people.map((person) => ({
    id: person.id,
    full_name: person.name,
    primary_email: person.email,
    title: person.role,
  })),
  companies: [],
  opportunities: pack.opportunities.map((o) => ({ id: o.id, name: o.name, stage: o.stage })),
  tasks: pack.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    due_date: "2026-11-20",
  })),
  approvals: pack.actions.map((a) => ({
    id: a.id,
    title: a.title,
    action_type: a.type,
    status: "pending",
  })),
  conversations: pack.conversations.map((c) => ({
    id: c.id,
    subject: c.subject,
    status: "open",
    unread_count: c.unread,
  })),
  collection_cases: pack.people.slice(0, 5).map((person, index) => ({
    id: `00000000-0000-4000-8500-00000000000${index + 1}`,
    contactId: person.id,
    name: person.name,
    currency: "usd",
    status: "open",
    nextAction: "Review overdue invoices",
  })),
  invoices: [],
};
const demoReads = demoBoardReads(demoRows, { modules: { "receivables-collections": true } });
const demoSummaries = summarizeBoards(seeded, demoReads);
const idleStations = Object.entries(demoSummaries)
  .filter(([id, summary]) => summary.status === "idle" && !id.endsWith(":expenses"))
  .map(([id]) => id);
assert.deepEqual(idleStations, [], "Every MLIVM station finds fictional records");
const balances = (key: string) =>
  demoSummaries[key]!.records.map((record) => record.title.split(" (")[0]);
assert.deepEqual(
  balances(boardNodeId("hi-lawn-llc", "accounts", "invoices")),
  ["Gus Henriksen", "Benji Ruiz"],
  "HI LAWN chases only its own balances",
);
assert.ok(
  balances(boardNodeId("mlivm-llc", "pm", "rent-roll", "rent")).every((name) =>
    ["Talia Okafor", "Dara Kowalczyk", "Priyanka Solberg"].includes(name!),
  ),
  "MLIVM rent shows residents only",
);

async function demoTransport() {
  // Demo transport: replay-safe saves, stale revisions refused, idempotent install, disable honoured.
  const state: DemoBoardState = { boards: seedDemoBoards(pack), receipts: {} };
  let saves = 0;
  const call = (path: string, method: string, body: Record<string, unknown> = {}, enabled = true) =>
    handleDemoBoard({
      path,
      method,
      body,
      enabled,
      state: () => state,
      reads: () => demoReads,
      save: () => saves++,
    });
  const json = async (response: Response | null) => {
    assert(response);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  assert.equal(call("/api/admin/elsewhere", "GET"), null);
  assert.equal(
    (await json(call("/api/admin/board", "GET", {}, false))).status,
    403,
    "Disabled App refuses reads",
  );
  const read = await json(call("/api/admin/board", "GET"));
  assert.equal(read.status, 200);
  assert.equal((read.body.boards as unknown[]).length, 2);
  const requestId = "00000000-0000-4000-8000-000000000001";
  const change = {
    boardKey: "hi-lawn-llc",
    revision: 1,
    position: 1,
    document: { ...service, anchor: { ...service.anchor, label: "HI LAWN" } },
    requestId,
  };
  assert.equal((await json(call("/api/admin/board", "POST", change))).body.revision, 2);
  assert.equal(
    (await json(call("/api/admin/board", "POST", change))).body.revision,
    2,
    "A retried save replays",
  );
  assert.equal(saves, 1, "A replay does not save twice");
  assert.equal(
    (
      await json(
        call("/api/admin/board", "POST", {
          ...change,
          requestId: "00000000-0000-4000-8000-000000000002",
        }),
      )
    ).status,
    409,
    "A stale revision is refused",
  );
  const install = {
    mode: "service",
    label: "HI LAWN",
    boardKey: "hi-lawn-llc",
    requestId: "00000000-0000-4000-8000-000000000003",
  };
  assert.equal(
    (await json(call("/api/admin/board/install", "POST", install))).body.installed,
    false,
    "Installing the same mode twice changes nothing",
  );
  const fresh = await json(
    call("/api/admin/board/install", "POST", {
      ...install,
      boardKey: "north-yard",
      label: "North Yard",
    }),
  );
  assert.deepEqual([fresh.body.installed, fresh.body.position], [true, 2]);
  assert.equal(
    (await json(call("/api/admin/board/install", "POST", { ...install, mode: "real-estate" })))
      .status,
    409,
  );
}

// Module gating: the App and its tools are refused when disabled and available when enabled.
const manifest = EXTENSION_MODULES.find((module) => module.id === "command-board");
assert(manifest, "The manifest is registered");
assert.equal(manifest.defaultEnabled, false);
assert.deepEqual(manifest.routes, ["/admin/board"]);
for (const tool of [
  "get_command_board",
  "preview_command_board_change",
  "propose_command_board_change",
]) {
  assert.equal(
    isAiToolModuleEnabled(tool, { modules: { "command-board": false } }).enabled,
    false,
    `${tool} is unavailable when disabled`,
  );
  assert.equal(
    isAiToolModuleEnabled(tool, { modules: { "command-board": true } }).enabled,
    true,
    `${tool} is available when enabled`,
  );
}
assert.equal(isModuleEnabled("command-board", {}), false, "Command Board starts disabled");
const service_source = readFileSync("src/lib/revenue-os/command-board.ts", "utf8");
for (const fn of [
  "readCommandBoard",
  "saveCommandBoard",
  "installCommandBoardMode",
  "previewCommandBoardChange",
  "executeCommandBoardChange",
])
  assert.match(
    service_source,
    new RegExp(`export async function ${fn}[\\s\\S]*?requireCommandBoard\\(db\\)`),
    `${fn} rechecks live module enablement`,
  );
const migration = readFileSync("migrations/20261114180000_command_board.sql", "utf8");
assert.match(migration, /CREATE POLICY command_board_read[\s\S]*has_active_tenant_membership/);
assert.doesNotMatch(
  migration,
  /command_board_definitions FOR (ALL|INSERT|UPDATE)/,
  "Board rows change only through the writer",
);
assert.match(
  migration,
  /role='admin' AND status='active'/,
  "Saving requires an active administrator",
);
assert.match(migration, /ERRCODE='40001'/, "Stale revisions are refused");
assert.match(migration, /INSERT INTO public\.audit_log/, "Every save is audited");

demoTransport()
  .then(() =>
    console.log(JSON.stringify({ result: "passed", stations: Object.keys(demoSummaries).length })),
  )
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
