import { buildRfcReferencesValue, resolveReplyParent } from "./gmail-threading";

/** RFC 5322 Message-ID token. Stored Gmail ids are not always wrapped in <>. */
export function gmailMessageIdHeader(externalId: string | null | undefined): string | null {
  const id = externalId?.trim().replace(/^<|>$/g, "");
  return id ? `<${id}>` : null;
}


export function buildGmailReplySubject(
  conversationSubject: string | null | undefined,
  latestSubject: string | null | undefined,
): string {
  const subject = (conversationSubject || latestSubject || "Your message").trim() || "Your message";
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

export function buildGmailReferencesHeader(
  previous: string | null | undefined,
  latestExternalId: string | null | undefined,
): string | null {
  const latest = gmailMessageIdHeader(latestExternalId);
  const tokens = `${previous ?? ""} ${latest ?? ""}`.split(/\s+/).filter(Boolean);
  const unique: string[] = [];
  for (const token of tokens) {
    const normalized = gmailMessageIdHeader(token.replace(/^<|>$/g, "")) ?? token;
    if (!unique.includes(normalized)) unique.push(normalized);
  }
  return unique.length ? unique.join(" ") : null;
}

export function buildGmailReplyRaw(input: {
  from: string;
  to: string;
  subject: string;
  inReplyTo: string | null;
  references: string | null;
  body: string;
}): string {
  return [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : null,
    input.references ? `References: ${input.references}` : null,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.body,
  ]
    .filter((line): line is string => line !== null)
    .join("\r\n");
}

export function prepareGmailReply(input: {
  ownerEmail: string;
  recipient: string;
  conversationSubject: string | null | undefined;
  latest: {
    external_id: string | null;
    subject: string | null;
    references_header: string | null;
    /** The parent's real RFC Message-ID when retained; without it the reply
     * falls back to the provider-id form so old rows keep threading through
     * the Gmail threadId anchor. */
    rfc_message_id?: string | null;
  };
  body: string;
}) {
  const body = input.body.trim();
  if (!body) throw new Error("Reply body is required");
  if (!input.ownerEmail || !input.recipient || input.recipient === input.ownerEmail) {
    throw new Error("Could not identify the Gmail reply recipient");
  }
  if (!input.latest.external_id) {
    throw new Error("Gmail replies require the original message id so the thread stays intact");
  }
  const subject = buildGmailReplySubject(input.conversationSubject, input.latest.subject);
  const parent = resolveReplyParent({
    latestExternalId: input.latest.external_id,
    latestRfcId: input.latest.rfc_message_id ?? null,
    latestReferencesHeader: input.latest.references_header,
  });
  const inReplyTo = parent.latestRfcId ?? gmailMessageIdHeader(input.latest.external_id);
  const references = buildRfcReferencesValue(parent, input.latest.external_id);
  return {
    subject,
    inReplyTo,
    references,
    recipient: input.recipient,
    raw: buildGmailReplyRaw({
      from: input.ownerEmail,
      to: input.recipient,
      subject,
      inReplyTo,
      references,
      body,
    }),
  };
}
