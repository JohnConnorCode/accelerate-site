#!/usr/bin/env tsx
/** Scoped HTTP by default; an explicitly configured local operator uses the same canonical service. */
import { compareWorkOrder, formatWorkPacket, workPacket } from "../src/lib/work-packet";
import { loadAgentConfiguration, assertClaimTransport } from "./lib/agent-profile.mjs";
import type { FeatureRequest } from "../src/lib/feature-board";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { readdirSync } from "node:fs";
import { receipt } from "./lib/task-context";
import {
  createCheckpoint,
  prepareSuccessor,
  retainedCheckpointWorkspace,
} from "./lib/agent-checkpoint.mjs";
import { readinessSummary, resumableCard } from "./lib/agent-readiness.mjs";
import {
  repositoryContext,
  isExpiredWorkClaim,
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
      "Plain-language backlog requests use npm run agent:go internally.\nagent:status | agent:show -- --card KEY | agent:next [-- --card KEY --json]\nRemote transport uses WORK_BOARD_URL and WORK_BOARD_TOKEN; explicit local operator transport uses --local-operator --project <project> with the existing local Supabase configuration.\nnext validates/fetches the exact approved base before claiming. --no-worktree is deliberate manual preparation.\nRetry uncertain claims using the printed --request-key. Heartbeat within 30 minutes; complete submits evidence for review.",
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
    "resume",
    "checkpoint",
    "audit",
  ];
  if (!commands.includes(command))
    throw new Error("Unknown work command. Run agent-dispatch.ts help.");
  const flags: Record<string, string> = {};
  const boolean = new Set(["json", "no-worktree", "full", "local-operator"]);
  const allowed = new Set([
    ...boolean,
    "card",
    "project",
    "request-key",
    "message",
    "evidence-file",
    "checkpoint-file",
    "worktree",
    "attempt",
    "limit",
    "offset",
  ]);
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

  if (flags.worktree && !["checkpoint", "progress"].includes(command))
    throw new Error("--worktree attaches retained source only through checkpoint or progress.");
  if (flags.attempt && !/^[a-f0-9-]{36}$/i.test(flags.attempt))
    throw new Error("--attempt must be a UUID");
  if (flags["request-key"] && !/^[a-f0-9-]{36}$/i.test(flags["request-key"]))
    throw new Error("--request-key must be a UUID");
  const configuration = loadAgentConfiguration(repositoryContext(process.cwd()));
  if (!flags["local-operator"] && configuration?.transport === "local-operator") {
    flags["local-operator"] = "true";
    flags.project ??= configuration.project;
  }
  const localOperator = flags["local-operator"] === "true";
  if (localOperator && !flags.project)
    throw new Error("--local-operator requires --project <project-key>");
  const endpoint = localOperator ? null : boardEndpoint(process.env);
  const token = process.env.WORK_BOARD_TOKEN;
  const request = localOperator
    ? (await import("./lib/local-work-board")).createLocalWorkRequest(
        flags.project,
        configuration?.transport === "local-operator" ? (configuration.capabilities ?? []) : [],
      )
    : (path = "", body?: unknown) => requestBoard(endpoint!, token, path, body);
  const transport = localOperator ? `local-operator:${flags.project}` : String(endpoint);
  const { root, sessions: sessionDir } = repositoryContext(process.cwd());
  let resumeSupport: { version: number; automaticRecoveryProjects: string[] } | undefined;
  const clientSession =
    process.env.ACCELERATE_AGENT_SESSION_ID ?? process.env.CODEX_THREAD_ID ?? null;
  const getPage = async (path: string) => {
    const page = await request(path);
    requireBoardProtocol(page);
    resumeSupport = page.resumableAttempts;
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
  function persistSession(session: Record<string, unknown>, live: FeatureRequest, path: string) {
    const updated = {
      ...session,
      card: live,
      attemptId: live.work_attempt_id ?? session.attemptId,
    };
    save(path, updated);
    if (updated.attemptId) save(resolve(sessionDir, `attempt-${updated.attemptId}.json`), updated);
    return updated;
  }
  if (command === "audit") {
    const limit = Number(flags.limit ?? 25),
      offset = Number(flags.offset ?? 0);
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    )
      throw new Error("Use --limit 1..100 and a nonnegative --offset.");
    const page = await getPage(`?limit=${limit}&offset=${offset}`);
    console.log(
      JSON.stringify(
        {
          ...readinessSummary(page.features),
          recovery: resumeSupport ?? { version: 0 },
          pageCount: page.features.length,
          nextOffset: page.nextOffset,
        },
        null,
        2,
      ),
    );
  } else if (command === "status" || command === "show") {
    if (command === "status" && !flags.full && !card) {
      const limit = Number(flags.limit ?? 25),
        offset = Number(flags.offset ?? 0);
      if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isSafeInteger(offset) ||
        offset < 0
      )
        throw new Error("Use --limit 1..100 and a nonnegative --offset.");
      const page = await getPage(`?limit=${limit}&offset=${offset}`);
      console.log(
        JSON.stringify(
          {
            cards: page.features.map((row: FeatureRequest) => receipt(row)),
            nextOffset: page.nextOffset,
          },
          null,
          2,
        ),
      );
      return;
    }
    const rows = await cards();
    if (flags.json) console.log(JSON.stringify(flags.full ? rows : rows.map(workPacket), null, 2));
    else if (card || command === "show") console.log(rows.map(formatWorkPacket).join("\n\n"));
    else
      for (const c of rows)
        console.log(
          `${c.seed_key ?? c.id} | ${c.status} | ${c.title}\n  ${(c.readiness ?? []).join(", ") || "Prerequisites and contract ready"}`,
        );
  } else if (command === "next" || command === "resume") {
    const requestKey = flags["request-key"] ?? randomUUID();
    const pendingPath = resolve(sessionDir, `pending-${requestKey}.json`);
    const previous = existsSync(pendingPath)
      ? JSON.parse(readFileSync(pendingPath, "utf8"))
      : undefined;
    if (
      previous &&
      (previous.endpoint !== transport ||
        (flags.card && previous.card.seed_key !== flags.card && previous.card.id !== flags.card))
    )
      throw new Error(
        "This request key belongs to another board or card. Preserve its session and inspect it before retrying.",
      );
    let rows = await cards();
    const localSessions = existsSync(sessionDir)
      ? readdirSync(sessionDir)
          .filter((name) => /^(?:attempt-)?[a-f0-9-]{36}\.json$/.test(name))
          .flatMap((name) => {
            try {
              return [
                {
                  path: resolve(sessionDir, name),
                  session: JSON.parse(readFileSync(resolve(sessionDir, name), "utf8")),
                },
              ];
            } catch {
              return [];
            }
          })
      : [];
    const explicitSession = flags.attempt
      ? (localSessions.find(
          ({ path }) => path === resolve(sessionDir, `attempt-${flags.attempt}.json`),
        ) ?? localSessions.find(({ session }) => session.attemptId === flags.attempt))
      : undefined;
    if (flags.attempt) {
      if (!explicitSession || explicitSession.session.endpoint !== transport)
        throw new Error(
          "Requested attempt session is unavailable for this board; no work was claimed.",
        );
      rows = rows.filter((row) => row.id === explicitSession.session.card.id);
      if (!rows.length || (previous && previous.card.id !== explicitSession.session.card.id))
        throw new Error(
          "Requested attempt does not match this card or request key; no work was claimed.",
        );
      if (
        rows[0]!.work_attempt_id &&
        explicitSession.session.card.work_attempt_id &&
        rows[0]!.work_attempt_id !== explicitSession.session.attemptId
      )
        throw new Error(
          "Requested attempt was superseded; its source and credentials are preserved.",
        );
    }
    const ownedLiveSessions = previous
      ? []
      : (explicitSession ? [explicitSession] : localSessions).filter(
          ({ session }) =>
            session.endpoint === transport &&
            (Boolean(explicitSession) ||
              session.worktree === root ||
              (clientSession && session.clientSession === clientSession)) &&
            rows.some(
              (row) =>
                row.id === session.card.id &&
                row.status === "in_progress" &&
                Date.parse(row.lease_expires_at ?? "") > Date.now(),
            ),
        );
    // Exact attempt identity wins over a pre-migration pointer with an old token.
    // Only adopt a legacy token when no known live attempt session is available.
    const current =
      ownedLiveSessions.find(({ session }) =>
        rows.some((row) => row.id === session.card.id && row.work_attempt_id === session.attemptId),
      ) ??
      ownedLiveSessions.find(({ session }) =>
        rows.some(
          (row) =>
            row.id === session.card.id && (!row.work_attempt_id || !session.card.work_attempt_id),
        ),
      );
    if (current) {
      const live = rows.find((row) => row.id === current.session.card.id)!;
      const result = await request("", {
        operation: "heartbeat",
        id: live.id,
        requestKey: randomUUID(),
        payload: { claimToken: current.session.claimToken },
      });
      const continued = persistSession(current.session, result.card, current.path);
      console.log(
        JSON.stringify(
          {
            ...(flags.full ? result.card : workPacket(result.card)),
            worktree: current.session.worktree,
            controlCheckout: root,
            attemptId: continued.attemptId,
          },
          null,
          2,
        ),
      );
      return;
    }
    const unavailable: { key: string; reason: string }[] = [];
    let resumeCandidate: FeatureRequest | undefined;
    let resumePlan;
    if (!previous && (!flags.card || command === "resume"))
      for (const candidate of rows.filter((c) => resumableCard(c, resumeSupport))) {
        try {
          resumePlan = flags["no-worktree"]
            ? undefined
            : prepareSuccessor(root, candidate, requestKey);
          resumeCandidate = candidate;
          break;
        } catch (error) {
          unavailable.push({
            key: candidate.seed_key ?? candidate.id,
            reason: error instanceof Error ? error.message : "Checkpoint unavailable",
          });
        }
      }
    if (unavailable.length)
      console.error(
        JSON.stringify({
          unavailableCheckpoints: unavailable.slice(0, 10),
          count: unavailable.length,
        }),
      );
    card =
      previous?.card ??
      resumeCandidate ??
      (command === "resume"
        ? undefined
        : rows.find(
            (c) =>
              (c.readiness?.length === 0 ||
                (flags.card &&
                  isExpiredWorkClaim(c) &&
                  c.readiness?.every((reason) => reason === "status:in_progress"))) &&
              (["planned", "backlog"].includes(c.status) ||
                (flags.card && isExpiredWorkClaim(c))) &&
              c.labels.some((l) => ["milestone:now", "milestone:next"].includes(l)),
          ));
    if (!card)
      throw new Error(
        `No ready Now/Next ticket is available. ${JSON.stringify(readinessSummary(rows))}. Use agent:audit for specific blockers; missing capabilities require a configured profile, not broader review rights.`,
      );
    const explicitContinuation = Boolean(
      flags.card && isExpiredWorkClaim(card) && command !== "resume",
    );
    const takingOver =
      previous?.body?.operation === "resume" ||
      (!explicitContinuation && resumableCard(card, resumeSupport));
    let explicitPlan;
    if (!previous && explicitContinuation && !flags["no-worktree"]) {
      const retainedSession = localSessions.find(
        ({ session }) =>
          session.endpoint === transport &&
          session.card.id === card!.id &&
          session.attemptId === card!.work_attempt_id,
      )?.session;
      const retained =
        retainedSession?.worktree && existsSync(retainedSession.worktree)
          ? { path: retainedSession.worktree, mode: "reuse" }
          : prepareWorkspace(root, card, { fetchBase: true, preserveRetainedChanges: true });
      if (retained.mode === "reuse") {
        const input = flags["checkpoint-file"]
          ? JSON.parse(readFileSync(flags["checkpoint-file"], "utf8"))
          : {
              summary:
                "Retained source preserved for explicitly requested expired continuation; unverified.",
              remaining: [
                "Continue the frozen acceptance criteria; verification is not yet complete.",
              ],
            };
        const saved = await createCheckpoint(
          retained.path,
          card,
          card.work_attempt_id ?? retainedSession?.attemptId ?? randomUUID(),
          input,
        );
        if (saved.omittedUntracked.length)
          console.error(
            JSON.stringify({
              retainedUntracked: saved.omittedUntracked,
              message:
                "New files remain in the predecessor. Include required source explicitly with --checkpoint-file.",
            }),
          );
        explicitPlan = prepareSuccessor(
          root,
          { ...card, work_checkpoint: { ...saved.checkpoint, id: randomUUID() } },
          requestKey,
        );
      } else if (card.work_checkpoint) explicitPlan = prepareSuccessor(root, card, requestKey);
      else if (retained.mode === "create") explicitPlan = retained;
      else
        throw new Error(
          "Retained branch has no worktree or checkpoint. Preserve and inspect its source before explicit continuation.",
        );
    }
    const plan =
      previous?.plan ??
      explicitPlan ??
      (flags["no-worktree"]
        ? undefined
        : takingOver
          ? (resumePlan ?? prepareSuccessor(root, card, requestKey))
          : prepareWorkspace(root, card, { fetchBase: true }));
    const session = previous ?? {
      endpoint: transport,
      card,
      claimToken: randomBytes(32).toString("base64url"),
      requestKey,
      clientSession,
    };
    const body = session.body ?? {
      operation: takingOver ? "resume" : "claim",
      id: card.id,
      revision: card.revision,
      requestKey,
      payload: {
        claimToken: session.claimToken,
        ...(takingOver ? { checkpointId: card.work_checkpoint?.id } : {}),
      },
    };
    save(pendingPath, { ...session, body, plan });
    console.error(
      `Claim request key: ${requestKey}. Retry an uncertain result with --request-key ${requestKey}.`,
    );
    const result = await request("", body);
    card = result.card;
    if (!card)
      throw new Error(
        "Claim response is incomplete; preserve the printed request key for operator reconciliation.",
      );
    const attemptSession = {
      ...session,
      card,
      attemptId: card.work_attempt_id ?? requestKey,
      worktree: plan?.path ?? null,
    };
    save(resolve(sessionDir, `attempt-${attemptSession.attemptId}.json`), attemptSession);
    const legacyPath = resolve(sessionDir, `${card.id}.json`);
    if (!existsSync(legacyPath)) save(legacyPath, attemptSession);
    let path: string | undefined;
    try {
      if (previous) {
        const live = (await getPage(`?id=${card.id}`)).features[0];
        if (
          live.status !== "in_progress" ||
          (live.work_attempt_id && live.work_attempt_id !== card.work_attempt_id)
        )
          throw new Error(
            "Replayed attempt is no longer current; preserve its source and inspect the live card.",
          );
      }
      if (plan) {
        if (previous && existsSync(plan.path)) {
          if (
            repositoryContext(plan.path).common !== repositoryContext(root).common ||
            (await import("./lib/developer-workspace.mjs")).git(plan.path, [
              "branch",
              "--show-current",
            ]) !== plan.branch
          )
            throw new Error("Recorded successor is occupied by another checkout.");
          path = plan.path;
        } else path = createWorkspace(plan);
      }
    } catch {
      throw new Error(
        `Claim retained for ${card.seed_key ?? card.id}; local worktree preparation failed. Inspect the target without deleting it. Use agent:release -- --card ${card.seed_key ?? card.id} if you cannot continue.`,
      );
    }
    let checkpointWarning: string | undefined;
    if (resumeSupport?.version === 1 && path && card.work_attempt_id && !takingOver && !previous) {
      try {
        const initial = createCheckpoint(path, card, card.work_attempt_id, {
          summary: "Initial source checkpoint; task acceptance remains unverified.",
          remaining: ["Complete the card acceptance and record verification evidence."],
        });
        const recorded = await request("", {
          operation: "checkpoint",
          id: card.id,
          revision: card.revision,
          requestKey: randomUUID(),
          payload: { claimToken: session.claimToken, checkpoint: initial.checkpoint },
        });
        if (!recorded.card)
          throw new Error("Checkpoint response did not include the current card.");
        card = recorded.card as FeatureRequest;
        save(resolve(sessionDir, `attempt-${attemptSession.attemptId}.json`), {
          ...attemptSession,
          card,
        });
      } catch (error) {
        checkpointWarning =
          error instanceof Error
            ? error.message
            : "Initial checkpoint unavailable; preserve source and checkpoint before handoff.";
      }
    }
    if (flags.json)
      console.log(
        JSON.stringify(
          {
            ...(flags.full ? card : workPacket(card)),
            worktree: path ?? null,
            controlCheckout: root,
            attemptId: attemptSession.attemptId,
            ...(checkpointWarning ? { checkpointWarning } : {}),
          },
          null,
          2,
        ),
      );
    else
      console.log(
        `Control checkout: ${root}\n${path ? `Worktree: ${path}\n\n` : ""}${formatWorkPacket(card)}`,
      );
  } else {
    if (!card) throw new Error("--card is required");
    const ownedSession = existsSync(sessionDir)
      ? readdirSync(sessionDir)
          .filter((name) => /^attempt-[a-f0-9-]{36}\.json$/.test(name))
          .flatMap((name) => {
            try {
              const session = JSON.parse(readFileSync(resolve(sessionDir, name), "utf8"));
              return [{ name, session }];
            } catch {
              return [];
            }
          })
          .find(
            ({ session }) =>
              session.card.id === card!.id &&
              session.endpoint === transport &&
              (session.worktree === root ||
                (clientSession && session.clientSession === clientSession)) &&
              (!card!.work_attempt_id || session.attemptId === card!.work_attempt_id),
          )
      : undefined;
    const sessionPath = resolve(
      sessionDir,
      flags.attempt ? `attempt-${flags.attempt}.json` : (ownedSession?.name ?? `${card.id}.json`),
    );
    if (!existsSync(sessionPath))
      throw new Error(
        "No local claim session exists for this card. Ask the maintainer to inspect ownership; never invent or replace another worker's token.",
      );
    const session = JSON.parse(readFileSync(sessionPath, "utf8"));
    assertClaimTransport(session, transport);
    // A legacy heartbeat can have succeeded before its response was lost. Prove
    // the retained token still owns the lease; never adopt a successor from a read.
    if (
      session.card.id === card.id &&
      !session.card.work_attempt_id &&
      card.work_attempt_id &&
      session.attemptId !== card.work_attempt_id
    ) {
      const renewed = await request("", {
        operation: "heartbeat",
        id: card.id,
        requestKey: randomUUID(),
        payload: { claimToken: session.claimToken },
      });
      const renewedCard: FeatureRequest | undefined = renewed.card;
      if (!renewedCard)
        throw new Error(
          "Heartbeat response omitted the current card; preserve the session and retry.",
        );
      card = renewedCard;
      Object.assign(session, persistSession(session, renewedCard, sessionPath));
    }

    if (
      session.card.id !== card.id ||
      (card.work_attempt_id && session.attemptId !== card.work_attempt_id)
    )
      throw new Error(
        "This attempt was superseded. Its credentials and source are preserved; use the successor packet.",
      );
    const attachedWorktree = flags.worktree
      ? retainedCheckpointWorkspace(root, card, flags.worktree)
      : undefined;
    if (attachedWorktree && session.worktree && resolve(session.worktree) !== attachedWorktree)
      throw new Error("This attempt already has a different retained checkout; preserve it.");
    const operation =
      command === "complete"
        ? "submit"
        : command === "progress" &&
            resumeSupport?.version === 1 &&
            (session.worktree || attachedWorktree)
          ? "checkpoint"
          : command;
    const payload: Record<string, unknown> = { claimToken: session.claimToken };
    if (["progress", "block"].includes(operation)) payload.message = flags.message;
    const requestKey = flags["request-key"] ?? randomUUID();
    const mutationPath = resolve(sessionDir, `mutation-${requestKey}.json`);
    const intent = JSON.stringify({
      operation,
      id: card.id,
      attempt: session.requestKey ?? session.attemptId ?? null,
      message: flags.message,
      ...(attachedWorktree ? { worktree: attachedWorktree } : {}),
      evidence: flags["evidence-file"] ? readFileSync(flags["evidence-file"], "utf8") : undefined,
      checkpoint: flags["checkpoint-file"]
        ? readFileSync(flags["checkpoint-file"], "utf8")
        : undefined,
    });
    if (existsSync(mutationPath)) {
      const saved = JSON.parse(readFileSync(mutationPath, "utf8"));
      if (saved.intent !== intent)
        throw new Error("Request key belongs to another operation; preserve it.");
      const replay = await request("", saved.mutation);
      console.log(
        JSON.stringify(
          flags.full
            ? replay
            : { ...receipt(replay.card, operation), replayed: replay.replayed ?? false },
          null,
          2,
        ),
      );
      return;
    }
    if (operation === "checkpoint") {
      if (resumeSupport?.version !== 1)
        throw new Error(
          "Board does not support durable checkpoints yet; use the compatible control checkout after migration.",
        );
      if (!flags["checkpoint-file"] && command !== "progress")
        throw new Error(
          "--checkpoint-file is required: summary, completed, remaining, artifacts and explicitly included new source files.",
        );
      if (!session.worktree && !attachedWorktree)
        throw new Error(
          "No retained workspace recorded; inspect it, then use --worktree <existing-agent-checkout>.",
        );
      if (
        card.status !== "in_progress" ||
        Date.parse(card.lease_expires_at ?? "") <= Date.now() ||
        (card.work_attempt_id && card.work_attempt_id !== session.attemptId)
      )
        throw new Error(
          "Claim is expired or superseded; preserve local source and resume through the canonical service.",
        );
      const renewed = await request("", {
        operation: "heartbeat",
        id: card.id,
        requestKey: randomUUID(),
        payload: { claimToken: session.claimToken },
      });
      card = renewed.card;
      // A successful canonical heartbeat proves this token may attach retained source.
      if (attachedWorktree) session.worktree = attachedWorktree;
      Object.assign(session, persistSession(session, renewed.card, sessionPath));
      const input = flags["checkpoint-file"]
        ? JSON.parse(readFileSync(flags["checkpoint-file"], "utf8"))
        : {
            summary: flags.message,
            remaining: [
              "Continue the recorded task; passing acceptance has not yet been submitted.",
            ],
          };
      if (
        typeof input.summary !== "string" ||
        input.summary.length < 10 ||
        input.summary.length > 4000 ||
        !["completed", "remaining", "artifacts", "files"].every(
          (key) =>
            input[key] === undefined ||
            (Array.isArray(input[key]) &&
              input[key].length <= 100 &&
              input[key].every((v: unknown) => typeof v === "string" && v.length <= 500)),
        )
      )
        throw new Error("Invalid checkpoint description or source-file list.");
      const result = createCheckpoint(
        session.worktree,
        card,
        session.attemptId ?? session.requestKey,
        input,
      );
      payload.checkpoint = result.checkpoint;
      if (result.omittedUntracked.length)
        console.error(
          `Checkpoint omitted ${result.omittedUntracked.length} unselected untracked files; inspect them locally before handoff.`,
        );
    }
    if (operation === "submit") {
      if (!flags["evidence-file"])
        throw new Error(
          "--evidence-file is required: summary, exact commitSha and acceptance-linked passing checks with environment and evidence.",
        );
      payload.evidence = JSON.parse(readFileSync(flags["evidence-file"], "utf8"));
    }
    const mutation = { operation, id: card!.id, revision: card!.revision, requestKey, payload };
    save(mutationPath, { mutation, intent });
    console.error(`Lifecycle request key: ${requestKey}`);
    const result = await request("", mutation);
    if (["progress", "checkpoint", "heartbeat"].includes(operation)) {
      const updated = {
        ...session,
        lastProgressAt:
          operation === "heartbeat" ? session.lastProgressAt : new Date().toISOString(),
        card: result.card,
        attemptId: result.card.work_attempt_id ?? session.attemptId,
      };
      save(sessionPath, updated);
      if (updated.attemptId)
        save(resolve(sessionDir, `attempt-${updated.attemptId}.json`), updated);
    }
    console.log(
      JSON.stringify(
        flags.full
          ? result
          : { ...receipt(result.card, operation), replayed: result.replayed ?? false },
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
