"use client";

import "@xyflow/react/dist/base.css";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react";
import { cubicBezier } from "framer-motion";
import { ChevronLeft, House, Maximize, Minus, Plus, X } from "lucide-react";
import Link, { useAdminNavigation } from "@/components/admin/AdminLink";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { useHydratedReducedMotion } from "@/hooks/useHydratedReducedMotion";
import { adminEase } from "@/lib/admin/motion";
import {
  CANVAS_KINDS,
  CANVAS_ZOOM,
  canvasAncestors,
  canvasCameraFor,
  canvasNeighbour,
  canvasReveal,
  canvasSignature,
  canvasTabStop,
  canvasTree,
  canvasVisibleNodes,
  layoutCanvasTree,
  nextCanvasLevel,
  type CanvasKey,
  type CanvasKinds,
  type CanvasLevel,
  type CanvasLink,
  type CanvasNode,
} from "@/lib/admin/canvas-model";

export interface CanvasViewProps<T> {
  /** Accessible name of the canvas, such as "Today canvas". */
  label: string;
  nodes: readonly CanvasNode<T>[];
  /** Extra cross links beyond the parent tree. */
  edges?: readonly CanvasLink[];
  /** Node kinds by name. Defaults to the built-in kinds. */
  kinds?: CanvasKinds;
  /** "all" shows every node; "path" unspools the tree along the current scope. */
  visibility?: "all" | "path";
  /** Highest zoom used when framing a scope. */
  maxFrameZoom?: number;
  /** "auto" keeps four or fewer leaf records in a row; "column" always stacks them. */
  leafLayout?: "auto" | "column";
  /** Node content only. The view owns the opener, so content must not contain controls. */
  renderNode(
    node: CanvasNode<T>,
    level: CanvasLevel,
    state: { selected: boolean; onPath: boolean },
  ): ReactNode;
  selectedId: string | null;
  scopeId: string | null;
  /** Canonical /admin href for a scope; the view resolves tenant and demo prefixes. */
  hrefFor(target: { scopeId: string | null }): string;
  /** The single primary opener for leaf records. Nodes with children open as scopes. */
  onOpen(node: CanvasNode<T>): void;
  onInteractingChange?(active: boolean): void;
  read: {
    loading: boolean;
    hasData: boolean;
    error?: string;
    refreshing?: boolean;
    onRetry(): void;
  };
  /** Degraded or partial source message, shown over the canvas. */
  notice?: string;
  empty: ReactNode;
  /** Label of the location home link. Defaults to the single root's label, or "Home". */
  homeLabel?: string;
  /** Read-only context for the selected record, docked beside the canvas. */
  detail?: { title: string; content: ReactNode; onClose(): void } | null;
  /** App chrome laid over the canvas, such as a composer. */
  overlay?: ReactNode;
}

interface CanvasNodeData extends Record<string, unknown> {
  node: CanvasNode<unknown>;
}

interface CanvasContextValue {
  kinds: CanvasKinds;
  level: CanvasLevel;
  tabStop: string | null;
  selectedId: string | null;
  onPath: ReadonlySet<string>;
  render(
    node: CanvasNode<unknown>,
    level: CanvasLevel,
    state: { selected: boolean; onPath: boolean },
  ): ReactNode;
  open(node: CanvasNode<unknown>): void;
  activate(id: string): void;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);
const ease = cubicBezier(...adminEase);
const zoomSelector = (state: ReactFlowState) => state.transform[2];
const canvasKeys = new Set<string>([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);
const arrow = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "var(--admin-ink)" };
// Connectors are decoration; the nodes and the location bar describe the structure.
const hiddenEdge = { "aria-hidden": true } as const;
const positions = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

/** Rounded elbow connector with a dot where it leaves its parent, as on the prototype desk. */
const CanvasEdge = memo(function CanvasEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });
  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={style} />
      <circle className="admin-canvas-edge-dot" cx={sourceX} cy={sourceY} r={3.5} />
    </>
  );
});

