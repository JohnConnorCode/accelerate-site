import { z } from "zod";
import { getModuleSettings, type ModuleSettingsConfig } from "@/lib/revenue-os/modules";
import {
  assertRadarStoreContext,
  normalizeRadarStoreChange,
  type RadarStoreChange,
} from "@/lib/revenue-os/radar-store-contract";
import {
  RADAR_FACTORS,
  hasPublicAffairsSignals,
  radarCandidateFromEvidence,
  radarSelectionSchema,
  selectRadarCandidates,
} from "@/lib/revenue-os/radar-ranking-contract";
import {
  radarWorkspaceCommandSchema,
  radarWorkspaceReadSchema,
  type RadarWorkspaceData,
} from "@/lib/revenue-os/radar-workspace-contract";
import { seedRadar, type DemoRadarState } from "./radar-fixtures";
import type { DemoScenarioPack } from "./scenarios";
import type { DemoBusinessState } from "./business-runtime";

type Command = z.infer<typeof radarWorkspaceCommandSchema>;
type ReviewCommand = Extract<Command, { kind: "store_preview" | "assessment_preview" }>;
const now = () => new Date().toISOString();
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
const key = (value: unknown) => JSON.stringify(canonical(value));
async function digest(value: unknown) {
  return [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key(value)))),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
const sourceKey = (v: {
  title: string;
  body_text: string;
  published_at: string | null;
  author?: string;
}) => key([v.title, v.body_text, v.published_at, v.author ?? null]);
const linksFor = (s: DemoRadarState, id: string) => s.citations[id]?.at(-1)?.links ?? [];
const sourcesFor = (s: DemoRadarState, id: string) => {
  const ids = linksFor(s, id).map((v) => v.source_version_id);
  return s.sources.filter((v) => ids.includes(v.id));
};
const currentAssessment = (s: DemoRadarState, id: string) =>
  s.assessments.find((a) => a.opportunity_id === id);
const candidate = (s: DemoRadarState, o: DemoRadarState["opportunities"][number]) =>
  radarCandidateFromEvidence(
    o,
    currentAssessment(s, o.id),
    linksFor(s, o.id).map((c) => c.source_version_id),
    sourcesFor(s, o.id),
  );

