import assert from "node:assert/strict";
import {
  buildGmailReferencesHeader,
  buildGmailReplyRaw,
  buildGmailReplySubject,
  gmailMessageIdHeader,
  prepareGmailReply,
} from "../src/lib/revenue-os/gmail-reply-mime";

assert.equal(gmailMessageIdHeader("abc123"), "<abc123>");
assert.equal(gmailMessageIdHeader("<abc123>"), "<abc123>");
assert.equal(gmailMessageIdHeader("  "), null);

assert.equal(buildGmailReplySubject("Intake follow-up", null), "Re: Intake follow-up");
assert.equal(
  buildGmailReplySubject("Re: Intake follow-up", "Intake follow-up"),
  "Re: Intake follow-up",
);
assert.equal(buildGmailReplySubject(null, null), "Re: Your message");

assert.equal(buildGmailReferencesHeader("<root@mail>", "child123"), "<root@mail> <child123>");
assert.equal(
  buildGmailReferencesHeader("<child123> <root@mail>", "child123"),
  "<child123> <root@mail>",
  "the original message id must not be duplicated in References",
);

const prepared = prepareGmailReply({
  ownerEmail: "john@acceleratewith.us",
  recipient: "alex@example.com",
  conversationSubject: "Scope review",
  latest: { external_id: "msg-9", subject: "Scope review", references_header: "<root@mail>" },
  body: "Thanks — I can do Thursday.",
});
assert.equal(prepared.subject, "Re: Scope review");
assert.equal(prepared.inReplyTo, "<msg-9>");
assert.match(prepared.references ?? "", /<root@mail>/);
assert.match(prepared.references ?? "", /<msg-9>/);
assert.match(prepared.raw, /^In-Reply-To: <msg-9>$/m);
assert.match(prepared.raw, /^References: <root@mail> <msg-9>$/m);
assert.match(prepared.raw, /Thanks — I can do Thursday\./);
assert.equal(prepared.raw.includes("\r\n"), true, "Gmail raw MIME must use CRLF");

assert.throws(
  () =>
    prepareGmailReply({
      ownerEmail: "john@acceleratewith.us",
      recipient: "john@acceleratewith.us",
      conversationSubject: "Hi",
      latest: { external_id: "msg-9", subject: "Hi", references_header: null },
      body: "loop",
    }),
  /recipient/,
);
assert.throws(
  () =>
    prepareGmailReply({
      ownerEmail: "john@acceleratewith.us",
      recipient: "alex@example.com",
      conversationSubject: "Hi",
      latest: { external_id: null, subject: "Hi", references_header: null },
      body: "orphan",
    }),
  /original message id/,
);

const raw = buildGmailReplyRaw({
  from: "a@example.com",
  to: "b@example.com",
  subject: "Re: Hello",
  inReplyTo: "<id-1>",
  references: "<id-0> <id-1>",
  body: "Noted.",
});
assert.doesNotMatch(
  raw,
  /In-Reply-To: <id-1>\nReferences/,
  "headers must not collapse onto one LF-only line",
);

// A retained RFC parent produces real RFC threading headers: the reply
// names the actual Message-ID, never a provider id wrapped in <>.
const rfcPrepared = prepareGmailReply({
  ownerEmail: "john@acceleratewith.us",
  recipient: "alex@example.com",
  conversationSubject: "Scope review",
  latest: {
    external_id: "gmail-opaque-9",
    subject: "Scope review",
    references_header: "<root@mail> <mid-1@mail>",
    rfc_message_id: "<mid-1@mail>",
  },
  body: "Thanks — I can do Thursday.",
});
assert.equal(rfcPrepared.inReplyTo, "<mid-1@mail>");
assert.equal(rfcPrepared.references, "<root@mail> <mid-1@mail>");
assert.doesNotMatch(
  rfcPrepared.references ?? "",
  /gmail-opaque-9/,
  "no provider id may leak into References when RFC ids exist",
);
assert.match(rfcPrepared.raw, /^In-Reply-To: <mid-1@mail>$/m);

// Without a retained RFC id the legacy provider-id form is preserved so old
// rows keep threading through the Gmail threadId anchor.
const legacyPrepared = prepareGmailReply({
  ownerEmail: "john@acceleratewith.us",
  recipient: "alex@example.com",
  conversationSubject: "Scope review",
  latest: { external_id: "msg-9", subject: "Scope review", references_header: "<root@mail>" },
  body: "Thanks.",
});
assert.equal(legacyPrepared.inReplyTo, "<msg-9>");
assert.equal(legacyPrepared.references, "<root@mail> <msg-9>");

console.log(
  JSON.stringify(
    {
      result: "passed",
      checks: [
        "message-id",
        "subject",
        "references",
        "raw-headers",
        "recipient-guard",
        "missing-original-id",
        "rfc-parent-threading",
        "legacy-provider-fallback",
      ],
    },
    null,
    2,
  ),
);
