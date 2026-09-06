/**
 * Pure Gmail thread normalization: RFC identity, participants, and direction.
 *
 * The Gmail API identifies messages by opaque provider ids (`message.id`),
 * but real thread linkage (RFC 5322 In-Reply-To / References) runs on RFC
 * Message-IDs from the message headers. Storing only provider ids means a
 * reply's threading headers name ids that never appeared on the wire, and
 * classifying direction against the single account address mislabels mail
 * sent from a Gmail alias ("Send As") as inbound. Both break the thread
 * contract this module exists to protect:
 *
 * - one Gmail message produces one canonical message across sync and reply
 *   paths (keyed by provider id, chained by RFC id);
 * - replies stay in the original thread with truthful RFC headers;
 * - chronology and direction stay correct across aliases.
 *
 * Everything here is pure and deterministic so the contract is unit-tested
 * without provider credentials (see scripts/test-gmail-threading.ts). The
 * service layer in ./google.ts owns fetching, storage, and receipts.
 */

export type GmailDirection = "inbound" | "outbound";

/** Extract every `<token>` RFC Message-ID from a raw header value. */
export function parseRfcMessageIds(headerValue: string | null | undefined): string[] {
  if (!headerValue) return [];
  const ids: string[] = [];
  for (const match of headerValue.matchAll(/<[^<>\s]+>/g)) {
    if (!ids.includes(match[0])) ids.push(match[0]);
  }
  return ids;
}

/**
 * The single RFC Message-ID of a message, or null when the header is absent
 * or malformed. Malformed ids are dropped rather than guessed: a missing
 * parent falls back to the provider-id form at the call site, which keeps
 * the Gmail threadId parameter as the authoritative thread anchor.
 */
export function parseRfcMessageId(headerValue: string | null | undefined): string | null {
  return parseRfcMessageIds(headerValue)[0] ?? null;
}

/**
 * All participant addresses from a raw From/To/Cc header value. Gmail
 * headers carry display names (`"Doe, Jane" <jane@example.com>`) and comma
 * separated lists; both are unwrapped and lowercased for comparison.
 */
export function parseAddressList(headerValue: string | null | undefined): string[] {
  if (!headerValue) return [];
  const addresses: string[] = [];
  const push = (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (normalized && /^[^\s@,;]+@[^\s@,;]+$/.test(normalized) && !addresses.includes(normalized))
      addresses.push(normalized);
  };
  for (const match of headerValue.matchAll(/<([^>]+)>/g)) push(match[1] ?? "");
  // Bare addresses outside angle brackets ("a@x.com, b@y.com", or mixed with
  // display-name forms). Quoted display names may themselves contain commas
  // and @-free text, so only bare tokens with exactly one @ qualify.
  const remainder = headerValue.replace(/"[^"]*"|<[^>]*>/g, " ");
  for (const part of remainder.split(",")) {
    const token = part.trim();
    if (token && (token.match(/@/g) ?? []).length === 1) push(token);
  }
  return addresses;
}

/**
 * Outbound when the sender is the account or one of its Send-As aliases.
 * Alias blindness used to file every alias-sent message as inbound, which
 * corrupted thread chronology, unread counts, and reply detection.
 */
export function resolveGmailDirection(
  fromEmail: string | null | undefined,
  ownerEmails: ReadonlySet<string> | null | undefined,
): GmailDirection {
  const from = fromEmail?.trim().toLowerCase();
  if (from && ownerEmails?.has(from)) return "outbound";
  return "inbound";
}

export interface GmailReplyParent {
  latestRfcId: string | null;
  rfcReferences: string[];
}

/**
 * Resolve the RFC parent for a reply. Prefers the parent's real RFC
 * Message-ID and the real References chain already stored on it; falls back
 * to the provider-id `<id>` form only when the RFC identity was never
 * retained, so old rows keep threading through the Gmail threadId anchor.
 */
export function resolveReplyParent(input: {
  latestExternalId: string | null | undefined;
  latestRfcId: string | null | undefined;
  latestReferencesHeader: string | null | undefined;
}): GmailReplyParent {
  const latestRfcId = input.latestRfcId?.trim() || null;
  const chain = parseRfcMessageIds(input.latestReferencesHeader);
  const rfcReferences = latestRfcId
    ? [...chain.filter((id) => id !== latestRfcId), latestRfcId]
    : chain;
  return { latestRfcId, rfcReferences };
}

/**
 * Build the References header value from a resolved RFC chain plus the
 * provider-id fallback for the latest message when no RFC id exists. The
 * fallback keeps one invariant the old builder had: References always names
 * the direct parent, even for legacy rows whose RFC identity was never
 * retained. When RFC ids exist, no provider token is added.
 */
export function buildRfcReferencesValue(
  parent: GmailReplyParent,
  latestExternalIdFallback: string | null | undefined,
): string | null {
  const refs = [...parent.rfcReferences];
  const token = latestExternalIdFallback?.trim().replace(/^<|>$/g, "");
  if (token && !parent.latestRfcId && !refs.includes(`<${token}>`)) refs.push(`<${token}>`);
  return refs.length ? refs.join(" ") : null;
}
