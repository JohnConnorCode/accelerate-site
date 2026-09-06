#!/usr/bin/env tsx
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ingestPlaybookQualification,
  ingestRoofingQualification,
} from "../src/lib/revenue-os/inbound";

type Row = Record<string, unknown>;

function stubSupabase(initialTables: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = { ...initialTables };
  const inserted: Array<{ table: string; payload: Row }> = [];
  const updated: Array<{ table: string; payload: Row; match: Row }> = [];

  function query(table: string): Record<string, unknown> {
    const currentFilters: Array<(row: Row) => boolean> = [];
    let pendingInsert: Row | null = null;
    let pendingUpdate: Row | null = null;
    let orderAscending = true;
    let orderField: string | null = null;
    let limitCount = 50;

    const self: Record<string, unknown> = {};
    const chain = () => self;

    let isSingle = false;

    self.select = chain;
    self.eq = (field: string, val: unknown) => {
      currentFilters.push((r) => r[field] === val);
      return self;
    };
    self.neq = (field: string, val: unknown) => {
      currentFilters.push((r) => r[field] !== val);
      return self;
    };
    self.ilike = (field: string, pattern: string) => {
      const clean = pattern.replace(/%/g, "").toLowerCase();
      currentFilters.push((r) =>
        String(r[field] ?? "")
          .toLowerCase()
          .includes(clean),
      );
      return self;
    };
    self.like = self.ilike;
    self.in = (field: string, vals: unknown[]) => {
      currentFilters.push((r) => vals.includes(r[field]));
      return self;
    };
    self.contains = (field: string, val: unknown) => {
      currentFilters.push((r) => {
        const target = r[field];
        if (Array.isArray(target) && Array.isArray(val)) {
          return val.every((item) => target.includes(item));
        }
        return false;
      });
      return self;
    };
    self.not = chain;
    self.order = (field: string, opts?: { ascending?: boolean }) => {
      orderField = field;
      orderAscending = opts?.ascending ?? true;
      return self;
    };
    self.limit = (n: number) => {
      limitCount = n;
      return self;
    };
    self.maybeSingle = () => {
      isSingle = true;
      return self;
    };
    self.single = () => {
      isSingle = true;
      return self;
    };

    self.insert = (payload: Row) => {
      pendingInsert = payload;
      return self;
    };

    self.update = (payload: Row) => {
      pendingUpdate = payload;
      return self;
    };

    self.then = (resolve: (result: { data: unknown; error: unknown }) => unknown) => {
      tables[table] ??= [];

      if (pendingInsert) {
        const id = pendingInsert.id || `${table}-${tables[table]!.length + 1}`;
        const newRow = { id, created_at: new Date().toISOString(), ...pendingInsert };
        tables[table]!.push(newRow);
        inserted.push({ table, payload: newRow });
        return resolve({ data: newRow, error: null });
      }

      if (pendingUpdate) {
        const matchingRows = tables[table]!.filter((r) => currentFilters.every((f) => f(r)));
        for (const row of matchingRows) {
          Object.assign(row, pendingUpdate, { updated_at: new Date().toISOString() });
          updated.push({ table, payload: pendingUpdate, match: row });
        }
        return resolve({
          data: isSingle ? (matchingRows[0] ?? null) : matchingRows,
          error: null,
        });
      }

      let results = tables[table]!.filter((r) => currentFilters.every((f) => f(r)));
      if (orderField) {
        results = [...results].sort((a, b) => {
          const va = String(a[orderField!] ?? "");
          const vb = String(b[orderField!] ?? "");
          return orderAscending ? va.localeCompare(vb) : vb.localeCompare(va);
        });
      }
      const sliced = results.slice(0, limitCount);
      return resolve({
        data: isSingle ? (sliced[0] ?? null) : sliced,
        error: null,
      });
    };

    return self;
  }

  return {
    client: { from: (table: string) => query(table) } as unknown as SupabaseClient,
    tables,
    inserted,
    updated,
  };
}

