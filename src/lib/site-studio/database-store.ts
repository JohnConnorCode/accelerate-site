import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { callSiteDraftRpc, tenantIdForDatabase } from "../supabase/server";
import { siteDraftSchema, type SiteDraft } from "./document";
import { draftChecksum, type SiteDraftInput, type SiteDraftRepository } from "./store";
import { SlugInUseError } from "./drafts";
import { StaleDraftError } from "./revision";

/** Production adapter: private tenant records, stable identity and atomic revisions. */
export class DatabaseSiteDraftRepository implements SiteDraftRepository {
  constructor(
    private database: SupabaseClient,
    private actorEmail: string,
  ) {
    if (!tenantIdForDatabase(database))
      throw new Error("Site Studio requires a tenant-bound database");
    if (!actorEmail.trim()) throw new Error("Site Studio requires an actor");
  }
  private async assertEnabled() {
    const { data, error } = await this.database
      .from("tenants")
      .select("status,config")
      .eq("id", tenantIdForDatabase(this.database)!)
      .maybeSingle();
    if (error || data?.status !== "active" || data.config?.modules?.["site-studio"] !== true)
      throw new Error("Site Studio is disabled or unavailable for this workspace");
  }
  async list(): Promise<SiteDraft[]> {
    await this.assertEnabled();
    const { data, error } = await this.database
      .from("site_drafts")
      .select("draft")
      .eq("tenant_id", tenantIdForDatabase(this.database)!)
      .is("discarded_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Drafts unavailable: ${error.message}`);
    return (data ?? []).map((row) => siteDraftSchema.parse(row.draft));
  }
  async get(id: string): Promise<SiteDraft | null> {
    await this.assertEnabled();
    if (!siteDraftSchema.shape.id.safeParse(id).success) return null;
    const { data, error } = await this.database
      .from("site_drafts")
      .select("draft")
      .eq("tenant_id", tenantIdForDatabase(this.database)!)
      .eq("id", id)
      .is("discarded_at", null)
      .maybeSingle();
    if (error) throw new Error(`Draft unavailable: ${error.message}`);
    return data ? siteDraftSchema.parse(data.draft) : null;
  }
  async save(input: SiteDraftInput): Promise<SiteDraft> {
    await this.assertEnabled();
    const now = new Date().toISOString();
    const fields = {
      title: input.title,
      slug: input.slug,
      document: input.document,
      source: input.source,
      brief: input.brief,
    };
    const draft = siteDraftSchema.parse({
      ...fields,
      id: input.id ?? randomUUID(),
      status: "draft",
      version: 1,
      createdAt: now,
      updatedAt: now,
      checksum: draftChecksum(input.document),
    });
    // Transport fields are distinct from the document envelope.
    const { data, error } = await callSiteDraftRpc(this.database, {
      p_operation: input.id ? "revise" : "create",
      p_id: draft.id,
      p_expected_checksum: input.expectedChecksum ?? null,
      p_draft: draft,
      p_actor_email: this.actorEmail,
    });
    if (error) this.refuse(error, draft.slug);
    return siteDraftSchema.parse(data);
  }
  async remove(id: string, expectedChecksum?: string): Promise<boolean> {
    if (!expectedChecksum) throw new StaleDraftError();
    const { data, error } = await callSiteDraftRpc(this.database, {
      p_operation: "discard",
      p_id: id,
      p_expected_checksum: expectedChecksum,
      p_draft: null,
      p_actor_email: this.actorEmail,
    });
    if (error) this.refuse(error, "");
    return data === true;
  }
  private refuse(error: { code?: string; message: string }, slug: string): never {
    if (error.code === "23505") throw new SlugInUseError(slug);
    if (/stale|unavailable/i.test(error.message)) throw new StaleDraftError();
    throw new Error(`Draft write failed: ${error.message}`);
  }
}
export function siteDrafts(
  database: SupabaseClient,
  actorEmail: string,
): DatabaseSiteDraftRepository {
  return new DatabaseSiteDraftRepository(database, actorEmail);
}
