/**
 * Command Board document contract. A board is tenant-scoped configuration:
 * one document per business anchor, holding its mode, phases, segments and
 * stations. Stations name the record sources they summarize and the skills
 * that act on them; status is always computed from source records at read time.
 */
import { z } from "zod";
import { DESK_ICON_NAMES } from "../admin/canvas-desk";

/** Record sources a station can summarize. Each is read through its owning service. */
export const COMMAND_BOARD_SOURCES = [
  "tasks",
  "opportunities",
  "conversations",
  "approvals",
  "collections",
  "contacts",
] as const;
export type CommandBoardSource = (typeof COMMAND_BOARD_SOURCES)[number];

const key = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase key required");
const label = z.string().trim().min(1).max(60);
const icon = z.enum(DESK_ICON_NAMES);

export const commandBoardSourceSchema = z
  .object({
    source: z.enum(COMMAND_BOARD_SOURCES),
    /** Records whose title contains any of these words, case-insensitive. Empty means all. */
    match: z.array(z.string().trim().min(2).max(40)).max(6).default([]),
  })
  .strict();

export const commandBoardStationSchema = z
  .object({
    key,
    label,
    icon,
    subtitle: z.string().trim().max(80).optional(),
    sources: z.array(commandBoardSourceSchema).max(4).default([]),
    /** Skill names this station uses; each resolves to a registered AI tool when available. */
    skills: z.array(z.string().trim().min(2).max(40)).max(6).default([]),
  })
  .strict();

export const commandBoardSegmentSchema = z
  .object({
    key,
    label,
    icon,
    description: z.string().trim().max(80).optional(),
    stations: z.array(commandBoardStationSchema).min(1).max(6),
  })
  .strict();

export const commandBoardPhaseSchema = z
  .object({
    key,
    label,
    /** Label for the farthest zoom when the full label cannot fit a circle. */
    short: z.string().trim().min(1).max(14).optional(),
    icon,
    /** A phase holds either segments of stations or stations directly. */
    segments: z.array(commandBoardSegmentSchema).max(6).default([]),
    stations: z.array(commandBoardStationSchema).max(6).default([]),
  })
  .strict()
  .refine((phase) => phase.segments.length > 0 !== phase.stations.length > 0, {
    message: "A phase holds segments or stations, not both and not neither.",
  });

export const commandBoardSatelliteSchema = z
  .object({
    key,
    label,
    icon,
    slot: z.enum(["above", "right"]),
    detail: z.string().trim().max(40).optional(),
    sources: z.array(commandBoardSourceSchema).max(2).default([]),
  })
  .strict();

export const commandBoardDocumentSchema = z
  .object({
    version: z.literal(1),
    anchor: z.object({ label, icon, detail: z.string().trim().max(40).optional() }).strict(),
    mode: z.object({ key, label }).strict(),
    satellites: z.array(commandBoardSatelliteSchema).max(3).default([]),
    phases: z.array(commandBoardPhaseSchema).min(1).max(6),
  })
  .strict()
  .superRefine((document, context) => {
    const seen = new Set<string>();
    const visit = (path: string) => {
      if (seen.has(path))
        context.addIssue({ code: "custom", message: `Duplicate board key path: ${path}` });
      seen.add(path);
    };
    for (const satellite of document.satellites) visit(`satellite:${satellite.key}`);
    for (const phase of document.phases) {
      visit(phase.key);
      for (const station of phase.stations) visit(`${phase.key}:${station.key}`);
      for (const segment of phase.segments) {
        visit(`${phase.key}:${segment.key}`);
        for (const station of segment.stations) visit(`${phase.key}:${segment.key}:${station.key}`);
      }
    }
  });

export type CommandBoardDocument = z.infer<typeof commandBoardDocumentSchema>;
export type CommandBoardStation = z.infer<typeof commandBoardStationSchema>;
export type CommandBoardSourceBinding = z.infer<typeof commandBoardSourceSchema>;

export const commandBoardKeySchema = key;

export const commandBoardSaveSchema = z
  .object({
    boardKey: key,
    revision: z.number().int().min(0),
    /** Order of the business on the desk, left to right. */
    position: z.number().int().min(0).max(99),
    document: commandBoardDocumentSchema,
    requestId: z.uuid(),
  })
  .strict();
export type CommandBoardSave = z.infer<typeof commandBoardSaveSchema>;

/** Station summary computed at read time; never stored. */
export interface CommandBoardStationSummary {
  /** Display id of the station node, `board:<boardKey>:<path>`. */
  id: string;
  status: "ok" | "attention" | "blocked" | "idle";
  rows: { label: string; value: string }[];
  /** Matching source records, newest work first, for the station detail. */
  records: { sourceType: string; sourceId: string; title: string; detail?: string; href: string }[];
  /** Source reads that were unavailable, by source name. */
  unavailable: string[];
}

export interface CommandBoardSnapshot {
  boards: {
    boardKey: string;
    revision: number;
    position: number;
    document: CommandBoardDocument;
  }[];
  summaries: Record<string, CommandBoardStationSummary>;
  /** Skill name to whether a registered, enabled tool can run it in this workspace. */
  skills: Record<string, boolean>;
  observedAt: string;
}

/** Stable display id of a board node from its key path. */
export const boardNodeId = (boardKey: string, ...path: string[]) =>
  ["board", boardKey, ...path].join(":");
