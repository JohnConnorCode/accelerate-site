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
assert.equal(buildGmailReplySubject("Re: Intake follow-up", "Intake follow-up"), "Re: Intake follow-up");
assert.equal(buildGmailReplySubject(null, null), "Re: Your message");

assert.equal(
  buildGmailReferencesHeader("<root@mail>", "child123"),
  "<root@mail> <child123>",
);
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
  () => prepareGmailReply({
    ownerEmail: "john@acceleratewith.us",
    recipient: "john@acceleratewith.us",
    conversationSubject: "Hi",
    latest: { external_id: "msg-9", subject: "Hi", references_header: null },
    body: "loop",
  }),
  /recipient/,
);
assert.throws(
  () => prepareGmailReply({
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
assert.doesNotMatch(raw, /In-Reply-To: <id-1>\nReferences/, "headers must not collapse onto one LF-only line");

console.log(JSON.stringify({ result: "passed", checks: ["message-id", "subject", "references", "raw-headers", "recipient-guard", "missing-original-id"] }, null, 2));
