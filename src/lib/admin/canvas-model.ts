/**
 * Pure model for the shared canvas view: node kinds, semantic zoom levels,
 * unspooling, tree layout, camera framing and keyboard neighbours. The canvas
 * is a View: it arranges source records and owns no lifecycle or copied status.
 */

export type CanvasLevel = "far" | "mid" | "near";
export type CanvasShape = "circle" | "card";
export type CanvasStatus = "ok" | "attention" | "blocked" | "idle";
/** Where a node sits relative to its parent: in the child row or column, above it, or to its right. */
export type CanvasSlot = "child" | "above" | "right";

export interface CanvasKind {
  shape: CanvasShape;
  width: number;
  height: number;
  /** Text sizes in CSS px at zoom 1, and whether the node opens at that level. */
  type: Record<CanvasLevel, { label: number | null; detail: number | null; opener: boolean }>;
}

export interface CanvasNode<T = unknown> {
  /** Stable display id, normally `sourceType:sourceId`. */
  id: string;
  parentId: string | null;
  kind: string;
  label: string;
  data: T;
  slot?: CanvasSlot;
  status?: CanvasStatus;
}

export interface CanvasLink {
  id: string;
  from: string;
  to: string;
}

export type CanvasKinds = Record<string, CanvasKind>;

const circleType = (far: number, mid: number, near: number): CanvasKind["type"] => ({
  far: { label: far, detail: null, opener: true },
  mid: { label: mid, detail: null, opener: true },
  near: { label: near, detail: 14, opener: true },
});

/**
 * Built-in kinds. Every text size times its level's minimum zoom stays at or
 * above the 10.5px legibility floor, and every opener stays at or above the
 * 44px target floor. Apps may pass their own kinds held to the same floors.
 */
export const CANVAS_KINDS = {
  anchor: { shape: "circle", width: 200, height: 200, type: circleType(30, 24, 22) },
  hub: { shape: "circle", width: 152, height: 152, type: circleType(27, 20, 18) },
  satellite: { shape: "circle", width: 136, height: 136, type: circleType(27, 19, 14) },
  segment: {
    shape: "card",
    width: 300,
    height: 112,
    type: {
      far: { label: 27, detail: null, opener: true },
      mid: { label: 20, detail: null, opener: true },
      near: { label: 18, detail: 14, opener: true },
    },
  },
  station: {
    shape: "card",
    width: 340,
    height: 228,
    type: {
      far: { label: 30, detail: null, opener: true },
      mid: { label: 22, detail: 19, opener: true },
      near: { label: 18, detail: 14, opener: true },
    },
  },
  record: {
    shape: "card",
    width: 296,
    height: 124,
    type: {
      far: { label: null, detail: null, opener: false },
      mid: { label: 19, detail: null, opener: true },
      near: { label: 16, detail: 14, opener: true },
    },
  },
} satisfies CanvasKinds;

export const CANVAS_ZOOM = { min: 0.4, max: 1.6 } as const;

/** A level is entered at `enter` and kept until zoom falls below `exit`. */
export const CANVAS_LEVELS = {
  mid: { enter: 0.62, exit: 0.58 },
  near: { enter: 0.8, exit: 0.75 },
} as const;

/** Lowest zoom at which each level can be on screen. */
export const CANVAS_LEVEL_MIN_ZOOM: Record<CanvasLevel, number> = {
  far: CANVAS_ZOOM.min,
  mid: CANVAS_LEVELS.mid.exit,
  near: CANVAS_LEVELS.near.exit,
};

export const CANVAS_LEGIBLE_PX = 10.5;
export const CANVAS_TARGET_PX = 44;

