import assert from "node:assert/strict";
import {
  buildRfcReferencesValue,
  parseAddressList,
  parseRfcMessageId,
  parseRfcMessageIds,
  resolveGmailDirection,
  resolveReplyParent,
} from "../src/lib/revenue-os/gmail-threading";

// RFC Message-ID extraction: only real <token> ids survive.
assert.deepEqual(parseRfcMessageIds("<root@mail> <mid@mail>"), ["<root@mail>", "<mid@mail>"]);
assert.deepEqual(parseRfcMessageIds("<root@mail> <root@mail>"), ["<root@mail>"]);
assert.deepEqual(parseRfcMessageIds("gmail-opaque-id-123"), []);
assert.deepEqual(parseRfcMessageIds(null), []);
assert.equal(parseRfcMessageId("<only@mail> trailing"), "<only@mail>");
assert.equal(parseRfcMessageId("not-an-id"), null);

// Participant lists: display names, commas, bare addresses, deduped.
assert.deepEqual(parseAddressList('"Doe, Jane" <jane@example.com>, bob@example.com'), [
  "jane@example.com",
  "bob@example.com",
]);
assert.deepEqual(parseAddressList("solo@example.com"), ["solo@example.com"]);
assert.deepEqual(parseAddressList(null), []);

// Direction: the account AND its Send-As aliases are outbound.
const owners = new Set(["john@acceleratewith.us", "john@alsobuilds.com"]);
assert.equal(resolveGmailDirection("John@AccelerateWith.us", owners), "outbound");
assert.equal(resolveGmailDirection("john@alsobuilds.com", owners), "outbound");
assert.equal(
  resolveGmailDirection("john@alsobuilds.com", new Set(["john@acceleratewith.us"])),
  "inbound",
  "an unknown alias must not be trusted as self",
);
assert.equal(resolveGmailDirection("alex@example.com", owners), "inbound");
assert.equal(resolveGmailDirection(null, owners), "inbound");

// Reply parent: real RFC chain wins; provider id is only a fallback.
const parent = resolveReplyParent({
  latestExternalId: "gmail-abc",
  latestRfcId: "<mid@mail>",
  latestReferencesHeader: "<root@mail> <mid@mail>",
});
assert.equal(parent.latestRfcId, "<mid@mail>");
assert.deepEqual(parent.rfcReferences, ["<root@mail>", "<mid@mail>"]);

const legacy = resolveReplyParent({
  latestExternalId: "gmail-abc",
  latestRfcId: null,
  latestReferencesHeader: "<gmail-abc>",
});
assert.equal(legacy.latestRfcId, null);
assert.equal(buildRfcReferencesValue(legacy, "gmail-abc"), "<gmail-abc>");
assert.equal(
  buildRfcReferencesValue(parent, "gmail-abc"),
  "<root@mail> <mid@mail>",
  "the RFC chain must not gain a provider-id token when RFC ids exist",
);
assert.equal(buildRfcReferencesValue(legacy, null), "<gmail-abc>");

console.log(
  JSON.stringify(
    {
      result: "passed",
      checks: [
        "rfc-message-id-extraction",
        "participant-address-lists",
        "alias-aware-direction",
        "rfc-reply-parent-resolution",
        "provider-id-fallback-only",
      ],
    },
    null,
    2,
  ),
);
