import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { getTenantRequestContext } from "@/lib/tenancy/context";
import { proposeAction } from "./actions";
import { isAiToolModuleEnabled, isModuleEnabled } from "./modules";
import {
  commandBoardDocumentSchema,
  commandBoardSaveSchema,
  type CommandBoardSnapshot,
} from "./command-board-contract";
import { commandBoardInstallSchema, planBoardInstall } from "./command-board-modes";
import { boardSkills, boardSources, summarizeBoards } from "./command-board-summary";
import { readBoardSources } from "./command-board-sources";

export const COMMAND_BOARD_MODULE_ID = "command-board";

/** Skills a station can name, mapped to the registered tool that runs each one. */
export const COMMAND_BOARD_SKILL_TOOLS: Record<string, string> = {
  "Invoice Chaser": "propose_collection_reminder",
};

function actor(db: SupabaseClient) {
  const context = getTenantRequestContext();
  if (
    context?.kind !== "actor" ||
    context.tenant.id !== tenantIdForDatabase(db) ||
    context.database !== db
  )
    throw new Error("An authenticated workspace member is required.");
  return context;
}

/** Rechecks live enablement; disabling the App stops every read, save and queued change. */
export async function requireCommandBoard(db: SupabaseClient) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Command Board requires a tenant-bound host");
  const { data, error } = await db
    .from("tenants")
    .select("status,config")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || data?.status !== "active" || !isModuleEnabled(COMMAND_BOARD_MODULE_ID, data.config))
    throw new Error("Command Board is disabled or workspace unavailable");
  return { tenantId, config: data.config as Record<string, unknown> };
}

async function readBoards(db: SupabaseClient, tenantId: string) {
  const { data, error } = await db
    .from("command_board_definitions")
    .select("board_key,position,revision,document")
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true });
  if (error) throw new Error("Command Board definitions are unavailable.");
  return (data ?? []).map((row) => {
    const parsed = commandBoardDocumentSchema.safeParse(row.document);
    if (!parsed.success)
      throw new Error(`Board ${row.board_key} needs recovery. Its stored definition is preserved.`);
    return {
      boardKey: String(row.board_key),
      position: Number(row.position),
      revision: Number(row.revision),
      document: parsed.data,
    };
  });
}

/** Boards with station summaries computed from source records at read time. */
export async function readCommandBoard(db: SupabaseClient): Promise<CommandBoardSnapshot> {
  const { user } = actor(db);
  const { tenantId, config } = await requireCommandBoard(db);
  const boards = await readBoards(db, tenantId);
  const reads = await readBoardSources(
    db,
    { kind: "workspace_member", email: user.email ?? "", userId: user.id },
    boardSources(boards),
  );
  return {
    boards,
    summaries: summarizeBoards(boards, reads),
    skills: boardSkills(boards, (skill) => {
      const tool = COMMAND_BOARD_SKILL_TOOLS[skill];
      return Boolean(tool && isAiToolModuleEnabled(tool, config).enabled);
    }),
    observedAt: new Date().toISOString(),
  };
}

export async function saveCommandBoard(db: SupabaseClient, raw: unknown) {
  const context = actor(db);
  if (context.role !== "admin") throw new Error("Workspace administrator access required.");
  await requireCommandBoard(db);
  const input = commandBoardSaveSchema.parse(raw);
  const { data, error } = await db.rpc("save_command_board", {
    p_board_key: input.boardKey,
    p_revision: input.revision,
    p_position: input.position,
    p_document: input.document,
    p_request_id: input.requestId,
  });
  if (error)
    throw new Error(
      error.code === "40001"
        ? "This board changed in another session. Reload before saving."
        : "The board could not be saved. Retry with the same changes.",
    );
  return data as { boardKey: string; revision: number; position: number };
}

