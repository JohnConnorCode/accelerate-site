/**
 * Desk datum: what a board projects onto the canvas. Anchors are businesses,
 * hubs are a mode's phases, segments group stations, and stations show rows
 * summarized from source records at read time.
 */
import type { CanvasNode } from "./canvas-model";

/** The one icon vocabulary for desk nodes; board documents validate against it. */
export const DESK_ICON_NAMES = [
  "layers",
  "leaf",
  "home",
  "messages",
  "search",
  "hammer",
  "clipboard",
  "trending",
  "target",
  "handshake",
  "ruler",
  "users",
  "chart",
  "megaphone",
  "signature",
  "wallet",
  "wrench",
  "line",
  "dollar",
  "calendar",
  "file",
  "check",
  "eye",
  "message",
  "receipt",
  "star",
  "truck",
  "bell",
] as const;

export type DeskIcon = (typeof DESK_ICON_NAMES)[number];

export interface DeskDatum {
  icon: DeskIcon;
  /** Short line under a circle label, or a segment's description. */
  detail?: string;
  /** Label for the farthest zoom level when the full label cannot fit a circle. */
  short?: string;
  /** Station subtitle. */
  subtitle?: string;
  rows?: readonly { label: string; value: string }[];
  /** Skills a station uses, shown in its detail. */
  skills?: readonly string[];
}

export type DeskNode = CanvasNode<DeskDatum>;
