import assert from "node:assert/strict";
import {
  CANVAS_KINDS,
  CANVAS_LEVEL_MIN_ZOOM,
  CANVAS_LEVELS,
  CANVAS_ZOOM,
  canvasAncestors,
  canvasCameraFor,
  canvasKindProblems,
  canvasNeighbour,
  canvasReveal,
  canvasSignature,
  canvasTabStop,
  canvasTree,
  canvasVisibleNodes,
  layoutCanvasTree,
  nextCanvasLevel,
  type CanvasNode,
} from "../src/lib/admin/canvas-model";
import { approvalsCanvasGraph, todayCanvasGraph } from "../src/lib/admin/canvas-projections";
import { projectOperatorAttention } from "../src/lib/revenue-os/operator-attention";
import { attentionFingerprint, attentionKey } from "../src/lib/admin/today-workspace";

// Legibility and target floors hold for every built-in kind at the lowest zoom each level can appear.
assert.deepEqual(canvasKindProblems(CANVAS_KINDS), []);
assert.equal(CANVAS_LEVEL_MIN_ZOOM.far, CANVAS_ZOOM.min);
assert.deepEqual(
  canvasKindProblems({
    tiny: {
      shape: "card",
      width: 200,
      height: 60,
      type: {
        far: { label: 12, detail: null, opener: true },
        mid: { label: 16, detail: null, opener: true },
        near: { label: 14, detail: 10, opener: true },
      },
    },
  }),
  [
    "tiny far: 12px text is illegible at 0.4",
    "tiny far: opener is below the target floor at 0.4",
    "tiny mid: 16px text is illegible at 0.58",
    "tiny mid: opener is below the target floor at 0.58",
    "tiny near: 10px text is illegible at 0.75",
  ],
  "App-defined kinds are held to the same floors",
);

// Hysteresis: a level holds inside its band and changes only past the band edge.
assert.equal(nextCanvasLevel("far", 0.5), "far");
assert.equal(nextCanvasLevel("far", 0.6), "far", "Entering mid needs the enter threshold");
assert.equal(nextCanvasLevel("far", CANVAS_LEVELS.mid.enter), "mid");
assert.equal(nextCanvasLevel("mid", 0.6), "mid", "Mid holds above its exit threshold");
assert.equal(nextCanvasLevel("mid", 0.57), "far");
assert.equal(nextCanvasLevel("mid", 0.79), "mid");
assert.equal(nextCanvasLevel("mid", CANVAS_LEVELS.near.enter), "near");
assert.equal(nextCanvasLevel("near", 0.76), "near", "Near holds above its exit threshold");
assert.equal(nextCanvasLevel("near", 0.74), "mid");
assert.equal(nextCanvasLevel("near", 0.3), "far");

// Layout: deterministic and overlap-free at 500 nodes.
const kinds = ["decision", "work", "watch", "upcoming"] as const;
const now = Date.parse("2026-11-14T12:00:00Z");
const attention = projectOperatorAttention(
  Array.from({ length: 495 }, (_, index) => {
    const kind = kinds[index % 4]!;
    const prefix = { decision: "action", work: "task", watch: "conversation", upcoming: "meeting" }[
      kind
    ];
    return {
      id: `${prefix}:${index}`,
      title: `Item ${index}`,
      summary: "Summary",
      kind: "task",
      urgency: "normal",
      sourceTimestamp: new Date(now).toISOString(),
      dueAt: new Date(now + index * 3600_000).toISOString(),
      priorityReason: "Reason",
      recommendedNextAction: "Next",
      href: "/admin/work",
    };
  }),
);
const empty = { muted: [], pins: [] };
const big = todayCanvasGraph(attention, empty);
assert.equal(big.length, 500, "Root, four groups and 495 items");
const layout = layoutCanvasTree(big);
assert.deepEqual(
  [...layoutCanvasTree(big).placements.entries()],
  [...layout.placements.entries()],
  "Layout is deterministic",
);
assert.equal(layout.placements.size, big.length);
assert.equal(layout.links.length, big.length - 1, "Every non-root node has one tree link");
const boxes = [...layout.placements.entries()];
const sorted = [...boxes].sort((a, b) => a[1].x - b[1].x);
for (let i = 0; i < sorted.length; i++) {
  const [aId, a] = sorted[i]!;
  for (let j = i + 1; j < sorted.length; j++) {
    const [bId, b] = sorted[j]!;
    if (b.x >= a.x + a.width) break;
    const overlap = a.y < b.y + b.height && b.y < a.y + a.height;
    assert(!overlap, `${aId} overlaps ${bId}`);
  }
}
const root = layout.placements.get("today")!;
for (const kind of kinds) {
  const group = layout.placements.get(`group:${kind}`)!;
  assert(group.y > root.y + root.height, "Groups sit below the anchor");
}
const groupLinks = layout.links.filter((link) => link.from === "today");
assert(
  groupLinks.every((link) => link.target === "top"),
  "Groups attach from above in a row",
);
assert(
  layout.links
    .filter((link) => link.from.startsWith("group:"))
    .every((link) => link.target === "left"),
  "Leaf records hang in a column",
);
assert.equal(
  canvasSignature(big),
  canvasSignature(big.map((node) => ({ ...node, label: "changed" }))),
);

