"use client";

import "@xyflow/react/dist/base.css";
import {
  createContext,
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
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react";
import { cubicBezier } from "framer-motion";
import { ChevronLeft, House, Maximize, Minus, Plus } from "lucide-react";
import Link, { useAdminNavigation } from "@/components/admin/AdminLink";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { useHydratedReducedMotion } from "@/hooks/useHydratedReducedMotion";
import { adminEase } from "@/lib/admin/motion";
import {
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
  type CanvasKey,
  type CanvasLevel,
  type CanvasLink,
  type CanvasNode,
  type CanvasTree,
} from "@/lib/admin/canvas-model";

export interface CanvasViewProps<T> {
  /** Accessible name of the canvas, such as "Today canvas". */
  label: string;
  nodes: readonly CanvasNode<T>[];
  /** Extra cross links beyond the parent tree. */
  edges?: readonly CanvasLink[];
  /** Node content only. The view owns the opener, so content must not contain controls. */
  renderNode(node: CanvasNode<T>, level: CanvasLevel, state: { selected: boolean }): ReactNode;
  selectedId: string | null;
  scopeId: string | null;
  /** Canonical /admin href for a scope; the view resolves tenant and demo prefixes. */
  hrefFor(target: { scopeId: string | null }): string;
  /** The single primary opener for leaf records. Group nodes open as scopes. */
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
}

interface CanvasNodeData extends Record<string, unknown> {
  node: CanvasNode<unknown>;
  depth: number;
  position: number;
  siblings: number;
  hasChildren: boolean;
}

interface CanvasContextValue {
  level: CanvasLevel;
  tabStop: string | null;
  selectedId: string | null;
  render(node: CanvasNode<unknown>, level: CanvasLevel, state: { selected: boolean }): ReactNode;
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
const arrow = { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "var(--admin-muted)" };

function CanvasNodeView({ data }: NodeProps<Node<CanvasNodeData>>) {
  const context = useContext(CanvasContext);
  if (!context) return null;
  const { node } = data;
  const type = CANVAS_TYPE[node.shape][context.level];
  const selected = context.selectedId === node.id;
  const style = {
    "--canvas-label": type.label ? `${type.label}px` : undefined,
    "--canvas-detail": type.detail ? `${type.detail}px` : undefined,
  } as CSSProperties;
  const content = context.render(node, context.level, { selected });
  return (
    <div
      className="admin-canvas-node"
      data-shape={node.shape}
      data-level={context.level}
      data-selected={selected || undefined}
      style={style}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        isConnectable={false}
        className="admin-canvas-handle"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        isConnectable={false}
        className="admin-canvas-handle"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        isConnectable={false}
        className="admin-canvas-handle"
      />
      {type.opener ? (
        <button
          type="button"
          role="treeitem"
          aria-level={data.depth}
          aria-posinset={data.position}
          aria-setsize={data.siblings}
          aria-selected={selected}
          aria-expanded={data.hasChildren || undefined}
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
    </div>
  );
}

const nodeTypes = { canvas: CanvasNodeView };

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

function treeMeta<T>(tree: CanvasTree<T>) {
  const meta = new Map<string, Omit<CanvasNodeData, "node">>();
  const visit = (list: CanvasNode<T>[], depth: number) =>
    list.forEach((node, index) => {
      const children = tree.children.get(node.id) ?? [];
      meta.set(node.id, {
        depth,
        position: index + 1,
        siblings: list.length,
        hasChildren: children.length > 0,
      });
      visit(children, depth + 1);
    });
  visit(tree.roots, 1);
  return meta;
}

function CanvasSurface<T>({
  label,
  nodes,
  edges = [],
  renderNode,
  selectedId,
  scopeId,
  hrefFor,
  onOpen,
  onInteractingChange,
  notice,
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
  const signature = canvasSignature(nodes);
  const tree = useMemo(() => canvasTree(nodes), [nodes]);
  // Layout depends only on structure, so polled label or status changes never move nodes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => layoutCanvasTree(nodes), [signature]);
  const meta = useMemo(() => treeMeta(tree), [tree]);
  const scope = scopeId && tree.byId.has(scopeId) ? scopeId : null;
  const duration = reduced ? 0 : 180;

  const onZoom = useCallback(
    (zoom: number) => setLevel((current) => nextCanvasLevel(current, zoom)),
    [],
  );
  const frame = useCallback(
    (target: string | null, animate: boolean) => {
      if (!width || !height) return Promise.resolve(false);
      return flow.setViewport(canvasCameraFor(tree, layout, target, { width, height }), {
        duration: animate ? duration : 0,
        ease,
      });
    },
    [flow, tree, layout, width, height, duration],
  );
  // Entering a scope is explicit navigation and is the only camera move the
  // canvas makes on its own. New data never re-frames or re-centres the view.
  const frameKey = width && height ? `${scope ?? ""}` : null;
  useEffect(() => {
    if (frameKey === null || framed.current === frameKey) return;
    const first = framed.current === null;
    framed.current = frameKey;
    void frame(scope, !first).then(() => setReady(true));
  }, [frameKey, frame, scope]);

  const reveal = useCallback(
    (id: string) => {
      const placement = layout.placements.get(id);
      if (!placement || !width || !height) return;
      const next = canvasReveal(placement, flow.getViewport(), { width, height });
      if (next) void flow.setViewport(next, { duration, ease });
    },
    [flow, layout, width, height, duration],
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
      const hasChildren = (tree.children.get(node.id) ?? []).length > 0;
      if (!hasChildren) return onOpen(node as CanvasNode<T>);
      const target = node.parentId === null ? null : node.id;
      if (target === scope) return void frame(target, true);
      router.push(hrefFor({ scopeId: target }), "preserve");
    },
    [tree, onOpen, scope, frame, router, hrefFor],
  );

  const tabStop = canvasTabStop(tree, active ?? selectedId ?? scope, level);
  const context = useMemo<CanvasContextValue>(
    () => ({
      level,
      tabStop,
      selectedId,
      render: renderNode as CanvasContextValue["render"],
      open,
      activate: setActive,
    }),
    [level, tabStop, selectedId, renderNode, open],
  );

  const flowNodes = useMemo<Node<CanvasNodeData>[]>(
    () =>
      nodes.map((node) => {
        const placement = layout.placements.get(node.id)!;
        return {
          id: node.id,
          type: "canvas",
          position: { x: placement.x, y: placement.y },
          width: placement.width,
          height: placement.height,
          data: { node, ...meta.get(node.id)! },
          draggable: false,
          selectable: false,
          connectable: false,
          focusable: false,
        };
      }),
    [nodes, layout, meta],
  );
  const flowEdges = useMemo<Edge[]>(
    () => [
      ...layout.links.map((link) => ({
        id: link.id,
        source: link.from,
        target: link.to,
        sourceHandle: "bottom",
        targetHandle: link.attach,
        type: "smoothstep",
        pathOptions: { borderRadius: 14 },
        markerEnd: arrow,
        focusable: false,
        selectable: false,
      })),
      ...edges
        .filter((link) => tree.byId.has(link.from) && tree.byId.has(link.to))
        .map((link) => ({
          id: `link:${link.id}`,
          source: link.from,
          target: link.to,
          sourceHandle: "bottom",
          targetHandle: "top",
          type: "smoothstep",
          className: "admin-canvas-cross-link",
          markerEnd: arrow,
          focusable: false,
          selectable: false,
        })),
    ],
    [layout, edges, tree],
  );
  const margin = 480;
  const extent: [[number, number], [number, number]] = [
    [layout.bounds.x - margin, layout.bounds.y - margin],
    [
      layout.bounds.x + layout.bounds.width + margin,
      layout.bounds.y + layout.bounds.height + margin,
    ],
  ];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const id = (event.target as HTMLElement).closest<HTMLElement>("[data-canvas-node]")?.dataset
      .canvasNode;
    if (event.shiftKey && event.key.startsWith("Arrow")) {
      event.preventDefault();
      const view = flow.getViewport();
      const step = 96;
      const dx = event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0;
      const dy = event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0;
      void flow.setViewport({ ...view, x: view.x + dx, y: view.y + dy }, { duration, ease });
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      void flow.zoomIn({ duration });
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      void flow.zoomOut({ duration });
    } else if (event.key === "0") {
      event.preventDefault();
      void frame(scope, true);
    } else if (id && canvasKeys.has(event.key)) {
      event.preventDefault();
      const next = canvasNeighbour(tree, id, event.key as CanvasKey, level);
      if (next) focusNode(next);
    }
  };

  const path = canvasAncestors(tree, scope);
  const current = path.at(-1);
  const parent = path.length > 1 ? path.at(-2) : undefined;
  const home = tree.roots[0];

  return (
    <CanvasContext.Provider value={context}>
      <div
        ref={surface}
        className="admin-canvas"
        data-canvas-view
        data-canvas-level={level}
        data-canvas-ready={ready || undefined}
        onKeyDown={onKeyDown}
      >
        <nav className="admin-canvas-crumbs" aria-label={`${label} location`}>
          {home && (
            <Link
              href={hrefFor({ scopeId: null })}
              scroll={false}
              className="admin-canvas-crumb admin-canvas-crumb--home"
              data-has-back={parent && parent.id !== home.id ? "true" : undefined}
              aria-current={scope === null ? "location" : undefined}
            >
              <House className="size-3.5" aria-hidden="true" />
              {home.label}
            </Link>
          )}
          {parent && parent.id !== home?.id && (
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
            onClick={() => void flow.zoomOut({ duration })}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <ZoomReadout />
          <button
            type="button"
            className="admin-canvas-zoom-button"
            aria-label="Zoom in"
            onClick={() => void flow.zoomIn({ duration })}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="admin-canvas-zoom-button"
            aria-label="Fit to view"
            onClick={() => void frame(scope, true)}
          >
            <Maximize className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="admin-canvas-flow" role="tree" aria-label={label} aria-describedby={keysId}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
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
            onlyRenderVisibleElements
            nodeClickDistance={8}
            paneClickDistance={8}
            proOptions={{ hideAttribution: true }}
            onMoveStart={() => onInteractingChange?.(true)}
            onMoveEnd={() => onInteractingChange?.(false)}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} />
            <LevelTracker onZoom={onZoom} />
          </ReactFlow>
        </div>
        {notice && (
          <p className="admin-canvas-notice" role="status">
            {notice}
          </p>
        )}
        <p className="admin-canvas-keys">
          <span id={keysId} className="admin-canvas-keys-hint">
            Arrow keys move · Enter opens · + and − zoom · 0 fits ·{" "}
          </span>
          <a href="https://reactflow.dev" target="_blank" rel="noreferrer">
            React Flow
          </a>
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
