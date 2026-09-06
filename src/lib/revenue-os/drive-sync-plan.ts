/**
 * Pure planning for bounded Google Drive folder synchronization.
 *
 * Drive sync must never traverse content outside the founder-approved folder
 * allowlist. Keeping that boundary here (no network, no database) means the
 * sync adapter and the settings write path share one deterministic rule, and
 * the rule itself is unit-testable without a Google connection:
 *
 * - folder IDs are trimmed, charset-validated, deduplicated, and capped;
 * - every stored file's Drive parents must intersect the allowlist
 *   (defense in depth: the Drive query is already folder-scoped, this proves
 *   the results stayed inside it);
 * - folders that still own stored documents but left the allowlist are
 *   reported explicitly, so removing a folder stops future reads while its
 *   prior provenance stays visible instead of silently orphaned.
 */

export const MAX_DRIVE_FOLDERS = 10;

/**
 * Drive folder/file IDs are opaque base64url-ish tokens. This accepts the
 * realistic shape (8-256 chars of letters, digits, dash, underscore) and
 * rejects anything that could smuggle query syntax, paths, or markup into a
 * Drive query or the Setup Center display.
 */
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{8,256}$/;

export interface RejectedDriveFolderId {
  value: string;
  reason: "not_a_string" | "blank" | "invalid_format" | "duplicate" | "over_limit";
}

export interface NormalizedDriveFolders {
  /** Validated, deduplicated, capped folder IDs in first-seen order. */
  ids: string[];
  /** Every input that did not survive, with the reason why. */
  rejected: RejectedDriveFolderId[];
}

function describeRejected(value: unknown): string {
  if (typeof value !== "string") return "(non-string value)";
  const trimmed = value.trim();
  if (!trimmed) return "(blank value)";
  return trimmed.length > 64 ? `${trimmed.slice(0, 64)}…` : trimmed;
}

export function normalizeDriveFolderIds(input: unknown): NormalizedDriveFolders {
  const rejected: RejectedDriveFolderId[] = [];
  if (!Array.isArray(input)) return { ids: [], rejected };
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const candidate of input) {
    if (typeof candidate !== "string") {
      rejected.push({ value: describeRejected(candidate), reason: "not_a_string" });
      continue;
    }
    const id = candidate.trim();
    if (!id) {
      rejected.push({ value: describeRejected(candidate), reason: "blank" });
      continue;
    }
    if (!DRIVE_ID_PATTERN.test(id)) {
      rejected.push({ value: describeRejected(candidate), reason: "invalid_format" });
      continue;
    }
    if (seen.has(id)) {
      rejected.push({ value: describeRejected(candidate), reason: "duplicate" });
      continue;
    }
    if (ids.length >= MAX_DRIVE_FOLDERS) {
      rejected.push({ value: describeRejected(candidate), reason: "over_limit" });
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return { ids, rejected };
}

/**
 * True when a synced file demonstrably lives inside the allowlist: at least
 * one of its Drive parent IDs is an allowlisted folder. Files Drive returns
 * outside the queried folders (shared-drive edges, API surprises) must not
 * be stored.
 */
export function isWithinAllowlist(parents: unknown, allowlist: readonly string[]): boolean {
  if (!Array.isArray(parents) || allowlist.length === 0) return false;
  const allowed = new Set(allowlist);
  return parents.some((parent) => typeof parent === "string" && allowed.has(parent));
}

/**
 * Stored folder IDs that are no longer allowlisted. Removing a folder stops
 * future reads; its already-synced documents stay, and this list is what the
 * sync summary and Setup Center surface so that provenance is explicit.
 */
export function staleAllowlistIds(
  storedFolderIds: readonly unknown[],
  allowlist: readonly string[],
): string[] {
  const allowed = new Set(allowlist);
  const stale: string[] = [];
  for (const folderId of storedFolderIds) {
    if (typeof folderId !== "string" || !folderId) continue;
    if (!allowed.has(folderId) && !stale.includes(folderId)) stale.push(folderId);
  }
  return stale;
}
