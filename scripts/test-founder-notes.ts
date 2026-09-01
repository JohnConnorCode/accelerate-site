#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  captureFounderNote,
  FOUNDER_NOTE_MAX_LENGTH,
  loadFounderKnowledgeNotes,
  loadFounderNoteAdoptionReport,
} from "../src/lib/revenue-os/notes";

type Row = Record<string, unknown>;

function stubSupabase() {
  const activities: Row[] = [];
  const audits: Row[] = [];
  const contact = {
    id: "11111111-1111-4111-8111-111111111111",
    full_name: "Casey Founder",
    primary_email: "casey@example.com",
    company_id: "22222222-2222-4222-8222-222222222222",
  };

  function query(table: string) {
    const filters = new Map<string, unknown>();
    let pending: Row | null = null;
    let listMode = false;
    let rowLimit = 100;
    const self: Record<string, unknown> = {};
    self.select = () => self;
    self.eq = (key: string, value: unknown) => {
      filters.set(key, value);
      return self;
    };
    self.ilike = () => self;
    self.contains = () => self;
    self.limit = (value: number) => {
      rowLimit = value;
      return self;
    };
    self.order = () => {
      listMode = true;
      return self;
    };
    self.lt = (key: string, value: unknown) => {
      filters.set(`lt:${key}`, value);
      return self;
    };
    self.insert = (payload: Row) => {
      pending = payload;
      if (table === "audit_log") audits.push(payload);
      return self;
    };
    const resolve = () => {
      if (pending && table === "activities") {
        const stored = {
          id: `note-${activities.length + 1}`,
          occurred_at: pending.occurred_at,
          ...pending,
        };
        activities.push(stored);
        return { data: stored, error: null };
      }
      if (pending) return { data: pending, error: null };
      if (table === "activities") {
        if (listMode) {
          const rows = activities
            .filter((row) =>
              [...filters.entries()].every(([key, value]) => {
                if (key.startsWith("lt:")) return String(row[key.slice(3)] ?? "") < String(value);
                return row[key] === value;
              }),
            )
            .slice(0, rowLimit);
          return { data: rows, error: null };
        }
        const match = activities.find(
          (row) =>
            row.source === filters.get("source") && row.external_id === filters.get("external_id"),
        );
        return { data: match ?? null, error: null };
      }
      if (table === "contacts") {
        if (filters.get("id"))
          return { data: { id: contact.id, company_id: contact.company_id }, error: null };
        return { data: [contact], error: null };
      }
      if (table === "audit_log") {
        const match = audits.find(
          (row) =>
            row.action === filters.get("action") &&
            row.entity_type === filters.get("entity_type") &&
            row.entity_id === filters.get("entity_id"),
        );
        return { data: match ? { id: match.id ?? "audit-1" } : null, error: null };
      }
      return { data: null, error: null };
    };
    self.maybeSingle = () => Promise.resolve(resolve());
    self.single = () => Promise.resolve(resolve());
    self.then = (onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled);
    return self;
  }

  return { client: { from: (table: string) => query(table) }, activities, audits, contact };
}

