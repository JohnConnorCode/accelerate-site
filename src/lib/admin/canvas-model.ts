/**
 * Pure model for the shared canvas view: node shapes, semantic zoom levels,
 * tree layout, camera framing and keyboard neighbours. The canvas is a View:
 * it arranges source records and owns no lifecycle or copied status.
 */

export type CanvasLevel = "far" | "mid" | "near";
/** Anchor and hub nodes are circles; cards hold leaf records. */
export type CanvasShape = "anchor" | "hub" | "card";

export interface CanvasNode<T = unknown> {
  /** Stable display id, normally `sourceType:sourceId`. */
  id: string;
  parentId: string | null;
  shape: CanvasShape;
  label: string;
  data: T;
}

export interface CanvasLink {
  id: string;
  from: string;
  to: string;
}

export const CANVAS_ZOOM = { min: 0.4, max: 1.6 } as const;

export const CANVAS_SHAPES: Record<CanvasShape, { width: number; height: number }> = {
  anchor: { width: 200, height: 200 },
  hub: { width: 168, height: 168 },
  card: { width: 288, height: 112 },
};

/** A level is entered at `enter` and kept until zoom falls below `exit`. */
export const CANVAS_LEVELS = {
  mid: { enter: 0.62, exit: 0.58 },
  near: { enter: 1, exit: 0.95 },
} as const;

/** Lowest zoom at which each level can be on screen. */
export const CANVAS_LEVEL_MIN_ZOOM: Record<CanvasLevel, number> = {
  far: CANVAS_ZOOM.min,
  mid: CANVAS_LEVELS.mid.exit,
  near: CANVAS_LEVELS.near.exit,
};

/**
 * Text sizes in CSS px at zoom 1. Every size times its level's minimum zoom
 * stays at or above the 10.5px legibility floor, and every opener's height
 * stays at or above the 44px coarse-pointer target floor.
 */
export const CANVAS_TYPE: Record<
  CanvasShape,
  Record<CanvasLevel, { label: number | null; detail: number | null; opener: boolean }>
> = {
  anchor: {
    far: { label: 30, detail: null, opener: true },
    mid: { label: 22, detail: 19, opener: true },
    near: { label: 18, detail: 12, opener: true },
  },
  hub: {
    far: { label: 27, detail: null, opener: true },
    mid: { label: 20, detail: 19, opener: true },
    near: { label: 16, detail: 12, opener: true },
  },
  card: {
    far: { label: null, detail: null, opener: false },
    mid: { label: 19, detail: null, opener: true },
    near: { label: 15, detail: 12, opener: true },
  },
};

export const CANVAS_LEGIBLE_PX = 10.5;
export const CANVAS_TARGET_PX = 44;

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

export interface CanvasLayout {
  placements: Map<string, CanvasPlacement>;
  /** Tree links. Row children attach at their top edge, column children at their left edge. */
  links: Array<CanvasLink & { attach: "top" | "left" }>;
  bounds: CanvasPlacement;
}

const GAP = { row: 48, column: 16, level: 72, indent: 40, root: 160 } as const;

export interface CanvasTree<T> {
  byId: Map<string, CanvasNode<T>>;
  children: Map<string | null, CanvasNode<T>[]>;
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
  for (const node of nodes) {
    const parent = node.parentId && byId.has(node.parentId) ? node.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(node);
    children.set(parent, list);
  }
  return { byId, children, roots: children.get(null) ?? [] };
}

/** Structure signature: layout only reruns when ids, parents or shapes change. */
export function canvasSignature(nodes: readonly CanvasNode<unknown>[]) {
  return nodes.map((node) => `${node.id}>${node.parentId ?? ""}:${node.shape}`).join("|");
}

/**
 * Tidy top-down layout. Children that themselves have children spread in a row
 * under their parent; leaf children stack in a column hanging from the parent,
 * so hundreds of records grow downward instead of producing an endless row.
 */