const CanvasNodeView = memo(function CanvasNodeView({ data }: NodeProps<Node<CanvasNodeData>>) {
  const context = useContext(CanvasContext);
  if (!context) return null;
  const { node } = data;
  const kind = context.kinds[node.kind]!;
  const type = kind.type[context.level];
  const selected = context.selectedId === node.id;
  const onPath = context.onPath.has(node.id);
  const style = {
    "--canvas-label": type.label ? `${type.label}px` : undefined,
    "--canvas-detail": type.detail ? `${type.detail}px` : undefined,
  } as CSSProperties;
  // A level without a label is a bare mark: no text can render below the legibility floor.
  const content =
    type.label === null ? null : context.render(node, context.level, { selected, onPath });
  return (
    <div
      className="admin-canvas-node"
      data-kind={node.kind}
      data-shape={kind.shape}
      data-level={context.level}
      data-detail={type.detail ? "shown" : undefined}
      data-selected={selected || undefined}
      data-on-path={onPath || undefined}
      style={style}
    >
      {(["top", "left", "bottom"] as const).map((side) => (
        <Handle
          key={`in-${side}`}
          type="target"
          id={`in-${side}`}
          position={positions[side]}
          isConnectable={false}
          className="admin-canvas-handle"
        />
      ))}
      {(["bottom", "top", "right"] as const).map((side) => (
        <Handle
          key={`out-${side}`}
          type="source"
          id={`out-${side}`}
          position={positions[side]}
          isConnectable={false}
          className="admin-canvas-handle"
        />
      ))}
      {type.opener ? (
        <button
          type="button"
          aria-current={selected || undefined}
          tabIndex={context.tabStop === node.id ? 0 : -1}
          data-canvas-node={node.id}
          className="admin-canvas-opener"
          onClick={() => context.open(node)}
          onFocus={() => context.activate(node.id)}
        >
          {content}
        </button>
      ) : (
        <div className="admin-canvas-mark" aria-hidden="true">
          {content}
        </div>
      )}
      {node.status && (
        <span className="admin-canvas-status" data-status={node.status} aria-hidden="true" />
      )}
    </div>
  );
});

// Stable module-level references, as React Flow recommends: no node or edge
// component, type map or option object is recreated per render.
const nodeTypes = { canvas: CanvasNodeView };
const edgeTypes = { canvas: CanvasEdge };
const proOptions = { hideAttribution: true };
/** Culling helps large graphs and costs small ones a recalculation on every pan. */
const CULL_ABOVE = 150;
/** Width the docked detail panel covers on a wide canvas, so an open station stays beside it. */
const PANEL_COVER = 412;

function ZoomReadout() {
  const zoom = useStore(zoomSelector);
  return (
    <span className="admin-canvas-zoom-value" aria-hidden="true">
      {Math.round(zoom * 100)}%
    </span>
  );
}

/** Reports zoom so the parent re-renders only when the semantic level changes. */
function LevelTracker({ onZoom }: { onZoom(zoom: number): void }) {
  const zoom = useStore(zoomSelector);
  useEffect(() => onZoom(zoom), [zoom, onZoom]);
  return null;
}