async function rejects(run: () => Promise<unknown>, includes: string) {
  let message = "";
  try {
    await run();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert.ok(
    message.toLowerCase().includes(includes.toLowerCase()),
    `expected rejection containing ${includes}, got ${message}`,
  );
}

async function main() {
  const db = stubSupabase();
  const input = {
    requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    body: "Client said the reporting deadline is Friday.\nDo not promise Monday delivery.",
    actorEmail: "founder@example.com",
    captureDurationMs: 4_200,
    captureSource: "keyboard_shortcut" as const,
  };
  const first = await captureFounderNote(db.client as never, input);
  assert.equal(first.duplicate, false);
  assert.equal(first.title, "Client said the reporting deadline is Friday.");
  assert.equal(first.captureDurationMs, 4_200);
  assert.equal(first.captureSource, "keyboard_shortcut");
  assert.equal(first.actorEmail, "founder@example.com");
  assert.equal(db.activities.length, 1, "one note must create one canonical activity receipt");
  assert.equal(db.audits.length, 1, "a material founder note must create one redacted audit entry");
  assert.ok(
    !JSON.stringify(db.audits[0]).includes("Do not promise Monday"),
    "the audit record must not duplicate note content",
  );

  const replay = await captureFounderNote(db.client as never, input);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.id, first.id);
  assert.equal(db.activities.length, 1, "a replay must not create a second activity");
  assert.equal(db.audits.length, 1, "a replay must not create a second audit entry");

  const repair = stubSupabase();
  repair.activities.push({ ...db.activities[0] });
  const repairedReplay = await captureFounderNote(repair.client as never, input);
  assert.equal(repairedReplay.duplicate, true);
  assert.equal(
    repair.audits.length,
    1,
    "retrying an activity whose audit failed must repair the missing redacted audit receipt",
  );

  const attached = await captureFounderNote(db.client as never, {
    requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    body: "Prefers a concise weekly summary.",
    actorEmail: "founder@example.com",
    contactEmail: "CASEY@example.com",
    captureDurationMs: 8_800,
    captureSource: "command_palette",
  });
  assert.equal(attached.contactId, db.contact.id);
  assert.equal(
    attached.companyId,
    db.contact.company_id,
    "contact attachment should carry its canonical company context",
  );

  const third = await captureFounderNote(db.client as never, {
    requestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    body: "Standalone operating constraint.",
    actorEmail: "founder@example.com",
    captureDurationMs: 9_500,
    captureSource: "command_palette",
  });
  assert.equal(third.contactId, null);

  const knowledge = await loadFounderKnowledgeNotes(db.client as never, { limit: 10 });
  assert.equal(
    knowledge.length,
    3,
    "the knowledge reader must include attached and standalone notes",
  );
  assert.equal(knowledge[0]?.author, "founder@example.com");
  assert.ok(
    knowledge.every((note) => note.occurredAt && note.sourceReceipt.startsWith("founder-note:")),
    "retrieval must preserve date and stable source receipt",
  );
  assert.ok(
    knowledge.some((note) => note.contactId === db.contact.id),
    "canonical attachments must survive retrieval",
  );

  const brokenKnowledge = stubSupabase();
  brokenKnowledge.activities.push({
    id: "broken",
    activity_type: "founder_note",
    source: "admin_note",
    external_id: "founder-note:broken",
    title: "Broken",
    summary: "Missing author",
    actor_email: null,
    occurred_at: "2026-08-30T12:00:00.000Z",
    metadata: {},
  });
  await rejects(
    () => loadFounderKnowledgeNotes(brokenKnowledge.client as never),
    "provenance is incomplete",
  );

  db.activities[0]!.occurred_at = "2026-08-21T12:00:00.000Z";
  db.activities[1]!.occurred_at = "2026-08-26T12:00:00.000Z";
  db.activities[2]!.occurred_at = "2026-08-30T12:00:00.000Z";
  const adoption = await loadFounderNoteAdoptionReport(db.client as never, {
    now: new Date("2026-08-31T12:00:00.000Z"),
  });
  assert.equal(
    adoption.speedEvidenceReady,
    true,
    "seven-day, three-day, sub-ten-second evidence should satisfy the mechanical speed gate",
  );
  assert.equal(
    adoption.cardReady,
    false,
    "mechanical telemetry must not pretend founder usefulness was confirmed",
  );
  assert.ok(adoption.reasons.includes("Founder usefulness confirmation is still required."));
  assert.equal(adoption.retrievableCount, 3);

  await rejects(
    () => captureFounderNote(db.client as never, { ...input, requestId: "blank", body: "   " }),
    "write something",
  );
  await rejects(
    () =>
      captureFounderNote(db.client as never, {
        ...input,
        requestId: "long",
        body: "x".repeat(FOUNDER_NOTE_MAX_LENGTH + 1),
      }),
    "limited",
  );
  await rejects(
    () =>
      captureFounderNote(db.client as never, {
        ...input,
        requestId: "duration",
        captureDurationMs: -1,
      }),
    "capture duration",
  );
  await rejects(
    () =>
      captureFounderNote(db.client as never, {
        ...input,
        requestId: "source",
        captureSource: "mystery" as never,
      }),
    "capture source",
  );

  const route = readFileSync("src/app/api/admin/revenue-os/notes/route.ts", "utf8");
  assert.match(route, /requireAdmin\(\)/);
  assert.match(route, /captureFounderNote/);
  assert.match(route, /loadFounderKnowledgeNotes/);
  assert.match(route, /UUID\.test\(requestId\)/);

  const shell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
  assert.match(shell, /label: "Capture note"/);
  assert.match(shell, /admin:add-note/);
  assert.match(
    shell,
    /event\.shiftKey[\s\S]{0,160}key\.toLowerCase\(\) === "m"/,
    "the global shell must retain the direct capture shortcut",
  );

  console.log(
    JSON.stringify(
      {
        result: "passed",
        checks: [
          "canonical activity",
          "audit redaction",
          "idempotent replay",
          "audit repair on retry",
          "capture telemetry",
          "bounded knowledge retrieval",
          "author and date provenance",
          "adoption gate honesty",
          "exact contact attachment",
          "company context",
          "blank rejection",
          "length bound",
          "founder auth",
          "global command",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