export function layoutCanvasTree<T>(nodes: readonly CanvasNode<T>[]): CanvasLayout {
  const tree = canvasTree(nodes);
  const kids = (id: string) => tree.children.get(id) ?? [];
  const isColumn = (id: string) => {
    const list = kids(id);
    return list.length > 0 && list.every((child) => kids(child.id).length === 0);
  };
  const boxes = new Map<string, { width: number; height: number }>();
  const measure = (node: CanvasNode<T>): { width: number; height: number } => {
    const cached = boxes.get(node.id);
    if (cached) return cached;
    const size = CANVAS_SHAPES[node.shape];
    const list = kids(node.id);
    let box = { width: size.width, height: size.height };
    if (list.length && isColumn(node.id)) {
      const widest = Math.max(...list.map((child) => CANVAS_SHAPES[child.shape].width));
      const stacked = list.reduce((sum, child) => sum + CANVAS_SHAPES[child.shape].height, 0);
      box = {
        width: Math.max(size.width, size.width / 2 + GAP.indent + widest),
        height: size.height + GAP.level + stacked + (list.length - 1) * GAP.column,
      };
    } else if (list.length) {
      const measured = list.map(measure);
      const row = measured.reduce((sum, child) => sum + child.width, 0);
      box = {
        width: Math.max(size.width, row + (list.length - 1) * GAP.row),
        height: size.height + GAP.level + Math.max(...measured.map((child) => child.height)),
      };
    }
    boxes.set(node.id, box);
    return box;
  };

  const placements = new Map<string, CanvasPlacement>();
  const links: CanvasLayout["links"] = [];
  const place = (node: CanvasNode<T>, left: number, top: number) => {
    const size = CANVAS_SHAPES[node.shape];
    const box = measure(node);
    const list = kids(node.id);
    const column = isColumn(node.id);
    const x = column ? left : left + (box.width - size.width) / 2;
    placements.set(node.id, { x, y: top, width: size.width, height: size.height });
    let cursor = top + size.height + GAP.level;
    let rowLeft =
      left +
      (box.width -
        (list.reduce((sum, child) => sum + measure(child).width, 0) +
          (list.length - 1) * GAP.row)) /
        2;
    for (const child of list) {
      links.push({
        id: `${node.id}->${child.id}`,
        from: node.id,
        to: child.id,
        attach: column ? "left" : "top",
      });
      if (column) {
        place(child, x + size.width / 2 + GAP.indent, cursor);
        cursor += CANVAS_SHAPES[child.shape].height + GAP.column;
      } else {
        place(child, rowLeft, cursor);
        rowLeft += measure(child).width + GAP.row;
      }
    }
  };
  let left = 0;
  for (const root of tree.roots) {
    place(root, left, 0);
    left += measure(root).width + GAP.root;
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

export function canvasAncestors<T>(tree: CanvasTree<T>, id: string | null): CanvasNode<T>[] {
  const path: CanvasNode<T>[] = [];
  let current = id ? tree.byId.get(id) : undefined;
  while (current) {
    path.unshift(current);
    current = current.parentId ? tree.byId.get(current.parentId) : undefined;
  }
  return path;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Frame a scope: the scope node and its first rows of descendants. When the
 * framed area is too tall to show legibly, the camera keeps the width fitted
 * and aligns the top instead of shrinking the whole scope into marks.
 */
export function canvasCameraFor<T>(
  tree: CanvasTree<T>,
  layout: CanvasLayout,
  scopeId: string | null,
  viewport: { width: number; height: number },
  padding = 48,
): CanvasViewport {
  const scope = scopeId ? tree.byId.get(scopeId) : undefined;
  const framed: CanvasPlacement[] = [];
  const collect = (node: CanvasNode<T>, depth: number) => {
    const placement = layout.placements.get(node.id);
    if (placement) framed.push(placement);
    if (depth >= 2) return;
    for (const child of (tree.children.get(node.id) ?? []).slice(0, 6)) collect(child, depth + 1);
  };
  if (scope) collect(scope, 0);
  else for (const root of tree.roots) collect(root, 0);
  const box = boundsOf(framed);
  if (!box.width || !viewport.width || !viewport.height) return { x: 0, y: 0, zoom: 1 };
  const width = Math.max(1, viewport.width - padding * 2);
  const height = Math.max(1, viewport.height - padding * 2);
  const fitWidth = width / box.width;
  const fitBoth = Math.min(fitWidth, height / box.height);
  const legible = fitBoth >= CANVAS_LEVELS.mid.enter;
  const zoom = clampCanvasZoom(Math.min(1, legible ? fitBoth : Math.min(fitWidth, 1)));
  const x = viewport.width / 2 - (box.x + box.width / 2) * zoom;
  const y =
    box.height * zoom <= height
      ? viewport.height / 2 - (box.y + box.height / 2) * zoom
      : padding - box.y * zoom;
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
 * Tree navigation: Up and Down move between siblings, Left to the parent,
 * Right to the first child, Home and End to the first and last sibling.
 * Only nodes that are openers at the current level can receive focus.
 */
export function canvasNeighbour<T>(
  tree: CanvasTree<T>,
  id: string,
  key: CanvasKey,
  level: CanvasLevel,
): string | null {
  const node = tree.byId.get(id);
  if (!node) return null;
  const focusable = (candidate: CanvasNode<T> | undefined) =>
    candidate && CANVAS_TYPE[candidate.shape][level].opener ? candidate.id : null;
  const parentKey = node.parentId && tree.byId.has(node.parentId) ? node.parentId : null;
  const siblings = (tree.children.get(parentKey) ?? []).filter(
    (sibling) => CANVAS_TYPE[sibling.shape][level].opener,
  );
  const index = siblings.findIndex((sibling) => sibling.id === id);
  switch (key) {
    case "ArrowUp":
      return index > 0 ? siblings[index - 1]!.id : null;
    case "ArrowDown":
      return index >= 0 && index < siblings.length - 1 ? siblings[index + 1]!.id : null;
    case "ArrowLeft":
      return parentKey ? focusable(tree.byId.get(parentKey)) : null;
    case "ArrowRight":
      return focusable(
        (tree.children.get(id) ?? []).find((child) => CANVAS_TYPE[child.shape][level].opener),
      );
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
): string | null {
  let current = id ? tree.byId.get(id) : undefined;
  while (current && !CANVAS_TYPE[current.shape][level].opener)
    current = current.parentId ? tree.byId.get(current.parentId) : undefined;
  return current?.id ?? tree.roots[0]?.id ?? null;
}