function CanvasSurface<T>({
  label,
  nodes,
  edges = [],
  kinds = CANVAS_KINDS,
  visibility = "all",
  maxFrameZoom = 1,
  leafLayout = "auto",
  renderNode,
  selectedId,
  scopeId,
  hrefFor,
  onOpen,
  onInteractingChange,
  notice,
  homeLabel,
  detail,
  overlay,
}: CanvasViewProps<T>) {
  const flow = useReactFlow();
  const router = useAdminNavigation();
  const reduced = useHydratedReducedMotion();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const surface = useRef<HTMLDivElement>(null);
  const keysId = useId();
  const [level, setLevel] = useState<CanvasLevel>("near");
  const [active, setActive] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const framed = useRef<string | null>(null);
  const fullTree = useMemo(() => canvasTree(nodes), [nodes]);
  const scope = scopeId && fullTree.byId.has(scopeId) ? scopeId : null;
  const visible = useMemo(
    () => canvasVisibleNodes(nodes, scope, visibility),
    [nodes, scope, visibility],
  );
  const tree = useMemo(() => canvasTree(visible), [visible]);
  const signature = canvasSignature(visible);
  // Layout depends only on visible structure, so polled label or status changes never move nodes.
  const layout = useMemo(
    () =>
      layoutCanvasTree(visible, kinds, {
        compact: visibility === "path",
        leafColumns: leafLayout === "column" ? "always" : "auto",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, kinds, visibility, leafLayout],
  );
  const path = useMemo(() => canvasAncestors(fullTree, scope), [fullTree, scope]);
  const onPath = useMemo(() => new Set(path.map((node) => node.id)), [path]);
  const quick = reduced ? 0 : 180;
  const glide = reduced ? 0 : 320;

  const onZoom = useCallback(
    (zoom: number) => setLevel((current) => nextCanvasLevel(current, zoom)),
    [],
  );
  const frame = useCallback(
    (target: string | null, duration: number) => {
      if (!width || !height) return Promise.resolve(false);
      return flow.setViewport(
        canvasCameraFor(
          tree,
          layout,
          target,
          { width, height },
          {
            maxZoom: maxFrameZoom,
            // Keep the location bar and any overlay clear of framed nodes.
            insets: { top: 76, right: 32, bottom: overlay ? 108 : 40, left: 32 },
          },
        ),
        { duration, ease },
      );
    },
    [flow, tree, layout, width, height, maxFrameZoom, overlay],
  );
  // Entering a scope is explicit navigation and is the only camera move the
  // canvas makes on its own. New data never re-frames or re-centres the view.
  const frameKey = width && height ? `${scope ?? ""}` : null;
  useEffect(() => {
    if (frameKey === null || framed.current === frameKey) return;
    const first = framed.current === null;
    framed.current = frameKey;
    void frame(scope, first ? 0 : glide).then(() => setReady(true));
  }, [frameKey, frame, scope, glide]);

  const reveal = useCallback(
    (id: string) => {
      const placement = layout.placements.get(id);
      if (!placement || !width || !height) return;
      const next = canvasReveal(placement, flow.getViewport(), { width, height });
      if (next) void flow.setViewport(next, { duration: quick, ease });
    },
    [flow, layout, width, height, quick],
  );
  const focusNode = useCallback(
    (id: string) => {
      setActive(id);
      reveal(id);
      let tries = 0;
      const attempt = () => {
        const element = surface.current?.querySelector<HTMLElement>(
          `[data-canvas-node="${CSS.escape(id)}"]`,
        );
        if (element) element.focus({ preventScroll: true });
        else if (tries++ < 30) requestAnimationFrame(attempt);
      };
      requestAnimationFrame(attempt);
    },
    [reveal],
  );

  const open = useCallback(
    (node: CanvasNode<unknown>) => {
      setActive(node.id);
      const hasChildren = (fullTree.children.get(node.id) ?? []).length > 0;
      if (!hasChildren) return onOpen(node as CanvasNode<T>);
      const soleRoot = node.parentId === null && fullTree.roots.length === 1;
      const target = soleRoot ? null : node.id;
      if (target === scope) return void frame(target, glide);
      router.push(hrefFor({ scopeId: target }), "preserve");
    },
    [fullTree, onOpen, scope, frame, glide, router, hrefFor],
  );

  const tabStop = canvasTabStop(tree, active ?? selectedId ?? scope, level, kinds);
  const context = useMemo<CanvasContextValue>(
    () => ({
      kinds,
      level,
      tabStop,
      selectedId,
      onPath,
      render: renderNode as CanvasContextValue["render"],
      open,
      activate: setActive,
    }),
    [kinds, level, tabStop, selectedId, onPath, renderNode, open],
  );

  const flowNodes = useMemo<Node<CanvasNodeData>[]>(
    () =>
      visible.map((node) => {
        const placement = layout.placements.get(node.id)!;
        return {
          id: node.id,
          type: "canvas",
          position: { x: placement.x, y: placement.y },
          width: placement.width,
          height: placement.height,
          data: { node },
          draggable: false,
          selectable: false,
          connectable: false,
          focusable: false,
          // The opener inside carries the accessible name; the wrapper stays generic.
          domAttributes: { "aria-roledescription": undefined },
        };
      }),
    [visible, layout],
  );
  const flowEdges = useMemo<Edge[]>(
    () => [
      ...layout.links.map((link) => ({
        id: link.id,
        source: link.from,
        target: link.to,
        sourceHandle: `out-${link.source}`,
        targetHandle: `in-${link.target}`,
        type: "canvas",
        markerEnd: arrow,
        focusable: false,
        selectable: false,
        domAttributes: hiddenEdge,
      })),
      ...edges
        .filter((link) => tree.byId.has(link.from) && tree.byId.has(link.to))
        .map((link) => ({
          id: `link:${link.id}`,
          source: link.from,
          target: link.to,
          sourceHandle: "out-bottom",
          targetHandle: "in-top",
          type: "canvas",
          className: "admin-canvas-cross-link",
          markerEnd: arrow,
          focusable: false,
          selectable: false,
          domAttributes: hiddenEdge,
        })),
    ],
    [layout, edges, tree],
  );
  const extent = useMemo<[[number, number], [number, number]]>(() => {
    const margin = 480;
    const { x, y, width: w, height: h } = layout.bounds;
    return [
      [x - margin, y - margin],
      [x + w + margin, y + h + margin],
    ];
  }, [layout]);
  const cull = visible.length > CULL_ABOVE;
  const onMoveStart = useCallback(() => onInteractingChange?.(true), [onInteractingChange]);
  const onMoveEnd = useCallback(() => onInteractingChange?.(false), [onInteractingChange]);
  // An opened record stays beside the docked panel: the smallest pan that uncovers it.
  const detailOpen = Boolean(detail);
  useEffect(() => {
    if (!detailOpen || !selectedId || !width || !height || width < 640) return;
    const placement = layout.placements.get(selectedId);
    if (!placement) return;
    const next = canvasReveal(placement, flow.getViewport(), {
      width: width - PANEL_COVER,
      height,
    });
    if (next) void flow.setViewport(next, { duration: quick, ease });
  }, [detailOpen, selectedId, layout, width, height, flow, quick]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if ((event.target as HTMLElement).closest(".admin-canvas-panel, .admin-canvas-overlay")) {
      if (event.key === "Escape" && detail) detail.onClose();
      return;
    }
    const id = (event.target as HTMLElement).closest<HTMLElement>("[data-canvas-node]")?.dataset
      .canvasNode;
    if (event.shiftKey && event.key.startsWith("Arrow")) {
      event.preventDefault();
      const view = flow.getViewport();
      const step = 96;
      const dx = event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0;
      const dy = event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0;
      void flow.setViewport({ ...view, x: view.x + dx, y: view.y + dy }, { duration: quick, ease });
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      void flow.zoomIn({ duration: quick });
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      void flow.zoomOut({ duration: quick });
    } else if (event.key === "0") {
      event.preventDefault();
      void frame(scope, glide);
    } else if (event.key === "Escape" && detail) {
      event.preventDefault();
      detail.onClose();
    } else if (id && canvasKeys.has(event.key)) {
      event.preventDefault();
      const next = canvasNeighbour(tree, id, event.key as CanvasKey, level, kinds);
      if (next) focusNode(next);
    }
  };

  const current = path.at(-1);
  const parent = path.length > 1 ? path.at(-2) : undefined;
  const home = homeLabel ?? (fullTree.roots.length === 1 ? fullTree.roots[0]!.label : "Home");

  return (
    <CanvasContext.Provider value={context}>
      <div
        ref={surface}
        className="admin-canvas"
        data-canvas-view
        data-canvas-level={level}
        data-canvas-ready={ready || undefined}
        data-detail-open={detail ? "true" : undefined}
        data-unspool={!cull && !reduced ? "true" : undefined}
        onKeyDown={onKeyDown}
      >
        <nav className="admin-canvas-crumbs" aria-label={`${label} location`}>
          <Link
            href={hrefFor({ scopeId: null })}
            scroll={false}
            className="admin-canvas-crumb admin-canvas-crumb--home"
            data-has-back={parent ? "true" : undefined}
            aria-current={scope === null ? "location" : undefined}
          >
            <House className="size-3.5" aria-hidden="true" />
            {home}
          </Link>
          {parent && (
            <Link
              href={hrefFor({ scopeId: parent.id })}
              scroll={false}
              className="admin-canvas-crumb"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              Back to {parent.label}
            </Link>
          )}
          {scope && current && (
            <span
              className="admin-canvas-crumb admin-canvas-crumb--current"
              aria-current="location"
            >
              {current.label}
            </span>
          )}
        </nav>
        <div className="admin-canvas-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className="admin-canvas-zoom-button"
            aria-label="Zoom out"
            onClick={() => void flow.zoomOut({ duration: quick })}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <ZoomReadout />
          <button
            type="button"
            className="admin-canvas-zoom-button"
            aria-label="Zoom in"
            onClick={() => void flow.zoomIn({ duration: quick })}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="admin-canvas-zoom-button"
            aria-label="Fit to view"
            onClick={() => void frame(scope, glide)}
          >
            <Maximize className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="admin-canvas-flow">
          {/* React Flow renders its wrapper as role="application"; it carries the canvas name. */}
          <ReactFlow
            aria-label={label}
            aria-describedby={keysId}
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            minZoom={CANVAS_ZOOM.min}
            maxZoom={CANVAS_ZOOM.max}
            translateExtent={extent}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            selectionOnDrag={false}
            panOnDrag
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch
            zoomOnDoubleClick={false}
            preventScrolling={false}
            autoPanOnNodeFocus={false}
            disableKeyboardA11y
            onlyRenderVisibleElements={cull}
            nodeClickDistance={8}
            paneClickDistance={8}
            proOptions={proOptions}
            onMoveStart={onMoveStart}
            onMoveEnd={onMoveEnd}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} />
            <LevelTracker onZoom={onZoom} />
          </ReactFlow>
        </div>
        {detail && (
          <aside className="admin-canvas-panel" aria-label={detail.title}>
            <header className="admin-canvas-panel-header">
              <button
                type="button"
                className="admin-canvas-panel-back"
                onClick={detail.onClose}
                aria-label={`Close ${detail.title}`}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
              <h2>{detail.title}</h2>
            </header>
            <div className="admin-canvas-panel-body">{detail.content}</div>
          </aside>
        )}
        {overlay && <div className="admin-canvas-overlay">{overlay}</div>}
        {notice && (
          <p className="admin-canvas-notice" role="status">
            {notice}
          </p>
        )}
        <p id={keysId} className="admin-canvas-keys">
          Arrow keys move · Enter opens · + and − zoom · 0 fits
        </p>
      </div>
    </CanvasContext.Provider>
  );
}

/** Shared pan-and-zoom canvas that projects source records as a tree of nodes. */
export function CanvasView<T>(props: CanvasViewProps<T>) {
  const hasChildren = props.nodes.some((node) => node.parentId !== null);
  return (
    <AdminReadBody
      loading={props.read.loading}
      hasData={props.read.hasData}
      error={props.read.error}
      onRetry={props.read.onRetry}
      refreshing={props.read.refreshing}
      loadingFallback={<LoadingSkeleton variant="board" />}
      label={`Loading ${props.label}`}
    >
      {hasChildren ? (
        <ReactFlowProvider>
          <CanvasSurface {...props} />
        </ReactFlowProvider>
      ) : (
        props.empty
      )}
    </AdminReadBody>
  );
}
