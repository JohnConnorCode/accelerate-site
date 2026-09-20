import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGoogleAccessToken } from "./google";
import type { KnowledgeChunk } from "./knowledge";

interface SearchRow {
  id: string;
  kind: "upload" | "drive" | "conversation";
  title: string;
  content: string;
  revision: string;
  occurredAt: string;
  author: string | null;
  url: string | null;
  externalId: string | null;
  folderId: string | null;
  providerRevision: string | null;
}
/** Full-text search is the credential-free baseline. Drive candidates are
 * revalidated against live provider permissions and revision before disclosure. */
export async function searchDocumentKnowledge(db: SupabaseClient, query: string, limit: number) {
  const { data, error } = await db.rpc("search_document_knowledge", {
    p_query: query,
    p_limit: limit,
  });
  if (error)
    throw new Error(
      "Document knowledge search is unavailable; check the knowledge migration and connection",
    );
  const rows = (data ?? []) as SearchRow[];
  const missing: string[] = [];
  const permitted = new Set<string>();
  const drive = rows.filter((row) => row.kind === "drive").slice(0, 5);
  if (rows.filter((row) => row.kind === "drive").length > 5)
    missing.push("Drive verification was limited to five documents for this search.");
  if (drive.length) {
    try {
      const { token, connection } = await getGoogleAccessToken(db);
      const folders =
        (connection.settings as { drive_folder_ids?: string[] } | null)?.drive_folder_ids ?? [];
      await Promise.all(
        drive.map(async (row) => {
          if (!row.externalId || !row.folderId || !folders.includes(row.folderId)) return;
          try {
            const response = await fetch(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.externalId)}?fields=id,version,trashed,parents,capabilities(canDownload)`,
              {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(5000),
              },
            );
            if (!response.ok) return;
            const current = (await response.json()) as {
              version?: string;
              trashed?: boolean;
              parents?: string[];
              capabilities?: { canDownload?: boolean };
            };
            if (
              !current.trashed &&
              current.capabilities?.canDownload === true &&
              current.parents?.includes(row.folderId) &&
              current.version &&
              current.version === row.providerRevision
            )
              permitted.add(row.id);
          } catch {
            /* Omit unavailable evidence; never use the stored text as fallback. */
          }
        }),
      );
    } catch {
      missing.push("Google Workspace access could not be verified.");
    }
    if (permitted.size < drive.length)
      missing.push(
        "Some Drive results were withheld because access or the indexed revision could not be verified. Sync Drive and search again.",
      );
  }
  const chunks: KnowledgeChunk[] = rows
    .filter((row) => row.kind !== "drive" || permitted.has(row.id))
    .map((row) => ({
      id: row.id,
      source: row.kind === "conversation" ? "conversation" : "document",
      entityType: row.kind === "conversation" ? "conversation" : "document",
      entityId: row.id,
      title: row.title,
      content: row.content,
      occurredAt: row.occurredAt,
      confidence: 0.8,
      author: row.author,
      revision: row.revision,
      sourceLocation: row.url ?? `${row.kind}:${row.id}`,
      authority: "working",
    }));
  return { chunks, missing };
}