async function runTests() {
  console.log("Starting Pluggable Playbook Inbound tests...");

  // 1. Roofing qualification produces identical canonical tags and tasks
  {
    const stub = stubSupabase();
    const result = await ingestRoofingQualification(stub.client, {
      email: "owner@apexroofing.com",
      companyWebsite: "https://apexroofing.com",
      role: "owner",
      revenueBand: "1m_3m",
      primaryLeak: "slow_response",
      qualifierToken: "tok_roof_123",
      qualification: { qualified: true, reason: "Valid roofing company with >$1M revenue" },
    });

    assert.equal(result.opportunity.stage, "qualified");
    assert.equal(result.existing, false);

    // Verify activity
    const activity = stub.tables.activities?.find(
      (a) => a.source === "roofing_qualifier" && a.activity_type === "form_submission",
    );
    assert.ok(activity, "Activity must be tagged with roofing_qualifier");
    assert.equal(activity?.title, "Qualified roofing audit request");

    // Verify task
    const task = stub.tables.tasks?.find((t) => t.source === "roofing_qualifier");
    assert.ok(task, "Task must be created for qualified inquiry");
    assert.ok(String(task?.title).includes("Respond to qualified roofing audit request"));

    // Verify audit
    const audit = stub.tables.audit_log?.find((a) => a.action === "inbound.roofing_qualified");
    assert.ok(audit, "Audit row must be recorded with inbound.roofing_qualified");
  }

  // 2. Custom industry playbook (e.g. legal) without code changes
  {
    const stub = stubSupabase();
    const result = await ingestPlaybookQualification(stub.client, {
      playbookKey: "legal",
      email: "partner@alderlaw.com",
      companyWebsite: "https://alderlaw.com",
      role: "partner",
      revenueBand: "3m_10m",
      primaryLeak: "estimate_followup",
      qualifierToken: "tok_legal_456",
      qualification: { qualified: true, reason: "Commercial law firm with active caseload" },
    });

    assert.equal(result.opportunity.stage, "qualified");
    const company = stub.tables.companies?.find((c) => c.id === result.identity.company.id);
    assert.equal(company?.industry, "legal");

    const activity = stub.tables.activities?.find(
      (a) => a.source === "legal_qualifier" && a.activity_type === "form_submission",
    );
    assert.ok(activity, "Activity must be tagged with legal_qualifier");
    assert.equal(activity?.title, "Qualified legal audit request");

    const task = stub.tables.tasks?.find((t) => t.source === "legal_qualifier");
    assert.ok(task, "Task must be created for legal qualifier");
    assert.ok(String(task?.title).includes("Respond to qualified legal audit request"));

    const audit = stub.tables.audit_log?.find((a) => a.action === "inbound.legal_qualified");
    assert.ok(audit, "Audit row must be recorded with inbound.legal_qualified");
  }

  // 3. Replay idempotency on existing inquiry
  {
    const stub = stubSupabase({
      opportunities: [
        {
          id: "opp-existing",
          email: "owner@apexroofing.com",
          stage: "qualified",
          qualifier_token: "tok_roof_123",
          contact_id: "cont-1",
          company_id: "comp-1",
        },
      ],
      contacts: [
        {
          id: "cont-1",
          primary_email: "owner@apexroofing.com",
          full_name: "Owner",
        },
      ],
      companies: [
        {
          id: "comp-1",
          domain: "apexroofing.com",
          name: "Apex Roofing",
        },
      ],
    });

    const result = await ingestRoofingQualification(stub.client, {
      email: "owner@apexroofing.com",
      companyWebsite: "https://apexroofing.com",
      role: "owner",
      revenueBand: "1m_3m",
      primaryLeak: "slow_response",
      qualifierToken: "tok_roof_123",
      qualification: { qualified: true, reason: "Re-submitted form" },
    });

    assert.equal(result.existing, true);
    assert.equal(result.opportunity.id, "opp-existing");
  }

  console.log("All 3 Pluggable Playbook tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
