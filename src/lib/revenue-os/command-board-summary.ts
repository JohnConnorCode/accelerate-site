/**
 * Read-time station summaries. A station shows the source records whose title
 * matches its keywords: how many are open, which one is next, and a status
 * light derived from the records themselves. Nothing is stored or copied.
 */
import {
  boardNodeId,
  type CommandBoardSnapshot,
  type CommandBoardSource,
  type CommandBoardSourceBinding,
  type CommandBoardStationSummary,
} from "./command-board-contract";

/** A source record as a station sees it, read through the source's owning service. */
export interface BoardSourceRecord {
  sourceType: CommandBoardSource;
  sourceId: string;
  title: string;
  detail?: string;
  dueAt?: string | null;
  /** Needs a person now: an overdue task, a pending approval, an overdue balance. */
  attention?: boolean;
  /** Cannot move until something outside it changes. */
  blocked?: boolean;
  href: string;
}

export type BoardSourceReads = Partial<
  Record<CommandBoardSource, BoardSourceRecord[] | "unavailable">
>;

const NOUNS: Record<CommandBoardSource, [string, string]> = {
  tasks: ["task", "tasks"],
  opportunities: ["opportunity", "opportunities"],
  conversations: ["conversation", "conversations"],
  approvals: ["approval", "approvals"],
  collections: ["balance", "balances"],
  contacts: ["person", "people"],
};

function shortDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function matchesBinding(record: BoardSourceRecord, binding: CommandBoardSourceBinding) {
  if (record.sourceType !== binding.source) return false;
  if (!binding.match.length) return true;
  const title = record.title.toLowerCase();
  return binding.match.some((word) => title.includes(word.toLowerCase()));
}

export function summarizeStation(
  id: string,
  bindings: readonly CommandBoardSourceBinding[],
  reads: BoardSourceReads,
): CommandBoardStationSummary {
  const unavailable = bindings
    .filter(
      (binding) => reads[binding.source] === "unavailable" || reads[binding.source] === undefined,
    )
    .map((binding) => binding.source);
  const seen = new Set<string>();
  const records: BoardSourceRecord[] = [];
  for (const binding of bindings) {
    const list = reads[binding.source];
    if (!Array.isArray(list)) continue;
    for (const record of list) {
      const key = `${record.sourceType}:${record.sourceId}`;
      if (seen.has(key) || !matchesBinding(record, binding)) continue;
      seen.add(key);
      records.push(record);
    }
  }
  records.sort(
    (a, b) =>
      Number(Boolean(b.blocked)) - Number(Boolean(a.blocked)) ||
      Number(Boolean(b.attention)) - Number(Boolean(a.attention)) ||
      (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"),
  );
  const counts = new Map<CommandBoardSource, number>();
  for (const record of records)
    counts.set(record.sourceType, (counts.get(record.sourceType) ?? 0) + 1);
  const rows: CommandBoardStationSummary["rows"] = [];
  if (records.length) {
    rows.push({
      label: "Open",
      value: [...counts]
        .map(([source, count]) => `${count} ${NOUNS[source][count === 1 ? 0 : 1]}`)
        .join(" · "),
    });
    const first = records[0]!;
    const due = shortDate(first.dueAt);
    rows.push({
      label: first.blocked ? "Blocked" : first.attention ? "Needs you" : "Next",
      value: due ? `${first.title} · ${due}` : first.title,
    });
  } else if (unavailable.length === bindings.length && bindings.length) {
    rows.push({ label: "Sources", value: "Unavailable right now" });
  } else {
    rows.push({ label: "Open", value: "Nothing open" });
  }
  return {
    id,
    status: records.some((record) => record.blocked)
      ? "blocked"
      : records.some((record) => record.attention)
        ? "attention"
        : records.length
          ? "ok"
          : "idle",
    rows,
    records: records.slice(0, 8).map(({ sourceType, sourceId, title, detail, href }) => ({
      sourceType,
      sourceId,
      title,
      detail,
      href,
    })),
    unavailable,
  };
}

/** Summaries for every station and satellite on the given boards, from one set of source reads. */
export function summarizeBoards(
  boards: CommandBoardSnapshot["boards"],
  reads: BoardSourceReads,
): CommandBoardSnapshot["summaries"] {
  const summaries: CommandBoardSnapshot["summaries"] = {};
  for (const { boardKey, document } of boards) {
    for (const satellite of document.satellites) {
      const id = boardNodeId(boardKey, "satellite", satellite.key);
      summaries[id] = summarizeStation(id, satellite.sources, reads);
    }
    for (const phase of document.phases) {
      for (const station of phase.stations) {
        const id = boardNodeId(boardKey, phase.key, station.key);
        summaries[id] = summarizeStation(id, station.sources, reads);
      }
      for (const segment of phase.segments)
        for (const station of segment.stations) {
          const id = boardNodeId(boardKey, phase.key, segment.key, station.key);
          summaries[id] = summarizeStation(id, station.sources, reads);
        }
    }
  }
  return summaries;
}

/** The sources any station on these boards reads, so a request reads each source once. */
export function boardSources(boards: CommandBoardSnapshot["boards"]): CommandBoardSource[] {
  const sources = new Set<CommandBoardSource>();
  for (const { document } of boards) {
    for (const satellite of document.satellites)
      for (const s of satellite.sources) sources.add(s.source);
    for (const phase of document.phases) {
      for (const station of phase.stations) for (const s of station.sources) sources.add(s.source);
      for (const segment of phase.segments)
        for (const station of segment.stations)
          for (const s of station.sources) sources.add(s.source);
    }
  }
  return [...sources];
}

/** Every skill named on these boards, with whether a registered, enabled tool can run it. */
export function boardSkills(
  boards: CommandBoardSnapshot["boards"],
  isReady: (skill: string) => boolean,
): CommandBoardSnapshot["skills"] {
  const skills: CommandBoardSnapshot["skills"] = {};
  for (const { document } of boards)
    for (const phase of document.phases)
      for (const station of [...phase.stations, ...phase.segments.flatMap((s) => s.stations)])
        for (const skill of station.skills) skills[skill] = isReady(skill);
  return skills;
}
