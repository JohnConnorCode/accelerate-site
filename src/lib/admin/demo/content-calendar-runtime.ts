import {
  contentCalendarCommandPreviewSchema,
  contentCalendarCommandProposalSchema,
  contentCalendarCommandApprovalSchema,
  contentCalendarChangesSchema,
  prepareContentCalendarCommand,
} from "@/lib/revenue-os/content-calendar-contract";
import { demoBusinessDigest, type DemoBusinessState } from "./business-runtime";
import type { DemoState } from "./runtime";

// Uses the shared command validator and existing fictional records, approval queue
// and receipts. No live database or provider handle enters this adapter.
export async function handleDemoContentCalendar(
  scenarioId: string,
  state: DemoState,
  business: DemoBusinessState,
  rows: Array<Record<string, unknown>>,
  columns: Array<{ column_key: string; label: string }>,
  path: string,
  method: string,
  body: Record<string, unknown>,
  params: URLSearchParams,
  save: () => void,
): Promise<Response | null> {
  const action =
    path === "/api/admin/revenue-os/actions" && method === "PATCH"
      ? business.actions.find(
          (item) => item.id === body.id && item.action_type === "content_calendar_change",
        )
      : undefined;
  if (!action && path !== "/api/admin/content" && path !== "/api/admin/content/commands")
    return null;
  if (method === "GET") return null;
  const json = (value: unknown, status = 200) => Response.json(value, { status });
  try {
    if (state.moduleOverrides.content === false) return json({ error: "Content is disabled" }, 403);
    const snapshots = rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      status: String(row.status),
      sortOrder: Number(row.sort_order),
      revision: String(row.updated_at),
    }));
    const statuses = columns.map((column) => ({
      key: column.column_key,
      label: column.label,
      revision: state.contentSeedAt!,
    }));
    const preview = async (raw: unknown) => {
      const facts = prepareContentCalendarCommand(scenarioId, raw, snapshots, statuses);
      return { ...facts, digest: await demoBusinessDigest(facts) };
    };
    if (path === "/api/admin/content/commands") {
      const { action: operation, ...raw } = body;
      if (operation === "preview") return json({ ...(await preview(raw)), simulated: true });
      if (operation !== "propose") return json({ error: "Choose preview or propose" }, 400);
      const input = contentCalendarCommandProposalSchema.parse(raw);
      const prepared = await preview({ requestKey: input.requestKey, command: input.command });
      if (input.digest !== prepared.digest)
        return json({ error: "Preview changed. Preview and approve again." }, 409);
      const existing = business.actions.find(
        (item) =>
          item.action_type === "content_calendar_change" &&
          item.digest === prepared.digest &&
          item.status === "pending",
      );
      if (existing) return json({ action: existing, simulated: true });
      const title =
        prepared.command.operation === "create"
          ? prepared.command.values.title
          : prepared.command.operation === "delete"
            ? prepared.items[0]!.title
            : `${prepared.items.length} items`;
      const proposal = {
        id: crypto.randomUUID(),
        action_type: "content_calendar_change",
        title: `${prepared.command.operation} content: ${title}`,
        description:
          "Changes this fictional calendar only. Deletion is permanent; website pages and receipts remain.",
        status: "pending",
        error: null,
        payload: prepared,
        result: null,
        pluginId: "content",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        digest: prepared.digest,
      };
      business.actions.push(proposal);
      save();
      return json({ action: proposal, simulated: true });
    }
    if (action) {
      if (!["approve", "reject"].includes(String(body.decision)))
        return json({ error: "Invalid decision" }, 400);
      if (action.status !== "pending" || Date.parse(action.expires_at ?? "") <= Date.now())
        return json({ error: "Proposal already handled or expired" }, 409);
      if (body.decision === "reject") {
        action.status = "rejected";
        save();
        return json({ simulated: true, result: { status: "rejected" } });
      }
      const expected = contentCalendarCommandApprovalSchema.parse(action.payload);
      const current = await preview({ requestKey: expected.requestKey, command: expected.command });
      if (current.digest !== expected.digest) {
        action.status = "failed";
        action.error = "Content changed. Preview and approve again.";
        save();
        return json({ error: action.error }, 409);
      }
      body = current;
    } else if (method === "PATCH" && !Array.isArray(body.reorder)) {
      const { id, expectedRevision, ...changes } = body;
      const current = rows.find((row) => row.id === id);
      if (!current) return json({ error: "Content not found" }, 404);
      if (current.updated_at !== expectedRevision)
        return json({ error: "Content changed. Reload before saving." }, 409);
      const parsed = contentCalendarChangesSchema.parse(changes);
      if (parsed.status && !columns.some((column) => column.column_key === parsed.status))
        return json({ error: "Choose a current content status" }, 400);
      state.contentOverrides[String(id)] = {
        ...state.contentOverrides[String(id)],
        ...parsed,
        updated_at: new Date().toISOString(),
      };
      save();
      return json({ simulated: true, item: { ...current, ...parsed } });
    } else {
      const requestKey = method === "DELETE" ? params.get("requestKey") : body.requestKey;
      const { id, requestKey: ignored, ...values } = body;
      void ignored;
      const command =
        method === "POST"
          ? { operation: "create", id, values }
          : method === "DELETE"
            ? { operation: "delete", id: params.get("id") }
            : { operation: "reorder", updates: body.reorder };
      const input = contentCalendarCommandPreviewSchema.parse({ requestKey, command });
      const fingerprint = JSON.stringify(input);
      const previous = state.contentCommandReceipts?.[input.requestKey];
      if (previous)
        return previous.fingerprint === fingerprint
          ? json({ simulated: true, receipt: { ...previous.result, replayed: true } })
          : json({ error: "Request key already saved different content" }, 409);
      const prepared = await preview(input);
      const expected =
        method === "DELETE"
          ? [{ id: params.get("id"), revision: params.get("expectedRevision") }]
          : method === "PATCH"
            ? body.expected
            : undefined;
      if (
        expected &&
        (!Array.isArray(expected) ||
          expected.length !== prepared.items.length ||
          prepared.items.some(
            (item) =>
              !expected.some((raw) => {
                const value = raw as { id: string; revision: string };
                return value.id === item.id && value.revision === item.revision;
              }),
          ))
      )
        return json({ error: "Content changed. Reload before saving." }, 409);
      body = prepared;
    }
    const prepared = contentCalendarCommandApprovalSchema.parse(body);
    const command = prepared.command;
    const at = new Date().toISOString();
    if (command.operation === "create")
      state.contentOverrides[command.id] = {
        ...command.values,
        id: command.id,
        sort_order: 1000,
        created_at: at,
        updated_at: at,
      };
    else if (command.operation === "delete") state.deletedContentIds.push(command.id);
    else
      for (const item of command.updates)
        state.contentOverrides[item.id] = {
          ...state.contentOverrides[item.id],
          status: item.column_key,
          sort_order: item.sort_order,
          updated_at: at,
        };
    const result = {
      status: "simulated",
      operation: command.operation,
      count: command.operation === "reorder" ? command.updates.length : 1,
      published: false,
    };
    state.contentCommandReceipts ??= {};
    state.contentCommandReceipts[prepared.requestKey] = {
      fingerprint: JSON.stringify({ requestKey: prepared.requestKey, command }),
      result,
    };
    if (action) {
      action.status = "executed";
      action.result = result;
    }
    business.receipts.unshift({
      id: crypto.randomUUID(),
      operation: `Simulated content ${command.operation}`,
      at,
      simulated: true,
      sourceType: "content_calendar",
      sourceId: prepared.requestKey,
    });
    save();
    return json({ success: true, simulated: true, receipt: result, result });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Calendar simulation failed" },
      400,
    );
  }
}