// Camera: legible framing, clamped zoom, tall scopes keep the top in view.
const tree = canvasTree(big);
const viewport = { width: 1440, height: 760 };
const overview = canvasCameraFor(tree, layout, null, viewport);
assert(overview.zoom >= CANVAS_ZOOM.min && overview.zoom <= 1);
const scoped = canvasCameraFor(tree, layout, "group:work", viewport);
const work = layout.placements.get("group:work")!;
assert(work.y * scoped.zoom + scoped.y >= 0, "Scope top is visible");
assert(scoped.zoom >= CANVAS_LEVELS.mid.enter, "A scope opens at a legible level");
const phone = canvasCameraFor(tree, layout, null, { width: 390, height: 640 });
assert(phone.zoom >= CANVAS_ZOOM.min);

// Reveal pans the minimum distance and leaves visible nodes alone.
assert.equal(
  canvasReveal({ x: 100, y: 100, width: 50, height: 50 }, { x: 0, y: 0, zoom: 1 }, viewport),
  null,
);
assert.deepEqual(
  canvasReveal({ x: 1500, y: 100, width: 100, height: 50 }, { x: 0, y: 0, zoom: 1 }, viewport),
  { x: 1440 - 24 - 1600, y: 0, zoom: 1 },
);

// Keyboard neighbours follow the tree and skip marks at far zoom.
const firstDecision = attentionKey(attention.find((item) => item.attentionKind === "decision")!);
assert.equal(canvasNeighbour(tree, "today", "ArrowRight", "near"), "group:decision");
assert.equal(canvasNeighbour(tree, "group:decision", "ArrowDown", "near"), "group:work");
assert.equal(canvasNeighbour(tree, "group:work", "ArrowUp", "near"), "group:decision");
assert.equal(canvasNeighbour(tree, "group:decision", "ArrowUp", "near"), null);
assert.equal(canvasNeighbour(tree, "group:decision", "End", "near"), "group:upcoming");
assert.equal(canvasNeighbour(tree, "group:decision", "ArrowRight", "near"), firstDecision);
assert.equal(canvasNeighbour(tree, firstDecision, "ArrowLeft", "near"), "group:decision");
assert.equal(
  canvasNeighbour(tree, "group:decision", "ArrowRight", "far"),
  null,
  "Cards are marks at far zoom",
);
assert.equal(canvasTabStop(tree, firstDecision, "far"), "group:decision");
assert.equal(canvasTabStop(tree, firstDecision, "mid"), firstDecision);
assert.deepEqual(
  canvasAncestors(tree, firstDecision).map((node) => node.id),
  ["today", "group:decision", firstDecision],
);

// Projections reference sources and reuse the existing Today preferences.
const muted = attention[1]!;
const pinned = attention[9]!;
const projected = todayCanvasGraph(attention.slice(0, 12), {
  muted: [{ key: attentionKey(muted), fingerprint: attentionFingerprint(muted) }],
  pins: [attentionKey(pinned)],
});
assert(!projected.some((node) => node.id === attentionKey(muted)), "Muted findings stay hidden");
const items = projected.filter((node) => node.data.kind === "item");
assert(
  items.every((node) => node.data.kind === "item" && node.id === attentionKey(node.data.item)),
);
const workItems = projected.filter((node) => node.parentId === `group:${pinned.attentionKind}`);
assert.equal(workItems[0]!.id, attentionKey(pinned), "Pinned items lead their group");
assert(
  !projected.some((node) => node.data.kind === "group" && node.data.count === 0),
  "Empty groups are omitted",
);

const action = (
  id: string,
  patch: Partial<Parameters<typeof approvalsCanvasGraph>[0][number]> = {},
) => ({
  id,
  action_type: "send_email",
  title: `Action ${id}`,
  description: null,
  reasoning: null,
  urgency: "normal",
  status: "pending",
  created_at: "2026-11-14T10:00:00Z",
  expires_at: null,
  ...patch,
});
const approvals = approvalsCanvasGraph(
  [
    action("a", { urgency: "critical" }),
    action("b", { status: "approved" }),
    action("c", { expires_at: "2026-11-14T11:00:00Z" }),
    action("d", { urgency: "unexpected" }),
    action("e", { created_at: "2026-11-14T09:00:00Z" }),
  ],
  now,
);
assert.deepEqual(
  approvals.map((node) => node.id),
  ["approvals", "group:critical", "approval:a", "group:normal", "approval:e", "approval:d"],
  "Only pending, unexpired actions appear, grouped by urgency and oldest first",
);

