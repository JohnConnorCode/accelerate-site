#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { captureFounderNote, FOUNDER_NOTE_MAX_LENGTH } from "../src/lib/revenue-os/notes";

type Row = Record<string, unknown>;

function stubSupabase() {
  const activities: Row[] = [];
  const audits: Row[] = [];
  const contact = { id: "11111111-1111-4111-8111-111111111111", full_name: "Casey Founder", primary_email: "casey@example.com", company_id: "22222222-2222-4222-8222-222222222222" };

  function query(table: string) {
    const filters = new Map<string, unknown>();
    let pending: Row | null = null;
    const self: Record<string, unknown> = {};
    self.select = () => self;
    self.eq = (key: string, value: unknown) => { filters.set(key, value); return self; };
    self.ilike = () => self;
    self.contains = () => self;
    self.limit = () => self;
    self.insert = (payload: Row) => {
      pending = payload;
      if (table === "audit_log") audits.push(payload);
      return self;
    };
    const resolve = () => {
      if (pending && table === "activities") {
        const stored = { id: `note-${activities.length + 1}`, occurred_at: pending.occurred_at, ...pending };
        activities.push(stored);
        return { data: stored, error: null };
      }
      if (pending) return { data: pending, error: null };
      if (table === "activities") {
        const match = activities.find((row) => row.source === filters.get("source") && row.external_id === filters.get("external_id"));
        return { data: match ?? null, error: null };
      }
      if (table === "contacts") {
        if (filters.get("id")) return { data: { id: contact.id, company_id: contact.company_id }, error: null };
        return { data: [contact], error: null };
      }
      return { data: null, error: null };
    };
    self.maybeSingle = () => Promise.resolve(resolve());
    self.single = () => Promise.resolve(resolve());
    self.then = (onFulfilled: (value: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled);
    return self;
  }

  return { client: { from: (table: string) => query(table) }, activities, audits, contact };
}

async function rejects(run: () => Promise<unknown>, includes: string) {
  let message = "";
  try { await run(); } catch (error) { message = error instanceof Error ? error.message : String(error); }
  assert.ok(message.toLowerCase().includes(includes.toLowerCase()), `expected rejection containing ${includes}, got ${message}`);
}

async function main() {
  const db = stubSupabase();
  const input = { requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", body: "Client said the reporting deadline is Friday.\nDo not promise Monday delivery.", actorEmail: "founder@example.com" };
  const first = await captureFounderNote(db.client as never, input);
  assert.equal(first.duplicate, false);
  assert.equal(first.title, "Client said the reporting deadline is Friday.");
  assert.equal(db.activities.length, 1, "one note must create one canonical activity receipt");
  assert.equal(db.audits.length, 1, "a material founder note must create one redacted audit entry");
  assert.ok(!JSON.stringify(db.audits[0]).includes("Do not promise Monday"), "the audit record must not duplicate note content");

  const replay = await captureFounderNote(db.client as never, input);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.id, first.id);
  assert.equal(db.activities.length, 1, "a replay must not create a second activity");
  assert.equal(db.audits.length, 1, "a replay must not create a second audit entry");

  const attached = await captureFounderNote(db.client as never, { requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", body: "Prefers a concise weekly summary.", actorEmail: "founder@example.com", contactEmail: "CASEY@example.com" });
  assert.equal(attached.contactId, db.contact.id);
  assert.equal(attached.companyId, db.contact.company_id, "contact attachment should carry its canonical company context");

  await rejects(() => captureFounderNote(db.client as never, { ...input, requestId: "blank", body: "   " }), "write something");
  await rejects(() => captureFounderNote(db.client as never, { ...input, requestId: "long", body: "x".repeat(FOUNDER_NOTE_MAX_LENGTH + 1) }), "limited");

  const route = readFileSync("src/app/api/admin/revenue-os/notes/route.ts", "utf8");
  assert.match(route, /requireAdmin\(\)/);
  assert.match(route, /captureFounderNote/);
  assert.match(route, /UUID\.test\(requestId\)/);

  const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
  assert.match(layout, /label: "Capture note"/);
  assert.match(layout, /admin:add-note/);

  console.log(JSON.stringify({ result: "passed", checks: ["canonical activity", "audit redaction", "idempotent replay", "exact contact attachment", "company context", "blank rejection", "length bound", "founder auth", "global command"] }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