/** Session-owned transport for the real admin screens. It cannot access providers or the database. */
export async function handleDemoRadar(
  pack: DemoScenarioPack,
  state: DemoBusinessState,
  modules: Record<string, boolean>,
  url: URL,
  method: string,
  body: Record<string, unknown>,
  save: () => void,
  moduleSettings: ModuleSettingsConfig = {},
): Promise<Response | null> {
  const action = state.actions.find((a) => a.id === body.id && a.pluginId === "opportunity-radar");
  if (
    !url.pathname.startsWith("/api/admin/radar/") &&
    !(url.pathname === "/api/admin/revenue-os/actions" && action)
  )
    return null;
  if (!state.radar) {
    state.radar = seedRadar(pack);
    save();
  }
  const s = state.radar;
  const settings = getModuleSettings("opportunity-radar", moduleSettings);
  const enabled = () => {
    if (!modules["opportunity-radar"])
      throw new Error("Radar is disabled. Retained records remain readable.");
  };
  const find = (id: string) => {
    const o = s.opportunities.find((o) => o.id === id);
    if (!o) throw new Error("Radar opportunity unavailable");
    return o;
  };
  const respond = (value: unknown, status = 200) => Response.json(value, { status });
  async function preview(command: ReviewCommand) {
    enabled();
    const input = command.input;
    const before =
      "opportunityId" in input
        ? find(input.opportunityId)
        : "opportunityId" in input.change
          ? find(input.change.opportunityId)
          : null;
    let sources = before ? sourcesFor(s, before.id) : [];
    if (command.kind === "store_preview") {
      const change = normalizeRadarStoreChange(command.input.change);
      const ids = new Set([
        ...sources.map((v) => v.id),
        ...("citations" in change ? change.citations.map((c) => c.sourceVersionId) : []),
        ...("sourceVersionId" in change ? [change.sourceVersionId] : []),
      ]);
      sources = s.sources.filter((v) => ids.has(v.id));
      assertRadarStoreContext(
        change,
        before,
        before ? linksFor(s, before.id).map((c) => c.source_version_id) : [],
        sources,
      );
      const fields = change.operation === "update_opportunity" ? change.patch : change;
      if (
        "contactId" in fields &&
        fields.contactId &&
        !pack.people.some((p) => p.id === fields.contactId)
      )
        throw new Error("Canonical contact unavailable");
      if ("companyId" in fields && fields.companyId)
        throw new Error("Canonical company unavailable in this demo");
      if ("citations" in change && change.citations.some((c) => c.evidenceId))
        throw new Error("Canonical evidence record unavailable in this demo");
      const value = {
        operationId: input.operationId,
        change,
        before,
        sources: sources.map(({ id, revision, verification }) => ({ id, revision, verification })),
      };
      return {
        ...value,
        digest: await digest({ value, settings, scenario: pack.id }),
        requiresHumanApproval: true,
      };
    }
    const { assessment, expectedRevision } = command.input;
    if (!before || before.revision !== expectedRevision)
      throw new Error("Opportunity changed; read current revision");
    if (["completed", "dismissed", "declined", "no_response"].includes(before.state))
      throw new Error("Terminal opportunity cannot be assessed");
    if (
      !sources.length ||
      RADAR_FACTORS.some((k) =>
        assessment.estimates[k].sourceVersionIds.some((id) => !sources.some((v) => v.id === id)),
      )
    )
      throw new Error("Assessment must cite current opportunity evidence");
    const expiry = Date.parse(assessment.expiresAt);
    if (expiry <= Date.now() || expiry > Date.now() + 30 * 86400000)
      throw new Error("Assessment expiry must be within thirty days");
    if (assessment.classification === "business") {
      if (sources.some((v) => v.verification !== "verified" || v.unavailable))
        throw new Error("Review every available source before a business assessment");
      if (
        hasPublicAffairsSignals(
          key([
            before.title,
            before.summary,
            before.recommended_action,
            assessment,
            linksFor(s, before.id),
            sources.map((v) => ({ title: v.title, body_text: v.body_text })),
          ]),
        )
      )
        throw new Error("Public affairs signals require neutral manual review");
    }
    const value = {
      ...command.input,
      sources: sources.map(({ id, revision, verification }) => ({ id, revision, verification })),
      currentAssessmentId: currentAssessment(s, before.id)?.id ?? null,
    };
    return {
      ...value,
      digest: await digest({ value, settings, scenario: pack.id }),
      requiresHumanApproval: true,
    };
  }
  try {
    if (url.pathname === "/api/admin/radar/workspace" && method === "GET") {
      const input = radarWorkspaceReadSchema.parse(Object.fromEntries(url.searchParams));
      const o = input.opportunityId ? find(input.opportunityId) : null;
      const c = o ? candidate(s, o) : null;
      const expired = Boolean(c?.assessment && Date.parse(c.assessment.expiresAt) <= Date.now());
      const person = pack.people.find((p) => p.id === o?.contact_id);
      const view = (v: DemoRadarState["sources"][number]) => ({
        id: v.id,
        source_id: v.source_id,
        title: v.title,
        version: v.version,
        revision: v.revision,
        verification: v.verification,
        canonicalUrl: v.canonicalUrl,
        published_at: v.published_at,
      });
      const result: RadarWorkspaceData = {
        enabled: Boolean(modules["opportunity-radar"]),
        organization: String(settings.organization || pack.name),
        model: {
          mode: "simulated",
          available: Boolean(modules["opportunity-radar"]),
          reason:
            "Fictional source brief generated in this browser session. No model or provider calls; production requires explicit model configuration.",
        },
        selection:
          modules["opportunity-radar"] && !o
            ? selectRadarCandidates(
                s.opportunities.slice(0, 50).map((o) => candidate(s, o)),
                radarSelectionSchema.parse({}),
                Number(settings.dailyShortlist ?? 5),
                new Date(),
              )
            : null,
        candidateTitles: s.opportunities.slice(0, 50).map(({ id, title }) => ({ id, title })),
        opportunities: o ? [o] : s.opportunities.slice(0, 20),
        sources: (o ? sourcesFor(s, o.id) : s.sources.slice(0, 20)).map(view),
        packet: o
          ? {
              opportunity: o,
              citations: linksFor(s, o.id),
              sources: sourcesFor(s, o.id).map(view),
              assets: s.assets
                .filter((a) => a.opportunityId === o.id)
                .map(({ id, kind, title, state }) => ({ id, kind, title, state })),
              outcomes: s.outcomes.filter((v) => v.opportunityId === o.id),
              history: s.history.filter((h) => h.entity_id === o.id),
              contact: person
                ? {
                    id: person.id,
                    name: person.name,
                    communicationStatus: s.restrictedContactIds.includes(person.id)
                      ? "suppressed"
                      : "unknown",
                  }
                : null,
              assessment: c!.assessment,
              assessmentCurrent: Boolean(c!.assessment && !c!.deferral && !expired),
              assessmentReason:
                c!.deferral ?? (expired ? "Assessment expired; review again" : null),
              truncated: false,
            }
          : null,
        warnings: [],
        truncated: s.opportunities.length > 20 || s.sources.length > 20,
      };
      return respond({ ...result, simulated: true });
    }
    if (url.pathname === "/api/admin/radar/commands" && method === "POST") {
      const command = radarWorkspaceCommandSchema.parse(body);
      if (command.kind === "read_record") {
        const input = command.input;
        if (input.operationId)
          return respond({
            receipt: s.history.find((h) => h.operation_key === input.operationId) ?? null,
            simulated: true,
          });
        const record = input.sourceVersionId
          ? s.sources.find((v) => v.id === input.sourceVersionId)
          : input.assetId
            ? s.assets.find((a) => a.id === input.assetId)
            : null;
        if (!record) throw new Error("Choose an available source, asset or operation receipt");
        if ("unavailable" in record && record.unavailable)
          throw new Error(
            "Source text is temporarily unavailable. Retained metadata remains readable.",
          );
        const chars = Array.from(record.body_text),
          end = Math.min(chars.length, input.offset + 2000);
        return respond({
          record: {
            id: record.id,
            title: record.title,
            ...("canonicalUrl" in record ? { canonicalUrl: record.canonicalUrl } : {}),
          },
          text: chars.slice(input.offset, end).join(""),
          nextOffset: end < chars.length ? end : null,
          simulated: true,
        });
      }
      if (command.kind === "prepare_brief") {
        enabled();
        const i = command.input,
          o = find(i.opportunityId),
          sources = sourcesFor(s, o.id);
        if (o.revision !== i.expectedRevision)
          throw new Error("Opportunity changed; refresh before drafting");
        if (
          new Set(i.sourceVersionIds).size !== i.sourceVersionIds.length ||
          i.sourceVersionIds.some(
            (id) =>
              !sources.some((v) => v.id === id && v.verification !== "retracted" && !v.unavailable),
          )
        )
          throw new Error("Choose current, available, non-retracted source versions");
        const inputKey = key(i),
          prior = s.briefs[i.operationId];
        if (prior && prior.inputKey !== inputKey)
          throw new Error("Operation ID already used with different inputs");
        const bodyText =
          prior?.bodyText ??
          i.sourceVersionIds
            .map((id) => {
              const v = sources.find((v) => v.id === id)!;
              return `${v.body_text.slice(0, 500)} [${id}]`;
            })
            .join("\n\n") +
            "\n\nUnknowns\n- Participation, permission and real-world outcomes are not confirmed.\n\nFictional demo brief; no model was called.";
        s.briefs[i.operationId] = { inputKey, bodyText };
        save();
        return respond({
          status: "completed",
          bodyText,
          sourceVersionIds: i.sourceVersionIds,
          simulated: true,
        });
      }
      const isStore = command.kind.startsWith("store_");
      const { digest: expected, ...request } = command.input as typeof command.input & {
        digest?: string;
      };
      const review = radarWorkspaceCommandSchema.parse({
        kind: isStore ? "store_preview" : "assessment_preview",
        input: request,
      }) as ReviewCommand;
      const current = await preview(review);
      if (command.kind.endsWith("preview")) return respond({ ...current, simulated: true });
      if (expected !== current.digest)
        throw new Error("Preview changed; review the current packet");
      let queued = state.actions.find(
        (a) =>
          a.pluginId === "opportunity-radar" &&
          a.digest === expected &&
          a.requestId === request.operationId &&
          a.status === "pending",
      );
      if (!queued) {
        queued = {
          id: crypto.randomUUID(),
          action_type: isStore ? "update_radar_store" : "review_radar_assessment",
          title: isStore ? "Review Radar evidence change" : "Review Radar assessment",
          description: "Fictional session change; explicit approval required",
          status: "pending",
          error: null,
          payload: { review },
          result: null,
          pluginId: "opportunity-radar",
          created_at: now(),
          requestId: request.operationId,
          digest: expected,
        };
        state.actions.unshift(queued);
        save();
      }
      return respond({ ...queued, simulated: true });
    }
    if (action && method === "PATCH") {
      if (body.decision === "reject" && action.status === "pending") {
        action.status = "rejected";
        save();
        return respond({ simulated: true });
      }
      if (body.decision !== "approve") throw new Error("Invalid decision");
      if (action.status === "executed") return respond({ result: action.result, simulated: true });
      if (action.status !== "pending") throw new Error("Action already handled");
      const review = radarWorkspaceCommandSchema.parse(action.payload.review) as ReviewCommand;
      if (!["store_preview", "assessment_preview"].includes(review.kind))
        throw new Error("Invalid approval payload");
      const inputKey = key(review),
        prior = s.history.find((h) => h.operation_key === review.input.operationId);
      if (prior) {
        if (prior.inputKey !== inputKey)
          throw new Error("Operation ID already used with different inputs");
        action.status = "executed";
        action.result = prior.after_state;
        save();
        return respond({ result: action.result, simulated: true });
      }
      const current = await preview(review);
      if (current.digest !== action.digest)
        throw new Error("Approval context changed; preview and approve again");
      // Commit the copied domain state only after every validation and mutation succeeds.
      const next = structuredClone(s);
      let entityId: string, after: Record<string, unknown>;
      if (review.kind === "store_preview") {
        const result = applyStore(next, normalizeRadarStoreChange(review.input.change));
        entityId = result.entityId;
        after = result.after;
      } else {
        const id = crypto.randomUUID();
        entityId = review.input.opportunityId;
        next.assessments.unshift({
          id,
          opportunity_id: entityId,
          opportunity_revision: review.input.expectedRevision,
          assessment: review.input.assessment,
          source_snapshots: sourcesFor(next, entityId).map(({ id, revision, verification }) => ({
            id,
            revision,
            verification,
          })),
          created_at: now(),
        });
        after = { id, opportunityId: entityId };
      }
      next.history.unshift({
        id: crypto.randomUUID(),
        operation:
          review.kind === "store_preview" ? review.input.change.operation : "review_assessment",
        entity_id: entityId,
        operation_key: review.input.operationId,
        inputKey,
        actor_email: pack.tenant.founder.email,
        created_at: now(),
        after_state: after,
      });
      state.radar = next;
      action.status = "executed";
      action.result = { ...after, simulated: true };
      state.receipts.unshift({
        id: crypto.randomUUID(),
        operation: action.action_type,
        at: now(),
        simulated: true,
      });
      save();
      return respond({ result: action.result, simulated: true });
    }
    return respond({ error: "Unsupported Radar demo operation", simulated: true }, 404);
  } catch (error) {
    return respond(
      {
        error: error instanceof Error ? error.message : "Radar operation refused",
        simulated: true,
      },
      409,
    );
  }
}

