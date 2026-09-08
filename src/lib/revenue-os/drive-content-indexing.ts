import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { tenantIdForDatabase } from "../supabase/server";

/**
 * drive-content-indexing: turns a Google Drive folder listing into searchable
 * document text with explicit states and duplicate detection.
 *
 * Pure decision layer (no HTTP): callers supply the provider rows and a
 * per-file text extractor, and this module decides what to store so the same
 * rules apply regardless of which provider/entrypoint drives the sync.
 *
 *   - Supported mime types are extracted to searchable text (AC1).
 *   - Unchanged content (same hash) is not re-extracted (AC2).
 *   - Files missing from the listing become `deleted`; extraction failures
 *     become `inaccessible` (AC2).
 *   - Identical content across distinct files records a duplicate reference
 *     on each row instead of erasing either source (AC3).
 */

export type DriveIndexStatus = "indexed" | "unsupported" | "deleted" | "inaccessible" | "pending";

export const SUPPORTED_DRIVE_MIME_TYPES = [
  // Google-native document formats that export to plain text.
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.slides",
  // Plain text / markdown / CSV / JSON are directly searchable.
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
] as const;

export function isSupportedDriveMimeType(mimeType: string | null | undefined): boolean {
  return (
    typeof mimeType === "string" &&
    (SUPPORTED_DRIVE_MIME_TYPES as readonly string[]).includes(mimeType)
  );
}

/** Deterministic content hash used for unchanged-skip and duplicate detection. */
export function driveContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export interface DriveDocumentRow {
  provider: string;
  external_id: string;
  name: string;
  mime_type: string | null;
  web_view_link: string | null;
  modified_at: string | null;
  folder_id: string;
  content_hash: string | null;
  /** Provider revision/checksum. Distinct from the extracted text hash. */
  provider_revision?: string | null;
  indexed_status?: DriveIndexStatus | null;
  metadata?: Record<string, unknown>;
}

export type DriveTextExtractor = (row: DriveDocumentRow) => Promise<string | null>;

export interface DriveIndexSummary {
  listed: number;
  indexed: number;
  unchanged: number;
  unsupported: number;
  deleted: number;
  inaccessible: number;
  duplicates: number;
  failed: number;
  errors: string[];
}

export async function emptyDriveIndexSummary(): Promise<DriveIndexSummary> {
  return {
    listed: 0,
    indexed: 0,
    unchanged: 0,
    unsupported: 0,
    deleted: 0,
    inaccessible: 0,
    duplicates: 0,
    failed: 0,
    errors: [],
  };
}

/**
 * Decide what to store for a folder listing. `extract` is the provider-bound
 * text fetch (Drive export or media read); returning null marks the file
 * inaccessible. `listedIds` is the set of external ids present in the folder
 * this run; rows for that folder absent from it are marked deleted.
 */