/** Installs a mode template as this workspace's own board. Installing twice changes nothing. */
export async function installCommandBoardMode(db: SupabaseClient, raw: unknown) {
  const input = commandBoardInstallSchema.parse(raw);
  const { tenantId } = await requireCommandBoard(db);
  const plan = planBoardInstall(await readBoards(db, tenantId), input);
  if (plan.kind === "conflict")
    throw new Error("A different board already uses this key. Choose another name.");
  if (plan.kind === "existing") {
    const { boardKey, revision, position } = plan.board;
    return { boardKey, revision, position, installed: false };
  }
  const saved = await saveCommandBoard(db, {
    boardKey: input.boardKey,
    revision: 0,
    position: plan.position,
    document: plan.document,
    requestId: input.requestId,
  });
  return { ...saved, installed: true };
}

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Exact before-and-after for a proposed board change, bound to the current revision. */
export async function previewCommandBoardChange(db: SupabaseClient, raw: unknown) {
  const context = actor(db);
  const { tenantId } = await requireCommandBoard(db);
  const input = commandBoardSaveSchema.parse(raw);
  const current = (await readBoards(db, tenantId)).find(
    (board) => board.boardKey === input.boardKey,
  );
  if ((current?.revision ?? 0) !== input.revision)
    throw new Error("This board changed. Read and preview again.");
  const facts = { tenantId, userId: context.user.id, change: input };
  return {
    ...facts,
    before: current?.document ?? null,
    after: input.document,
    digest: hash(facts),
    requiresHumanApproval: true as const,
  };
}

export async function proposeCommandBoardChange(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = z
    .object({ change: commandBoardSaveSchema, digest: z.string().length(64) })
    .strict()
    .parse(raw);
  const preview = await previewCommandBoardChange(db, input.change);
  if (input.digest !== preview.digest) throw new Error("Board preview changed. Preview again.");
  const stored = await db.from("command_board_proposals").insert({
    tenant_id: preview.tenantId,
    actor_id: preview.userId,
    digest: preview.digest,
    preview,
  });
  if (stored.error && stored.error.code !== "23505")
    throw new Error("Could not retain the exact board preview.");
  return proposeAction(db, {
    actionType: "command_board_change",
    title: `Update ${input.change.document.anchor.label} board`,
    description: `Save ${input.change.document.mode.label} with ${input.change.document.phases.length} phases.`,
    payload: { tenantId: preview.tenantId, userId: preview.userId, digest: preview.digest },
    dedupeKey: "command-board:" + preview.digest,
    proposedBy: actorEmail,
    sourceContext: "admin_ai",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
}

/** Applies an approved board change after rechecking module, member, workspace and revision. */
export async function executeCommandBoardChange(db: SupabaseClient, raw: unknown) {
  const input = z
    .object({ tenantId: z.uuid(), userId: z.uuid(), digest: z.string().regex(/^[a-f0-9]{64}$/) })
    .strict()
    .parse(raw);
  const context = actor(db);
  await requireCommandBoard(db);
  if (context.tenant.id !== input.tenantId)
    throw new Error("This board change belongs to another workspace.");
  const { data, error } = await db
    .from("command_board_proposals")
    .select("preview")
    .eq("tenant_id", input.tenantId)
    .eq("actor_id", input.userId)
    .eq("digest", input.digest)
    .maybeSingle();
  if (error || !data) throw new Error("The exact board preview is no longer available.");
  const preview = z
    .object({ tenantId: z.uuid(), userId: z.uuid(), change: commandBoardSaveSchema })
    .passthrough()
    .parse(data.preview);
  if (
    hash({ tenantId: preview.tenantId, userId: preview.userId, change: preview.change }) !==
    input.digest
  )
    throw new Error("Board approval does not match the exact change.");
  // A retried approval replays the same receipt instead of saving twice.
  const d = input.digest;
  const requestId = `${d.slice(0, 8)}-${d.slice(8, 12)}-4${d.slice(13, 16)}-8${d.slice(17, 20)}-${d.slice(20, 32)}`;
  return saveCommandBoard(db, { ...preview.change, requestId });
}
