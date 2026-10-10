import { z } from "zod";
import {
  createSiteDraft,
  createSiteDraftSchema,
  discardSiteDraft,
  DraftNotFoundError,
  SlugInUseError,
} from "@/lib/site-studio/draft-operations";
import {
  reviseSiteDraft,
  reviseSiteDraftSchema,
  StaleDraftError,
} from "@/lib/site-studio/draft-revision";
import { siteDraftSchema, type SiteDraft } from "@/lib/site-studio/document";
import { servicePageTemplate } from "@/lib/site-studio/templates";
import type { SiteDraftRepository } from "@/lib/site-studio/store";

export interface DemoSiteDraftState {
  drafts: Record<string, SiteDraft>;
  receipts: Array<{
    id: string;
    operation: "create" | "revise" | "discard";
    draftId: string;
    at: string;
    simulated: true;
  }>;
}

export const createDemoSiteDraftState = (): DemoSiteDraftState => ({ drafts: {}, receipts: [] });
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ ...body, simulated: true }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Only this scenario's browser-session storage is reachable. Both runtimes
 * use the same domain rules; the demo generator deliberately calls no provider. */
export async function handleDemoSiteDrafts(
  state: DemoSiteDraftState,
  method: string,
  input: unknown,
  id?: string,
  ifMatch?: string | null,
): Promise<Response> {
  if (id !== undefined && !z.string().uuid().safeParse(id).success)
    return json({ error: "Draft not found" }, 404);
  const key = id?.toLowerCase();
  const repo: SiteDraftRepository = {
    list: () => structuredClone(Object.values(state.drafts)),
    get: (draftId) => structuredClone(state.drafts[draftId.toLowerCase()] ?? null),
    async save(value) {
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(value.document)),
      );
      // Recheck after hashing: simultaneous requests must not overwrite one another.
      const current = value.id ? state.drafts[value.id.toLowerCase()] : undefined;
      if (value.id && (!current || current.checksum !== value.expectedChecksum))
        throw new StaleDraftError();
      if (
        Object.values(state.drafts).some(
          (draft) => draft.slug === value.slug && draft.id !== current?.id,
        )
      )
        throw new SlugInUseError(value.slug);
      if (!current && Object.keys(state.drafts).length >= 200)
        throw new Error("This demo has 200 drafts. Discard a draft before creating another.");
      const now = new Date().toISOString();
      const draft = siteDraftSchema.parse({
        slug: value.slug,
        title: value.title,
        document: value.document,
        source: value.source,
        brief: value.brief,
        id: current?.id ?? crypto.randomUUID(),
        status: "draft",
        version: (current?.version ?? 0) + 1,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        checksum: Array.from(new Uint8Array(bytes), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join(""),
      });
      state.drafts[draft.id] = draft;
      return structuredClone(draft);
    },
    remove(draftId, expectedChecksum) {
      const current = state.drafts[draftId.toLowerCase()];
      if (!current) return false;
      if (current.checksum !== expectedChecksum) throw new StaleDraftError();
      delete state.drafts[current.id];
      return true;
    },
  };
  const record = (operation: "create" | "revise" | "discard", draftId: string) => {
    state.receipts.unshift({
      id: crypto.randomUUID(),
      operation,
      draftId,
      at: new Date().toISOString(),
      simulated: true,
    });
    state.receipts.length = Math.min(state.receipts.length, 200);
  };
  try {
    if (method === "GET") {
      if (!key) {
        const drafts = (await repo.list()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return json({
          drafts: drafts.map(({ id, slug, title, source, updatedAt, checksum }) => ({
            id,
            slug,
            title,
            source,
            updatedAt,
            checksum,
          })),
        });
      }
      const draft = await repo.get(key);
      return draft ? json({ draft }) : json({ error: "Draft not found" }, 404);
    }
    if (method === "POST" && !key) {
      const parsed = createSiteDraftSchema.safeParse(input);
      if (!parsed.success)
        return json({ error: "Check the page brief, model and selected images." }, 400);
      const draft = await createSiteDraft(repo, parsed.data, async (brief) =>
        servicePageTemplate(brief),
      );
      record("create", draft.id);
      return json({ draft }, 201);
    }
    if (method === "PATCH" && key) {
      const parsed = reviseSiteDraftSchema.safeParse(input);
      if (!parsed.success)
        return json({ error: "Check the draft changes and reload its latest copy." }, 400);
      const draft = await reviseSiteDraft(repo, key, parsed.data);
      record("revise", draft.id);
      return json({ draft });
    }
    if (method === "DELETE" && key) {
      if (!ifMatch || !/^[a-f0-9]{64}$/.test(ifMatch))
        return json({ error: "Reload the draft before discarding it." }, 428);
      const discarded = await discardSiteDraft(repo, key, ifMatch);
      record("discard", discarded.id);
      return json({ discarded });
    }
    return json({ error: "Method not supported" }, 405);
  } catch (error) {
    const status =
      error instanceof DraftNotFoundError
        ? 404
        : error instanceof StaleDraftError || error instanceof SlugInUseError
          ? 409
          : 422;
    return json(
      { error: error instanceof Error ? error.message : "Draft operation failed" },
      status,
    );
  }
}