export async function indexDriveFolder(
  supabase: SupabaseClient,
  input: {
    folderId: string;
    rows: DriveDocumentRow[];
    listedIds: Set<string>;
    /** True only after every page succeeded without incompleteSearch. */
    listingComplete?: boolean;
    extract: DriveTextExtractor;
  },
): Promise<DriveIndexSummary> {
  if (!tenantIdForDatabase(supabase))
    throw new Error("Drive indexing requires a tenant-bound database");
  const { folderId, rows, listedIds, extract } = input;
  if (
    rows.some(
      (row) =>
        row.provider !== "google" || row.folder_id !== folderId || !listedIds.has(row.external_id),
    )
  )
    throw new Error("Drive listing escaped its folder or provider scope");
  const summary = await emptyDriveIndexSummary();
  summary.listed = rows.length;

  // Load what we already know for this folder so unchanged content is skipped
  // and files that vanished are marked deleted, never silently dropped.
  const { data: prior, error: priorError } = await supabase
    .from("drive_documents")
    .select("external_id,content_hash,indexed_status,provider_revision,extracted_text,metadata")
    .eq("provider", "google")
    .eq("folder_id", folderId);
  if (priorError) throw new Error(`Could not load prior Drive index: ${priorError.message}`);
  const priorByExternal = new Map(
    ((prior as Array<Record<string, unknown>>) ?? []).map((row) => [String(row.external_id), row]),
  );

  // Track content hashes we have already stored so exact duplicates across
  // distinct files are marked without removing either source.
  const seenHashes = new Map<string, string>();
  // Include unchanged files in this complete listing, but never a vanished source.
  for (const row of rows) {
    const previous = priorByExternal.get(row.external_id);
    if (
      previous?.indexed_status === "indexed" &&
      row.provider_revision &&
      row.provider_revision === previous.provider_revision &&
      typeof previous.content_hash === "string"
    )
      seenHashes.set(previous.content_hash, row.external_id);
  }

  for (const row of rows) {
    const priorRow = priorByExternal.get(row.external_id);

    if (!isSupportedDriveMimeType(row.mime_type)) {
      await upsertDriveDocument(supabase, row, null, "unsupported");
      summary.unsupported++;
      continue;
    }

    // Unchanged content: the prior sync already extracted this exact text.
    if (
      row.metadata?.canDownload !== false &&
      row.provider_revision &&
      priorRow?.provider_revision === row.provider_revision &&
      priorRow.indexed_status === "indexed" &&
      typeof priorRow.extracted_text === "string"
    ) {
      await upsertDriveDocument(supabase, row, priorRow.extracted_text, "indexed");
      summary.unchanged++;
      continue;
    }

    let text: string | null = null;
    try {
      text = row.metadata?.canDownload === false ? null : await extract(row);
    } catch (error) {
      summary.failed++;
      summary.errors.push(
        `${row.external_id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (text === null || !text.trim()) {
      await upsertDriveDocument(supabase, row, null, "inaccessible");
      summary.inaccessible++;
      continue;
    }

    const hash = driveContentHash(text);
    const candidate = seenHashes.get(hash);
    const duplicateOf = candidate && candidate !== row.external_id ? candidate : null;
    if (duplicateOf === null) seenHashes.set(hash, row.external_id);
    else summary.duplicates++;
    await upsertDriveDocument(supabase, row, text, "indexed", duplicateOf);
    summary.indexed++;
  }

  // Explicit deletion state: previously indexed files no longer in the folder.
  for (const [externalId, priorRow] of priorByExternal) {
    if (!input.listingComplete || listedIds.has(externalId)) continue;
    if (priorRow?.indexed_status === "deleted") continue;
    const { error } = await supabase
      .from("drive_documents")
      .update({
        indexed_status: "deleted",
        extracted_text: null,
        content_duplicate_of: null,
        synced_at: new Date().toISOString(),
      })
      .eq("provider", "google")
      .eq("folder_id", folderId)
      .eq("external_id", externalId);
    if (error) throw new Error(`Could not retire Drive document: ${error.message}`);
    summary.deleted++;
  }

  return summary;
}

async function upsertDriveDocument(
  supabase: SupabaseClient,
  row: DriveDocumentRow,
  text: string | null,
  status: DriveIndexStatus,
  duplicateOf: string | null = null,
): Promise<void> {
  const { error } = await supabase.from("drive_documents").upsert(
    {
      provider: row.provider,
      external_id: row.external_id,
      name: row.name,
      mime_type: row.mime_type,
      web_view_link: row.web_view_link,
      modified_at: row.modified_at,
      folder_id: row.folder_id,
      extracted_text: text,
      content_hash: text ? driveContentHash(text) : null,
      provider_revision: row.provider_revision ?? null,
      indexed_status: status,
      content_duplicate_of: duplicateOf,
      metadata: row.metadata ?? {},
      synced_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,provider,external_id" },
  );
  if (error) throw new Error(`Could not store Drive document: ${error.message}`);
}
