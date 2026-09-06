#!/usr/bin/env tsx
/** Scoped HTTP adapter. Preflight precedes claims; sessions and worktrees survive failures. */
import { compareWorkOrder, formatWorkPacket, workPacket } from "../src/lib/work-packet";
import type { FeatureRequest } from "../src/lib/feature-board";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import {
  repositoryContext,
  prepareWorkspace,
  createWorkspace,
  boardEndpoint,
  requestBoard,
  requireBoardProtocol,
} from "./lib/developer-workspace.mjs";
async function main() {
  const [command = "status", ...args] = process.argv.slice(2);
  if (command === "help" || args.includes("--help")) {
    console.log(
      "agent:status | agent:show -- --card KEY | agent:next [-- --card KEY --json]\nSet WORK_BOARD_URL and WORK_BOARD_TOKEN. Run npm run dev:doctor -- --board first.\nnext validates/fetches the exact approved base before claiming. --no-worktree is deliberate manual preparation.\nRetry uncertain claims using the printed --request-key. Heartbeat within 30 minutes; complete submits evidence for review.",
    );
    return;
  }
  const commands = [
    "status",
    "show",
    "next",
    "heartbeat",
    "release",
    "progress",
    "block",
    "complete",
  ];
  if (!commands.includes(command))
    throw new Error("Unknown work command. Run agent-dispatch.ts help.");
  const flags: Record<string, string> = {};
  const boolean = new Set(["json", "no-worktree"]);
  const allowed = new Set([...boolean, "card", "request-key", "message", "evidence-file"]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg || !arg.startsWith("--"))
      throw new Error("Unknown option; force bypasses are not supported.");
    const key = arg.slice(2);
    if (!allowed.has(key)) throw new Error("Unknown option; force bypasses are not supported.");
    if (boolean.has(key)) flags[key] = "true";
    else {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`--${key} needs a value`);
      flags[key] = value;
      i++;
    }
  }

  if (flags["request-key"] && !/^[a-f0-9-]{36}$/i.test(flags["request-key"]))
    throw new Error("--request-key must be a UUID");
  if (existsSync(".env.agent.local")) process.loadEnvFile(".env.agent.local");
  const endpoint = boardEndpoint(process.env),
    token = process.env.WORK_BOARD_TOKEN;
  const request = (path = "", body?: unknown) => requestBoard(endpoint, token, path, body);
  const { root, sessions: sessionDir } = repositoryContext(process.cwd());
  const getPage = async (path: string) => {
    const page = await request(path);
    requireBoardProtocol(page);
    return page;
  };
  let card: FeatureRequest | undefined;
  if (flags.card) {
    card = (await getPage(`?key=${encodeURIComponent(flags.card)}`)).features[0];
    if (!card && /^[a-f0-9-]{36}$/.test(flags.card))
      card = (await getPage(`?id=${flags.card}`)).features[0];
    if (!card) throw new Error("Card not found in this credential's project scope");
  }
  async function cards() {
    if (card) return [card];
    const rows: FeatureRequest[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = await getPage(`?offset=${offset}&limit=250`);
      rows.push(...page.features);
      if (
        page.nextOffset !== null &&
        (!Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset)
      )
        throw new Error("Invalid board pagination; no work was claimed.");
      offset = page.nextOffset;
    }
    return rows.sort(compareWorkOrder);
  }
  function save(path: string, value: unknown) {
    mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
    chmodSync(path, 0o600);
  }
  if (command === "status" || command === "show") {
    const rows = await cards();
    if (flags.json) console.log(JSON.stringify(rows.map(workPacket), null, 2));
    else if (card || command === "show") console.log(rows.map(formatWorkPacket).join("\n\n"));
    else
      for (const c of rows)
        console.log(
          `${c.seed_key ?? c.id} | ${c.status} | ${c.title}\n  ${(c.readiness ?? []).join(", ") || "Prerequisites and contract ready"}`,
        );
  } else if (command === "next") {
    const requestKey = flags["request-key"] ?? randomUUID();
    const pendingPath = resolve(sessionDir, `pending-${requestKey}.json`);
    const previous = existsSync(pendingPath)
      ? JSON.parse(readFileSync(pendingPath, "utf8"))
      : undefined;
    if (
      previous &&
      (previous.endpoint !== String(endpoint) ||
        (flags.card && previous.card.seed_key !== flags.card && previous.card.id !== flags.card))
    )
      throw new Error(
        "This request key belongs to another board or card. Preserve its session and inspect it before retrying.",
      );
    card =
      previous?.card ??
      (await cards()).find(
        (c) =>
          c.readiness?.length === 0 &&
          ["planned", "backlog"].includes(c.status) &&
          c.labels.some((l) => ["milestone:now", "milestone:next"].includes(l)),
      );
    if (!card)
      throw new Error(
        "No ready Now/Next ticket is available in your scope. Inspect agent:status; resolve dependencies, specification, capabilities or WIP before claiming.",
      );
    const plan = flags["no-worktree"]
      ? undefined
      : prepareWorkspace(root, card, { fetchBase: true });
    const session = previous ?? {
      endpoint: String(endpoint),
      card,
      claimToken: randomBytes(32).toString("base64url"),
      requestKey,
    };
    const body = session.body ?? {
      operation: "claim",
      id: card.id,
      revision: card.revision,
      requestKey,
      payload: { claimToken: session.claimToken },
    };
    save(pendingPath, { ...session, body });
    console.error(
      `Claim request key: ${requestKey}. Retry an uncertain result with --request-key ${requestKey}.`,
    );
    const result = await request("", body);
    card = result.card;
    if (!card)
      throw new Error(
        "Claim response is incomplete; preserve the printed request key for operator reconciliation.",
      );
    save(resolve(sessionDir, `${card.id}.json`), session);
    let path: string | undefined;
    try {
      if (plan) path = createWorkspace(plan);
    } catch {
      throw new Error(
        `Claim retained for ${card.seed_key ?? card.id}; local worktree preparation failed. Inspect the target without deleting it. Use agent:release -- --card ${card.seed_key ?? card.id} if you cannot continue.`,
      );
    }
    if (flags.json)
      console.log(JSON.stringify({ ...workPacket(card), worktree: path ?? null }, null, 2));
    else console.log(`${path ? `Worktree: ${path}\n\n` : ""}${formatWorkPacket(card)}`);
  } else {
    if (!card) throw new Error("--card is required");
    const sessionPath = resolve(sessionDir, `${card.id}.json`);
    if (!existsSync(sessionPath))
      throw new Error(
        "No local claim session exists for this card. Ask the maintainer to inspect ownership; never invent or replace another worker's token.",
      );
    const session = JSON.parse(readFileSync(sessionPath, "utf8"));
    if (session.endpoint && session.endpoint !== String(endpoint))
      throw new Error("Claim session belongs to another endpoint; use its original board URL.");
    const operation = command === "complete" ? "submit" : command;
    const payload: Record<string, unknown> = { claimToken: session.claimToken };
    if (["progress", "block"].includes(operation)) payload.message = flags.message;
    if (operation === "submit") {
      if (!flags["evidence-file"])
        throw new Error(
          "--evidence-file is required: summary, exact commitSha and acceptance-linked passing checks with environment and evidence.",
        );
      payload.evidence = JSON.parse(readFileSync(flags["evidence-file"], "utf8"));
    }
    console.log(
      JSON.stringify(
        await request("", {
          operation,
          id: card.id,
          revision: card.revision,
          requestKey: flags["request-key"] ?? randomUUID(),
          payload,
        }),
        null,
        2,
      ),
    );
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Work command failed");
  process.exitCode = 1;
});