/** Floor violations for a kinds map, so App-defined kinds can be checked the same way. */
export function canvasKindProblems(kinds: CanvasKinds): string[] {
  const problems: string[] = [];
  for (const [name, kind] of Object.entries(kinds))
    for (const level of Object.keys(CANVAS_LEVEL_MIN_ZOOM) as CanvasLevel[]) {
      const zoom = CANVAS_LEVEL_MIN_ZOOM[level];
      const type = kind.type[level];
      for (const size of [type.label, type.detail])
        if (size !== null && size * zoom < CANVAS_LEGIBLE_PX)
          problems.push(`${name} ${level}: ${size}px text is illegible at ${zoom}`);
      if (type.opener && Math.min(kind.width, kind.height) * zoom < CANVAS_TARGET_PX)
        problems.push(`${name} ${level}: opener is below the target floor at ${zoom}`);
      if (!type.opener && type.label !== null)
        problems.push(`${name} ${level}: a non-opener mark must not carry text`);
    }
  return problems;
}

export function nextCanvasLevel(current: CanvasLevel, zoom: number): CanvasLevel {
  if (zoom >= CANVAS_LEVELS.near.enter) return "near";
  if (current === "near" && zoom >= CANVAS_LEVELS.near.exit) return "near";
  if (zoom >= CANVAS_LEVELS.mid.enter) return "mid";
  if (current !== "far" && zoom >= CANVAS_LEVELS.mid.exit) return "mid";
  return "far";
}

export function clampCanvasZoom(zoom: number) {
  return Math.min(CANVAS_ZOOM.max, Math.max(CANVAS_ZOOM.min, zoom));
}

export interface CanvasPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CanvasHandle = "top" | "bottom" | "left" | "right";

export interface CanvasLayoutLink extends CanvasLink {
  source: CanvasHandle;
  target: CanvasHandle;
}

export interface CanvasLayout {
  placements: Map<string, CanvasPlacement>;
  links: CanvasLayoutLink[];
  bounds: CanvasPlacement;
}

const GAP = { row: 48, column: 16, level: 72, indent: 40, root: 200, satellite: 140 } as const;

export interface CanvasTree<T> {
  byId: Map<string, CanvasNode<T>>;
  /** Child-slot children only, in input order. */
  children: Map<string | null, CanvasNode<T>[]>;
  satellites: Map<string, CanvasNode<T>[]>;
  roots: CanvasNode<T>[];
}

/** Index nodes by id and parent. A node whose parent is missing becomes a root. */
export function canvasTree<T>(nodes: readonly CanvasNode<T>[]): CanvasTree<T> {
  const byId = new Map<string, CanvasNode<T>>();
  for (const node of nodes) {
    if (byId.has(node.id)) throw new Error(`Duplicate canvas node id: ${node.id}`);
    byId.set(node.id, node);
  }
  const children = new Map<string | null, CanvasNode<T>[]>();
  const satellites = new Map<string, CanvasNode<T>[]>();
  const append = <K>(map: Map<K, CanvasNode<T>[]>, key: K, node: CanvasNode<T>) => {
    const list = map.get(key);
    if (list) list.push(node);
    else map.set(key, [node]);
  };
  for (const node of nodes) {
    const parent = node.parentId && byId.has(node.parentId) ? node.parentId : null;
    if (parent && node.slot && node.slot !== "child") append(satellites, parent, node);
    else append(children, parent, node);
  }
  return { byId, children, satellites, roots: children.get(null) ?? [] };
}

/** Structure signature: layout only reruns when ids, parents, kinds or slots change. */
export function canvasSignature(nodes: readonly CanvasNode<unknown>[]) {
  return nodes
    .map((node) => `${node.id}>${node.parentId ?? ""}:${node.kind}:${node.slot ?? "child"}`)
    .join("|");
}

export function canvasAncestors<T>(tree: CanvasTree<T>, id: string | null): CanvasNode<T>[] {
  const path: CanvasNode<T>[] = [];
  let current = id ? tree.byId.get(id) : undefined;
  while (current) {
    path.unshift(current);
    current = current.parentId ? tree.byId.get(current.parentId) : undefined;
  }
  return path;
}

/**
 * Which nodes are on screen. "all" shows the whole tree. "path" unspools like a
 * desk: roots, the children of every node on the way to the scope, the scope's
 * children, and the satellites of every visible node.
 */
