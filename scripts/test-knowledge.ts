#!/usr/bin/env tsx
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  retrieveKnowledge,
  SECOND_BRAIN_KNOWLEDGE_CONTRACT,
  type KnowledgeSearchResult,
} from "../src/lib/revenue-os/knowledge";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";

type Row = Record<string, unknown>;

function stubSupabase(tables: Record<string, { data?: Row[]; error?: { message: string } }> = {}) {
  const inserted: Array<{ table: string; payload: Row }> = [];

  function query(table: string): Record<string, unknown> {
    let pending: Row | null = null;
    let limitCount = 50;
    const self: Record<string, unknown> = {};
    const chain = () => self;

    for (const method of [
      "select",
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "is",
      "in",
      "not",
      "or",
      "filter",
      "order",
      "range",
      "maybeSingle",
      "single",
    ]) {
      self[method] = chain;
    }

    self.limit = (n: number) => {
      limitCount = n;
      return self;
    };

    self.ilike = chain;

    self.insert = (payload: Row) => {
      pending = payload;
      inserted.push({ table, payload });
      return self;
    };

    self.then = (resolve: (result: { data: unknown; error: unknown }) => unknown) => {
      if (pending) return resolve({ data: { id: "queued-action-id", ...pending }, error: null });
      const fixture = tables[table] ?? {};
      const rawData = fixture.error ? null : (fixture.data ?? []);
      const sliced = Array.isArray(rawData) ? rawData.slice(0, limitCount) : rawData;
      return resolve({
        data: sliced,
        error: fixture.error ?? null,
      });
    };
    return self;
  }

  return { from: (table: string) => query(table), inserted } as unknown as SupabaseClient;
}

async function runTests() {
  console.log("Starting Second Brain Knowledge Substrate tests...");

  // 1. Refusal on empty query
  {
    const supabase = stubSupabase();
    const result = await retrieveKnowledge(supabase, {});
    assert.equal(result.contract, SECOND_BRAIN_KNOWLEDGE_CONTRACT);
    assert.equal(result.found, false);
    assert.equal(result.chunks.length, 0);
    assert.ok(result.refusalReason?.includes("No query parameters supplied"));
  }

  // 2. Refusal when nothing matches in database
  {
    const supabase = stubSupabase({
      companies: { data: [] },
      contacts: { data: [] },
      opportunities: { data: [] },
      activities: { data: [] },
    });
    const result = await retrieveKnowledge(supabase, { entityName: "Acme Corp" });
    assert.equal(result.found, false);
    assert.equal(result.chunks.length, 0);
    assert.ok(
      result.refusalReason?.includes(
        'No canonical records, founder notes, or activities found for "Acme Corp".',
      ),
    );
  }

  // 3. Grounded retrieval citing company, contact, opportunity, and founder notes with provenance
  {
    const supabase = stubSupabase({
      companies: {
        data: [
          {
            id: "comp-1",
            name: "Acme Corp",
            domain: "acme.com",
            industry: "B2B SaaS",
            size_band: "50-200",
            created_at: "2026-08-01T00:00:00.000Z",
          },
        ],
      },
      contacts: {
        data: [
          {
            id: "cont-1",
            full_name: "Jane Doe",
            primary_email: "jane@acme.com",
            title: "VP Engineering",
            created_at: "2026-08-01T00:00:00.000Z",
          },
        ],
      },
      opportunities: {
        data: [
          {
            id: "opp-1",
            name: "Acme Expansion",
            stage: "proposal",
            estimated_value: 50000,
            next_action: "Send proposal v2",
            created_at: "2026-08-01T00:00:00.000Z",
          },
        ],
      },
      activities: {
        data: [
          {
            id: "act-1",
            activity_type: "founder_note",
            title: "Pricing alignment note",
            summary: "Discussed $50k contract scope with Jane.",
            occurred_at: "2026-08-15T12:00:00.000Z",
            actor_email: "founder@acceleratewith.us",
            metadata: {
              body: "Discussed $50k contract scope with Jane.",
            },
          },
          {
            id: "act-2",
            activity_type: "email_sent",
            title: "Sent proposal draft",
            summary: "Proposal v1 sent to Jane.",
            occurred_at: "2026-08-16T12:00:00.000Z",
            actor_email: "founder@acceleratewith.us",
          },
        ],
      },
    });

    const result = await retrieveKnowledge(supabase, { entityName: "Acme Corp" });
    assert.equal(result.found, true);
    assert.equal(result.refusalReason, null);
    assert.equal(result.entitySummary?.name, "Acme Corp");
    assert.equal(result.entitySummary?.domain, "acme.com");
    assert.equal(result.entitySummary?.stage, "proposal");
    assert.equal(result.entitySummary?.estimatedValue, 50000);

    // Verify chunks have provenance
    assert.ok(result.chunks.length >= 3);
    const companyChunk = result.chunks.find((c) => c.entityType === "company");
    assert.ok(companyChunk);
    assert.equal(companyChunk?.source, "canonical_record");
    assert.equal(companyChunk?.confidence, 1.0);

    const noteChunk = result.chunks.find((c) => c.entityType === "note");
    assert.ok(noteChunk);
    assert.equal(noteChunk?.source, "founder_note");
    assert.equal(noteChunk?.confidence, 0.95);
    assert.equal(noteChunk?.occurredAt, "2026-08-15T12:00:00.000Z");
  }

  // 4. Contradiction / Discrepancy detection (prose vs canonical record)
  {
    const supabase = stubSupabase({
      companies: {
        data: [{ id: "comp-2", name: "Beta Corp" }],
      },
      opportunities: {
        data: [{ id: "opp-2", name: "Beta Deal", stage: "discovery", estimated_value: 20000 }],
      },
      activities: {
        data: [
          {
            id: "act-note-conflict",
            activity_type: "founder_note",
            title: "Verbal agreement",
            summary: "Client verbally committed, closed won!",
            occurred_at: "2026-08-20T10:00:00.000Z",
            actor_email: "founder@acceleratewith.us",
            metadata: {
              body: "Client verbally committed, closed won!",
            },
          },
        ],
      },
    });

    const result = await retrieveKnowledge(supabase, { entityName: "Beta Corp" });
    assert.equal(result.found, true);
    const noteChunk = result.chunks.find((c) => c.entityType === "note");
    assert.ok(noteChunk);
    assert.ok(noteChunk?.discrepancy?.includes("Canonical record governs"));
    assert.ok(noteChunk?.discrepancy?.includes("discovery"));
  }

  // 5. Execution through AI tool registry
  {
    const supabase = stubSupabase({
      companies: {
        data: [{ id: "comp-3", name: "Gamma Inc", domain: "gamma.io" }],
      },
    });

    const context = {
      supabase,
      actorEmail: "founder@acceleratewith.us",
      toolPack: "core" as const,
    };

    const { output, tool } = await executeRegisteredRevenueTool(context, "search_knowledge_base", {
      entityName: "Gamma Inc",
    });

    assert.equal(tool.impact, "read");
    assert.equal(tool.confirmationRequired, false);
    const searchResult = output as KnowledgeSearchResult;
    assert.equal(searchResult.contract, SECOND_BRAIN_KNOWLEDGE_CONTRACT);
    assert.equal(searchResult.found, true);
    assert.equal(searchResult.entitySummary?.name, "Gamma Inc");
  }

  console.log("All 5 Second Brain Knowledge tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
