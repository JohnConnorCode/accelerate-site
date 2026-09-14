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
      drive_documents: {
        data: [
          {
            id: "drive-1",
            name: "Acme Contract v2.pdf",
            extracted_text: "This contract outlines the terms for the Acme Expansion deal worth $50,000. The agreement includes deliverables, timeline, and payment terms.",
            content_hash: "abc123def456",
            web_view_link: "https://drive.google.com/file/d/drive-1/view",
            modified_at: "2026-08-14T10:00:00.000Z",
            metadata: { owner: "founder@acceleratewith.us" },
          },
          {
            id: "drive-2",
            name: "Old Acme Proposal v1.pdf",
            extracted_text: "Previous version of the Acme proposal with different pricing. This document is outdated.",
            content_hash: "old789hash",
            web_view_link: "https://drive.google.com/file/d/drive-2/view",
            modified_at: "2026-05-01T10:00:00.000Z", // stale (>90 days)
            metadata: { owner: "founder@acceleratewith.us" },
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

    // Verify Drive document chunks
    const driveChunks = result.chunks.filter((c) => c.entityType === "drive_document");
    assert.ok(driveChunks.length >= 1);
    const driveChunk = driveChunks[0];
    assert.equal(driveChunk?.source, "drive_document");
    assert.ok(driveChunk?.documentId);
    assert.ok(driveChunk?.documentName);
    assert.ok(driveChunk?.documentLink);
    assert.ok(driveChunk?.contentHash);
    assert.ok(driveChunk?.relevantExcerpt);
    assert.ok(typeof driveChunk?.isStale === "boolean");

    // Verify staleness detection
    const staleChunk = driveChunks.find((c) => c.isStale);
    assert.ok(staleChunk, "Should have at least one stale document");
    const freshChunk = driveChunks.find((c) => !c.isStale);
    assert.ok(freshChunk, "Should have at least one fresh document");
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

  // 6. SD1: Evaluation fixtures for keyword + semantic retrieval and entity/source ranking
  {
    const supabase = stubSupabase({
      companies: {
        data: [{ id: "comp-eval", name: "Eval Corp", domain: "eval.com" }],
      },
      opportunities: {
        data: [{ id: "opp-eval", name: "Eval Deal", stage: "discovery", estimated_value: 10000 }],
      },
      drive_documents: {
        data: [
          {
            id: "drive-eval-1",
            name: "Eval Corp Proposal.pdf",
            extracted_text: "Eval Corp proposal with detailed pricing and terms. This is a current document.",
            content_hash: "evalhash1",
            web_view_link: "https://drive.google.com/file/d/drive-eval-1/view",
            modified_at: "2026-08-20T10:00:00.000Z",
            metadata: { owner: "founder@acceleratewith.us" },
          },
          {
            id: "drive-eval-2",
            name: "Eval Corp Old Notes.txt",
            extracted_text: "Old notes about Eval Corp from last year. May contain outdated information.",
            content_hash: "evalhash2",
            web_view_link: "https://drive.google.com/file/d/drive-eval-2/view",
            modified_at: "2026-01-15T10:00:00.000Z", // stale
            metadata: { owner: "founder@acceleratewith.us" },
          },
          {
            id: "drive-eval-3",
            name: "Unrelated Document.pdf",
            extracted_text: "This document is about a completely different topic and should not match.",
            content_hash: "evalhash3",
            web_view_link: "https://drive.google.com/file/d/drive-eval-3/view",
            modified_at: "2026-08-20T10:00:00.000Z",
            metadata: { owner: "founder@acceleratewith.us" },
          },
        ],
      },
    });

    const result = await retrieveKnowledge(supabase, { entityName: "Eval Corp" });
    assert.equal(result.found, true);

    // Check that relevant documents are ranked higher (current, matching docs first)
    const driveChunks = result.chunks.filter((c) => c.entityType === "drive_document");
    assert.ok(driveChunks.length >= 2);

    // Current matching doc should be ranked higher than stale doc
    const currentDoc = driveChunks.find((c) => c.documentName === "Eval Corp Proposal.pdf");
    const staleDoc = driveChunks.find((c) => c.documentName === "Eval Corp Old Notes.txt");
    assert.ok(currentDoc);
    assert.ok(staleDoc);

    // Current doc should have higher confidence than stale
    assert.ok((currentDoc?.confidence ?? 0) > (staleDoc?.confidence ?? 0));

    // Unrelated document should not appear (or appear at the end with low relevance)
    const unrelatedDoc = driveChunks.find((c) => c.documentName === "Unrelated Document.pdf");
    // May or may not appear depending on query matching, but if it does, should be ranked lower
    if (unrelatedDoc) {
      const currentIndex = driveChunks.indexOf(currentDoc!);
      const unrelatedIndex = driveChunks.indexOf(unrelatedDoc);
      assert.ok(unrelatedIndex >= currentIndex, "Unrelated doc should rank lower or equal");
    }
  }

  // 7. SD2: Expose degraded retrieval when optional embeddings/reranking are unavailable
  {
    // Ensure ENABLE_SEMANTIC_RETRIEVAL is not set
    delete process.env.ENABLE_SEMANTIC_RETRIEVAL;

    const supabase = stubSupabase({
      companies: {
        data: [{ id: "comp-degraded", name: "Degraded Corp", domain: "degraded.com" }],
      },
    });

    const result = await retrieveKnowledge(supabase, { entityName: "Degraded Corp" });
    assert.equal(result.found, true);
    assert.equal(result.degraded, true);
    assert.ok(result.degradationReason?.includes("Semantic retrieval"));
    assert.ok(result.degradationReason?.includes("keyword-only"));
  }

  console.log("All 7 Second Brain Knowledge tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});