export function canvasVisibleNodes<T>(
  nodes: readonly CanvasNode<T>[],
  scopeId: string | null,
  mode: "all" | "path",
): CanvasNode<T>[] {
  if (mode === "all") return [...nodes];
  const tree = canvasTree(nodes);
  const visible = new Set(tree.roots.map((node) => node.id));
  for (const node of canvasAncestors(tree, scopeId))
    for (const child of tree.children.get(node.id) ?? []) visible.add(child.id);
  for (const id of [...visible])
    for (const satellite of tree.satellites.get(id) ?? []) visible.add(satellite.id);
  return nodes.filter((node) => visible.has(node.id));
}

/**
 * Tidy top-down layout. Children that themselves have children spread in a row
 * under their parent; leaf children stack in a column hanging from the parent,
 * so hundreds of records grow downward. Satellites sit above or to the right.
 * Compact layout (for unspooled paths, where at most one branch per level is
 * open) spaces each row by its nodes alone and centres the open branch under
 * its parent, so opening a branch never pushes its siblings apart. Top-level
 * anchors always reserve room for their whole visible branch.
 */
export function layoutCanvasTree<T>(
  nodes: readonly CanvasNode<T>[],
  kinds: CanvasKinds = CANVAS_KINDS,
  options: { compact?: boolean } = {},
): CanvasLayout {
  const tree = canvasTree(nodes);
  const sizeOf = (node: CanvasNode<T>) => {
    const kind = kinds[node.kind];
    if (!kind) throw new Error(`Unknown canvas node kind: ${node.kind}`);
    return kind;
  };
  const kids = (id: string) => tree.children.get(id) ?? [];
  const sats = (id: string, slot: CanvasSlot) =>
    (tree.satellites.get(id) ?? []).filter((node) => node.slot === slot);
  const isColumn = (id: string) => {
    const list = kids(id);
    return list.length > 4 && list.every((child) => kids(child.id).length === 0);
  };
  const extras = (node: CanvasNode<T>) => {
    const above = sats(node.id, "above");
    const right = sats(node.id, "right");
    return {
      above: above.length ? Math.max(...above.map((s) => sizeOf(s).height)) + GAP.level : 0,
      right: right.length ? Math.max(...right.map((s) => sizeOf(s).width)) + GAP.satellite : 0,
    };
  };
  const own = (node: CanvasNode<T>) => sizeOf(node).width + extras(node).right * 2;
  const boxes = new Map<string, { width: number; height: number }>();
  const measure = (node: CanvasNode<T>): { width: number; height: number } => {
    const cached = boxes.get(node.id);
    if (cached) return cached;
    const size = sizeOf(node);
    const extra = extras(node);
    const list = kids(node.id);
    const self = { width: own(node), height: extra.above + size.height };
    let box = self;
    if (list.length && isColumn(node.id)) {
      const widest = Math.max(...list.map((child) => sizeOf(child).width));
      const stacked = list.reduce((sum, child) => sum + sizeOf(child).height, 0);
      box = {
        width: Math.max(self.width, size.width / 2 + GAP.indent + widest),
        height: self.height + GAP.level + stacked + (list.length - 1) * GAP.column,
      };
    } else if (list.length) {
      const measured = list.map(measure);
      const row = measured.reduce((sum, child) => sum + child.width, 0);
      box = {
        width: Math.max(self.width, row + (list.length - 1) * GAP.row),
        height: self.height + GAP.level + Math.max(...measured.map((child) => child.height)),
      };
    }
    boxes.set(node.id, box);
    return box;
  };
  const span = (node: CanvasNode<T>) => (options.compact ? own(node) : measure(node).width);

  const placements = new Map<string, CanvasPlacement>();
  const links: CanvasLayoutLink[] = [];
  const link = (from: string, to: string, source: CanvasHandle, target: CanvasHandle) =>
    links.push({ id: `${from}->${to}`, from, to, source, target });
  /** Place a node centred in a slot `width` wide starting at `left`, or at `left` in a column. */
  const place = (node: CanvasNode<T>, left: number, top: number, width: number, column: boolean) => {
    const size = sizeOf(node);
    const extra = extras(node);
    const list = kids(node.id);
    const x = column ? left : left + (width - size.width) / 2;
    const y = top + extra.above;
    placements.set(node.id, { x, y, width: size.width, height: size.height });
    for (const satellite of sats(node.id, "above")) {
      const s = sizeOf(satellite);
      placements.set(satellite.id, {
        x: x + (size.width - s.width) / 2,
        y: y - GAP.level - s.height,
        width: s.width,
        height: s.height,
      });
      link(node.id, satellite.id, "top", "bottom");
    }
    sats(node.id, "right").forEach((satellite, index) => {
      const s = sizeOf(satellite);
      placements.set(satellite.id, {
        x: x + size.width + GAP.satellite,
        y: y + (size.height - s.height) / 2 + index * (s.height + GAP.column),
        width: s.width,
        height: s.height,
      });
      link(node.id, satellite.id, "right", "left");
    });
    let cursor = y + size.height + GAP.level;
    if (isColumn(node.id)) {
      for (const child of list) {
        link(node.id, child.id, "bottom", "left");
        place(child, x + size.width / 2 + GAP.indent, cursor, sizeOf(child).width, true);
        cursor += sizeOf(child).height + GAP.column;
      }
      return;
    }
    const rowWidth = list.reduce((sum, child) => sum + span(child), 0) + (list.length - 1) * GAP.row;
    let rowLeft = x + size.width / 2 - rowWidth / 2;
    for (const child of list) {
      link(node.id, child.id, "bottom", "top");
      place(child, rowLeft, cursor, span(child), false);
      rowLeft += span(child) + GAP.row;
    }
  };
  // Each top-level branch is laid out alone, then set beside the previous one by its real extent.
  let cursor = 0;
  for (const root of tree.roots) {
    const before = new Set(placements.keys());
    place(root, 0, 0, own(root), false);
    const added = [...placements.entries()].filter(([id]) => !before.has(id));
    const extent = boundsOf(added.map(([, box]) => box));
    const shift = cursor - extent.x;
    for (const [id, box] of added) placements.set(id, { ...box, x: box.x + shift });
    cursor += extent.width + GAP.root;
  }
  return { placements, links, bounds: boundsOf([...placements.values()]) };
}