assert.throws(
  () => canvasTree([...big.slice(0, 2), big[1]!] as CanvasNode[]),
  /Duplicate canvas node id/,
);
assert.throws(
  () => layoutCanvasTree([{ id: "x", parentId: null, kind: "unknown", label: "X", data: null }]),
  /Unknown canvas node kind/,
);

// Desk unspooling: satellites sit beside their parent and only the opened path shows children.
const desk: CanvasNode<null>[] = [
  { id: "a", parentId: null, kind: "anchor", label: "A", data: null },
  { id: "a:place", parentId: "a", kind: "satellite", slot: "above", label: "Place", data: null },
  { id: "a:talk", parentId: "a", kind: "satellite", slot: "right", label: "Talk", data: null },
  { id: "b", parentId: null, kind: "anchor", label: "B", data: null },
  ...["1", "2", "3", "4"].map((p) => ({ id: `a:${p}`, parentId: "a", kind: "hub", label: p, data: null })),
  ...["x", "y", "z"].map((s) => ({ id: `a:2:${s}`, parentId: "a:2", kind: "segment", label: s, data: null })),
  { id: "a:2:y:s", parentId: "a:2:y", kind: "station", label: "Station", data: null },
  { id: "b:1", parentId: "b", kind: "hub", label: "B1", data: null },
];
const ids = (list: CanvasNode<null>[]) => list.map((node) => node.id);
assert.deepEqual(ids(canvasVisibleNodes(desk, null, "path")), ["a", "a:place", "a:talk", "b"]);
assert.deepEqual(ids(canvasVisibleNodes(desk, "a", "path")), [
  "a",
  "a:place",
  "a:talk",
  "b",
  "a:1",
  "a:2",
  "a:3",
  "a:4",
]);
assert.deepEqual(
  ids(canvasVisibleNodes(desk, "a:2", "path")),
  ["a", "a:place", "a:talk", "b", "a:1", "a:2", "a:3", "a:4", "a:2:x", "a:2:y", "a:2:z"],
  "Opening a hub keeps its siblings and unspools its segments",
);
assert.equal(canvasVisibleNodes(desk, "a:2", "all").length, desk.length);
const deskTree = canvasTree(desk);
assert.deepEqual(ids(deskTree.satellites.get("a")!), ["a:place", "a:talk"]);
assert(!deskTree.children.get("a")!.some((node) => node.slot), "Satellites are not row children");
const deskLayout = layoutCanvasTree(canvasVisibleNodes(desk, "a:2", "path"));
const anchor = deskLayout.placements.get("a")!;
const above = deskLayout.placements.get("a:place")!;
const right = deskLayout.placements.get("a:talk")!;
assert(above.y + above.height < anchor.y, "Above satellite sits over the anchor");
assert.equal(above.x + above.width / 2, anchor.x + anchor.width / 2, "Above satellite is centred");
assert(right.x > anchor.x + anchor.width, "Right satellite sits beside the anchor");
assert(
  deskLayout.placements.get("b")!.x > right.x + right.width,
  "The next anchor clears the right satellite",
);
const linkFor = (to: string) => deskLayout.links.find((l) => l.to === to)!;
assert.deepEqual([linkFor("a:place").source, linkFor("a:place").target], ["top", "bottom"]);
assert.deepEqual([linkFor("a:talk").source, linkFor("a:talk").target], ["right", "left"]);
assert.deepEqual([linkFor("a:2:y").source, linkFor("a:2:y").target], ["bottom", "top"]);
const segments = ["x", "y", "z"].map((s) => deskLayout.placements.get(`a:2:${s}`)!);
assert(
  segments.every((segment) => segment.y === segments[0]!.y),
  "Short leaf lists stay in a row like the prototype",
);
assert.equal(canvasNeighbour(deskTree, "a", "ArrowRight", "near"), "a:1");
assert.equal(canvasNeighbour(deskTree, "a:4", "ArrowDown", "near"), "a:place", "Satellites follow children");
const close = canvasCameraFor(deskTree, deskLayout, "a:2", { width: 2600, height: 1600 }, { maxZoom: 1.5 });
assert(close.zoom > 1, "A small scope can be framed closer when the App allows it");
assert(
  canvasCameraFor(deskTree, deskLayout, "a:2", { width: 2600, height: 1600 }).zoom <= 1,
  "Framing defaults to at most 100%",
);

console.log(JSON.stringify({ result: "passed", nodes: big.length, bounds: layout.bounds }));
