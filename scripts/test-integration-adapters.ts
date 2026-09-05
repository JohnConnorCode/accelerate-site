#!/usr/bin/env tsx
/**
 * Test Suite: Integration Adapters SDK (HubSpot & WhatsApp)
 *
 * Verifies:
 * 1. WhatsApp ingress message normalization and canonical capture
 * 2. WhatsApp payload validation and refusal on missing fields
 * 3. HubSpot contact import identity resolution and deduplication
 * 4. HubSpot deal import mapping to canonical opportunities
 * 5. Replay idempotency: re-running import skips existing records
 */
import assert from "node:assert/strict";
import {
  ingestWhatsAppMessage,
  importHubSpotBatch,
  type WhatsAppIncomingMessagePayload,
  type HubSpotRawContact,
  type HubSpotRawDeal,
} from "../src/lib/revenue-os/integration-adapters";
import { MemorySupabase } from "./lib/memory-supabase";

async function main() {
  console.log("Starting Integration Adapters tests...");
  const mem = new MemorySupabase({
    contacts: [],
    companies: [],
    opportunities: [],
    activities: [],
    inquiries: [],
  });
  const db = mem.client as unknown as Parameters<typeof ingestWhatsAppMessage>[0];

  // 1. WhatsApp Ingress Tests
  const validWhatsApp: WhatsAppIncomingMessagePayload = {
    messageId: "wamid.HBgLM...",
    fromPhoneNumber: "+1 (555) 234-5678",
    senderName: "Sarah Connor",
    body: "Hi, I need a proposal for an AI automation system.",
    timestamp: new Date().toISOString(),
  };

  const whatsappResult = await ingestWhatsAppMessage(db, validWhatsApp);
  assert.ok(whatsappResult.contact?.id, "WhatsApp ingress must resolve or create contact");

  // Refusal on invalid WhatsApp payload
  let refusedMissingField = false;
  try {
    await ingestWhatsAppMessage(db, {
      messageId: "",
      fromPhoneNumber: "",
      body: "",
      timestamp: "",
    });
  } catch (err) {
    refusedMissingField = true;
    const message = err instanceof Error ? err.message : String(err);
    assert.match(message, /requires messageId/i);
  }
  assert.ok(refusedMissingField, "WhatsApp ingress must reject payload missing required fields");

  // 2. HubSpot Import Tests
  const rawContacts: HubSpotRawContact[] = [
    {
      id: "hs-cont-1",
      properties: {
        email: "alex@northline.example",
        firstname: "Alex",
        lastname: "Vance",
        phone: "+1 555-432-1098",
        company: "Northline Roofing",
      },
    },
    {
      id: "hs-cont-2",
      properties: {
        email: "elena@alderlaw.example",
        firstname: "Elena",
        lastname: "Reyes",
      },
    },
    {
      id: "hs-cont-bad",
      properties: {
        firstname: "No Contact Info",
      },
    },
  ];

  const rawDeals: HubSpotRawDeal[] = [
    {
      id: "hs-deal-1",
      properties: {
        dealname: "Commercial Roof Dispatch AI",
        amount: "15000",
        dealstage: "appointmentscheduled",
      },
      associatedContactIds: ["hs-cont-1"],
    },
    {
      id: "hs-deal-2",
      properties: {
        dealname: "Law Practice Intake Automation",
        amount: 8500,
      },
      associatedContactIds: ["hs-cont-2"],
    },
  ];

  const summary = await importHubSpotBatch(
    db,
    { contacts: rawContacts, deals: rawDeals },
    "system@test.invalid",
  );

  assert.equal(summary.contactsTotal, 3);
  assert.equal(summary.contactsImported, 2);
  assert.equal(summary.contactsSkipped, 1);
  assert.equal(summary.dealsTotal, 2);
  assert.equal(summary.dealsImported, 2);
  assert.equal(summary.dealsSkipped, 0);

  // The real bug this once shipped with: opportunities has no title/value/
  // source_id/status columns, and "inquiry" is not a permitted stage. A fake
  // that accepts arbitrary column names hides that entirely unless the
  // written row is actually inspected against the real column names.
  const { data: writtenDeal } = await db
    .from("opportunities")
    .select("name,estimated_value,stage,contact_id,source,source_detail")
    .eq("source_detail", "hubspot:hs-deal-1")
    .maybeSingle();
  assert.ok(writtenDeal, "the imported deal must be readable back by source_detail");
  assert.equal(writtenDeal.name, "Commercial Roof Dispatch AI");
  assert.equal(writtenDeal.estimated_value, 15000);
  assert.equal(
    writtenDeal.stage,
    "new",
    "must use a stage opportunities_stage_check actually permits",
  );
  assert.ok(writtenDeal.contact_id, "the deal must link to its resolved contact");
  assert.equal(writtenDeal.source, "hubspot_import");

  // 3. Idempotency on second import run
  const replaySummary = await importHubSpotBatch(
    db,
    { contacts: rawContacts, deals: rawDeals },
    "system@test.invalid",
  );
  assert.equal(replaySummary.dealsSkipped, 2, "Existing deals must be skipped on rerun");

  console.log("All Integration Adapters tests passed successfully!");
}

main().catch((err) => {
  console.error("Integration Adapters tests failed:", err);
  process.exit(1);
});
