/**
 * Projects Command Board documents and their read-time station summaries onto
 * the desk canvas. Anchors are businesses, hubs are phases, cards are
 * segments and stations. Nothing here stores or derives a lifecycle.
 */
import {
  boardNodeId,
  type CommandBoardSnapshot,
  type CommandBoardStation,
} from "../revenue-os/command-board-contract";
import type { DeskNode } from "./canvas-desk";

export function commandBoardCanvasNodes(snapshot: CommandBoardSnapshot): DeskNode[] {
  const nodes: DeskNode[] = [];
  const stationNode = (parentId: string, id: string, station: CommandBoardStation): DeskNode => {
    const summary = snapshot.summaries[id];
    return {
      id,
      parentId,
      kind: "station",
      label: station.label,
      status: summary?.status,
      data: {
        icon: station.icon,
        subtitle: station.subtitle,
        rows: summary?.rows ?? [],
        skills: station.skills,
      },
    };
  };
  for (const board of [...snapshot.boards].sort((a, b) => a.position - b.position)) {
    const { document, boardKey } = board;
    const anchorId = boardNodeId(boardKey);
    nodes.push({
      id: anchorId,
      parentId: null,
      kind: "anchor",
      label: document.anchor.label,
      data: { icon: document.anchor.icon, detail: document.anchor.detail ?? document.mode.label },
    });
    for (const satellite of document.satellites) {
      const id = boardNodeId(boardKey, "satellite", satellite.key);
      const summary = snapshot.summaries[id];
      nodes.push({
        id,
        parentId: anchorId,
        kind: "satellite",
        slot: satellite.slot,
        label: satellite.label,
        status: summary?.status === "attention" ? "attention" : undefined,
        data: { icon: satellite.icon, detail: summary?.rows[0]?.value ?? satellite.detail },
      });
    }
    for (const phase of document.phases) {
      const phaseId = boardNodeId(boardKey, phase.key);
      nodes.push({
        id: phaseId,
        parentId: anchorId,
        kind: "hub",
        label: phase.label,
        data: { icon: phase.icon, short: phase.short },
      });
      for (const station of phase.stations)
        nodes.push(stationNode(phaseId, boardNodeId(boardKey, phase.key, station.key), station));
      for (const segment of phase.segments) {
        const segmentId = boardNodeId(boardKey, phase.key, segment.key);
        nodes.push({
          id: segmentId,
          parentId: phaseId,
          kind: "segment",
          label: segment.label,
          data: { icon: segment.icon, detail: segment.description },
        });
        for (const station of segment.stations)
          nodes.push(
            stationNode(
              segmentId,
              boardNodeId(boardKey, phase.key, segment.key, station.key),
              station,
            ),
          );
      }
    }
  }
  return nodes;
}

/** Every station and side node in a document with its display id, in board order. */
export function commandBoardStations(
  boardKey: string,
  document: CommandBoardSnapshot["boards"][number]["document"],
) {
  const stations: { id: string; station: CommandBoardStation; path: string[] }[] = [];
  for (const satellite of document.satellites)
    stations.push({
      id: boardNodeId(boardKey, "satellite", satellite.key),
      station: {
        key: satellite.key,
        label: satellite.label,
        icon: satellite.icon,
        subtitle: satellite.detail,
        sources: satellite.sources,
        skills: [],
      },
      path: [],
    });
  for (const phase of document.phases) {
    for (const station of phase.stations)
      stations.push({
        id: boardNodeId(boardKey, phase.key, station.key),
        station,
        path: [phase.label],
      });
    for (const segment of phase.segments)
      for (const station of segment.stations)
        stations.push({
          id: boardNodeId(boardKey, phase.key, segment.key, station.key),
          station,
          path: [phase.label, segment.label],
        });
  }
  return stations;
}
