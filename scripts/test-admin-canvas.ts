import assert from "node:assert/strict";
import {
  CANVAS_LEGIBLE_PX,
  CANVAS_LEVEL_MIN_ZOOM,
  CANVAS_LEVELS,
  CANVAS_SHAPES,
  CANVAS_TARGET_PX,
  CANVAS_TYPE,
  CANVAS_ZOOM,
  canvasAncestors,
  canvasCameraFor,
  canvasNeighbour,
  canvasReveal,
  canvasSignature,
  canvasTabStop,
  canvasTree,
  layoutCanvasTree,
  nextCanvasLevel,
  type CanvasLevel,
  type CanvasNode,
  type CanvasShape,
} from "../src/lib/admin/canvas-model";
import { approvalsCanvasGraph, todayCanvasGraph } from "../src/lib/admin/canvas-projections";
import { projectOperatorAttention } from "../src/lib/revenue-os/operator-attention";
import { attentionFingerprint, attentionKey } from "../src/lib/admin/today-workspace";

// Legibility and target floors hold at the lowest zoom each level can appear.
for (const shape of Object.keys(CANVAS_TYPE) as CanvasShape[]) {
  for (const level of Object.keys(CANVAS_LEVEL_MIN_ZOOM) as CanvasLevel[]) {
    const zoom = CANVAS_LEVEL_MIN_ZOOM[level];
    const type = CANVAS_TYPE[shape][level];
    for (const size of [type.label, type.detail])
      if (size !== null)
        assert(
          size * zoom >= CANVAS_LEGIBLE_PX,
          `${shape} ${level} text ${size}px is illegible at ${zoom}`,
        );
    if (type.opener)
      assert(
        CANVAS_SHAPES[shape].height * zoom >= CANVAS_TARGET_PX,
        `${shape} ${level} opener is below the target floor at ${zoom}`,
      );
    if (!type.opener) assert.equal(type.label, null, "Non-opener marks carry no text");
  }
}
assert.equal(CANVAS_LEVEL_MIN_ZOOM.far, CANVAS_ZOOM.min);

// Hysteresis: a level holds inside its band and changes only past the band edge.
assert.equal(nextCanvasLevel("far", 0.5), "far");
assert.equal(nextCanvasLevel("far", 0.6), "far", "Entering mid needs the enter threshold");
assert.equal(nextCanvasLevel("far", CANVAS_LEVELS.mid.enter), "mid");
assert.equal(nextCanvasLevel("mid", 0.6), "mid", "Mid holds above its exit threshold");
assert.equal(nextCanvasLevel("mid", 0.57), "far");
assert.equal(nextCanvasLevel("mid", 0.99), "mid");
assert.equal(nextCanvasLevel("mid", 1), "near");
assert.equal(nextCanvasLevel("near", 0.96), "near");
assert.equal(nextCanvasLevel("near", 0.94), "mid");
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
  groupLinks.every((link) => link.attach === "top"),
  "Groups attach from above in a row",
);
assert(
  layout.links
    .filter((link) => link.from.startsWith("group:"))
    .every((link) => link.attach === "left"),
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

console.log(JSON.stringify({ result: "passed", nodes: big.length, bounds: layout.bounds }));