function applyStore(
  s: DemoRadarState,
  c: RadarStoreChange,
): { entityId: string; after: Record<string, unknown> } {
  if (c.operation === "ingest_source") {
    const existing = s.sources.filter((v) => v.canonicalUrl === c.url);
    const value = { title: c.title, body_text: c.bodyText, published_at: c.publishedAt ?? null };
    const duplicate = existing.find((v) => sourceKey(v) === sourceKey(value));
    if (duplicate)
      return { entityId: duplicate.id, after: { id: duplicate.id, deduplicated: true } };
    const source = {
      ...value,
      id: crypto.randomUUID(),
      source_id: existing[0]?.source_id ?? crypto.randomUUID(),
      version: Math.max(0, ...existing.map((v) => v.version)) + 1,
      revision: 1,
      verification: "supplied" as const,
      canonicalUrl: c.url,
      contentKey: sourceKey(value),
    };
    s.sources.unshift(source);
    return { entityId: source.id, after: { id: source.id, revision: 1 } };
  }
  if (c.operation === "review_source") {
    const v = s.sources.find((v) => v.id === c.sourceVersionId)!;
    v.verification = c.verification;
    v.revision++;
    return {
      entityId: v.id,
      after: { id: v.id, revision: v.revision, verification: v.verification },
    };
  }
  if (c.operation === "create_opportunity") {
    const id = crypto.randomUUID();
    s.opportunities.unshift({
      id,
      title: c.title,
      summary: c.summary,
      recommended_action: c.recommendedAction,
      kind: c.kind,
      contact_id: c.contactId ?? null,
      company_id: c.companyId ?? null,
      state: "draft",
      revision: 1,
      evidence_revision: 1,
      updated_at: now(),
    });
    s.citations[id] = [
      {
        revision: 1,
        links: c.citations.map((v) => ({
          source_version_id: v.sourceVersionId,
          observation: v.observation,
          evidence_id: v.evidenceId ?? null,
        })),
      },
    ];
    return { entityId: id, after: { id, revision: 1 } };
  }
  const o = s.opportunities.find((o) => o.id === c.opportunityId)!;
  if (c.operation === "update_opportunity") {
    const p = c.patch;
    if (p.title !== undefined) o.title = p.title;
    if (p.summary !== undefined) o.summary = p.summary;
    if (p.recommendedAction !== undefined) o.recommended_action = p.recommendedAction;
    if (p.kind !== undefined) o.kind = p.kind;
    if (p.contactId !== undefined) o.contact_id = p.contactId;
    if (p.companyId !== undefined) o.company_id = p.companyId;
  } else if (c.operation === "transition_opportunity") o.state = c.state;
  else if (c.operation === "replace_citations") {
    o.evidence_revision = o.revision + 1;
    o.state = "needs_review";
    (s.citations[o.id] ??= []).push({
      revision: o.evidence_revision,
      links: c.citations.map((v) => ({
        source_version_id: v.sourceVersionId,
        observation: v.observation,
        evidence_id: v.evidenceId ?? null,
      })),
    });
  } else if (c.operation === "add_asset")
    s.assets.unshift({
      id: crypto.randomUUID(),
      opportunityId: o.id,
      kind: c.kind,
      title: c.title,
      author: c.author,
      body_text: c.bodyText,
      state: "draft",
      sourceVersionIds: c.sourceVersionIds,
    });
  else if (c.operation === "record_outcome")
    s.outcomes.unshift({
      id: crypto.randomUUID(),
      opportunityId: o.id,
      kind: c.kind,
      description: c.description,
      verification: "reported",
    });
  o.revision++;
  o.updated_at = now();
  return { entityId: o.id, after: { id: o.id, revision: o.revision, state: o.state } };
}
