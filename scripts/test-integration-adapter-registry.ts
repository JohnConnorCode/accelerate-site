/**
 * integration-adapter-registry-resolution moved the WhatsApp and HubSpot
 * configure blocks in src/app/api/admin/tenant/providers/route.ts from two
 * hand-written ~45-line duplicates into one shared cycle driven by
 * INTEGRATION_ADAPTERS and each adapter's declared credentialFields. This
 * proves that move is behavior-preserving without a live network call to
 * Meta or HubSpot: buildEncryptedCredentials and resolveAccountIdentifier
 * are the two pure steps the shared cycle depends on, and this exercises
 * both against the exact field shapes the two real adapters declare.
 *
 * What this does not cover: the live "credential verifies and stores" and
 * "invalid credential is refused before storage" proof against real
 * Postgres and the real Meta/HubSpot APIs, which needs sandbox credentials
 * for both providers and is not available in this environment. Run that
 * proof manually before this card is marked shipped.
 */
import assert from "node:assert/strict";
import {
  INTEGRATION_ADAPTERS,
  buildEncryptedCredentials,
  resolveAccountIdentifier,
  whatsAppAdapter,
  hubSpotAdapter,
} from "../src/lib/revenue-os/integration-adapters";

const fakeEncrypt = (value: string) => `enc(${value})`;

// The registry contains the reviewed adapters route.ts dispatches
// "configure_whatsapp" and "configure_hubspot" to, keyed by the same ids
// the action names derive from.
assert.equal(INTEGRATION_ADAPTERS.get("whatsapp"), whatsAppAdapter);
assert.equal(INTEGRATION_ADAPTERS.get("hubspot"), hubSpotAdapter);
assert.equal(INTEGRATION_ADAPTERS.size, 3);

// WhatsApp: accessToken -> api_key, phoneNumberId -> phone_number_id.
// This is the exact mapping the old hand-written block built.
assert.deepEqual(
  buildEncryptedCredentials(
    whatsAppAdapter,
    { accessToken: "token-abc", phoneNumberId: "12345" },
    fakeEncrypt,
  ),
  { api_key: "enc(token-abc)", phone_number_id: "enc(12345)" },
);

// HubSpot: accessToken -> api_key, webhookSecret -> webhook_secret.
assert.deepEqual(
  buildEncryptedCredentials(
    hubSpotAdapter,
    { accessToken: "token-xyz", webhookSecret: "whsec-1" },
    fakeEncrypt,
  ),
  { api_key: "enc(token-xyz)", webhook_secret: "enc(whsec-1)" },
);

// A declared field missing from the submitted credentials is skipped, not
// encrypted as "undefined" or thrown on, since credentialFields describes
// the adapter's full possible shape, not what any single request supplies.
assert.deepEqual(
  buildEncryptedCredentials(hubSpotAdapter, { accessToken: "token-only" }, fakeEncrypt),
  { api_key: "enc(token-only)" },
);

// Account identifier fallback: whatsAppAdapter's verify() only ever sets
// accountDetails.name; hubSpotAdapter's only ever sets .id. Both must
// resolve to what each provider's dedicated block used before this was
// made generic.
assert.equal(
  resolveAccountIdentifier({ accountDetails: { id: "unused-id", name: "Acme WhatsApp" } }),
  "Acme WhatsApp",
);
assert.equal(resolveAccountIdentifier({ accountDetails: { id: "portal-42" } }), "portal-42");
assert.equal(resolveAccountIdentifier({}), null);

console.log(JSON.stringify({ result: "passed", adapters: INTEGRATION_ADAPTERS.size }));