function boundsOf(boxes: readonly CanvasPlacement[]): CanvasPlacement {
  if (!boxes.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Frame a scope: the scope node, its satellites and its first rows of
 * descendants. When the framed area is too tall to show legibly, the camera
 * keeps the width fitted and aligns the top instead of shrinking it into marks.
 */
export function canvasCameraFor<T>(
  tree: CanvasTree<T>,
  layout: CanvasLayout,
  scopeId: string | null,
  viewport: { width: number; height: number },
  options: {
    maxZoom?: number;
    /** Space kept clear for chrome laid over the canvas. */
    insets?: { top: number; right: number; bottom: number; left: number };
  } = {},
): CanvasViewport {
  const insets = options.insets ?? { top: 48, right: 48, bottom: 48, left: 48 };
  const maxZoom = options.maxZoom ?? 1;
  const scope = scopeId ? tree.byId.get(scopeId) : undefined;
  const framed: CanvasPlacement[] = [];
  const add = (node: CanvasNode<T>) => {
    const placement = layout.placements.get(node.id);
    if (placement) framed.push(placement);
    for (const satellite of tree.satellites.get(node.id) ?? []) {
      const s = layout.placements.get(satellite.id);
      if (s) framed.push(s);
    }
  };
  const collect = (node: CanvasNode<T>, depth: number) => {
    add(node);
    if (depth >= 2) return;
    for (const child of (tree.children.get(node.id) ?? []).slice(0, 6)) collect(child, depth + 1);
  };
  if (scope) {
    // Keep the scope's siblings in view so the row it came from stays readable.
    for (const sibling of tree.children.get(scope.parentId) ?? []) add(sibling);
    collect(scope, 0);
  } else for (const root of tree.roots) collect(root, 0);
  const box = boundsOf(framed);
  if (!box.width || !viewport.width || !viewport.height) return { x: 0, y: 0, zoom: 1 };
  const width = Math.max(1, viewport.width - insets.left - insets.right);
  const height = Math.max(1, viewport.height - insets.top - insets.bottom);
  const fitWidth = width / box.width;
  const fitBoth = Math.min(fitWidth, height / box.height);
  const legible = fitBoth >= CANVAS_LEVELS.mid.enter;
  const zoom = clampCanvasZoom(Math.min(maxZoom, legible ? fitBoth : fitWidth));
  const x = insets.left + width / 2 - (box.x + box.width / 2) * zoom;
  const y =
    box.height * zoom <= height
      ? insets.top + height / 2 - (box.y + box.height / 2) * zoom
      : insets.top - box.y * zoom;
  return { x, y, zoom };
}

/** Smallest pan that brings a node fully into view, or null when it already is. */
export function canvasReveal(
  placement: CanvasPlacement,
  view: CanvasViewport,
  viewport: { width: number; height: number },
  margin = 24,
): CanvasViewport | null {
  const left = placement.x * view.zoom + view.x;
  const top = placement.y * view.zoom + view.y;
  const right = left + placement.width * view.zoom;
  const bottom = top + placement.height * view.zoom;
  let dx = 0;
  let dy = 0;
  if (left < margin) dx = margin - left;
  else if (right > viewport.width - margin) dx = viewport.width - margin - right;
  if (top < margin) dy = margin - top;
  else if (bottom > viewport.height - margin) dy = viewport.height - margin - bottom;
  return dx || dy ? { x: view.x + dx, y: view.y + dy, zoom: view.zoom } : null;
}

export type CanvasKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End";

/**
 * Tree navigation over the visible nodes: Up and Down move between siblings,
 * Left to the parent, Right to the first child, Home and End to the first and
 * last sibling. Satellites follow their parent's children. Only nodes that
 * open at the current level can receive focus.
 */
export function canvasNeighbour<T>(
  tree: CanvasTree<T>,
  id: string,
  key: CanvasKey,
  level: CanvasLevel,
  kinds: CanvasKinds = CANVAS_KINDS,
): string | null {
  const node = tree.byId.get(id);
  if (!node) return null;
  const opens = (candidate: CanvasNode<T> | undefined) =>
    Boolean(candidate && kinds[candidate.kind]?.type[level].opener);
  const parentKey = node.parentId && tree.byId.has(node.parentId) ? node.parentId : null;
  const family = (parent: string | null) => [
    ...(tree.children.get(parent) ?? []),
    ...(parent ? (tree.satellites.get(parent) ?? []) : []),
  ];
  const siblings = family(parentKey).filter(opens);
  const index = siblings.findIndex((sibling) => sibling.id === id);
  switch (key) {
    case "ArrowUp":
      return index > 0 ? siblings[index - 1]!.id : null;
    case "ArrowDown":
      return index >= 0 && index < siblings.length - 1 ? siblings[index + 1]!.id : null;
    case "ArrowLeft":
      return parentKey && opens(tree.byId.get(parentKey)) ? parentKey : null;
    case "ArrowRight":
      return family(id).find(opens)?.id ?? null;
    case "Home":
      return siblings[0]?.id ?? null;
    case "End":
      return siblings.at(-1)?.id ?? null;
  }
}

/** The node that holds the single tab stop: the requested node or its nearest focusable ancestor. */
export function canvasTabStop<T>(
  tree: CanvasTree<T>,
  id: string | null,
  level: CanvasLevel,
  kinds: CanvasKinds = CANVAS_KINDS,
): string | null {
  let current = id ? tree.byId.get(id) : undefined;
  while (current && !kinds[current.kind]?.type[level].opener)
    current = current.parentId ? tree.byId.get(current.parentId) : undefined;
  return current?.id ?? tree.roots[0]?.id ?? null;
}
