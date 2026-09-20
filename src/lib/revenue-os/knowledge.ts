import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retrievePluginKnowledge } from "./plugin-knowledge";
import { searchDocumentKnowledge } from "./document-knowledge";
import { loadFounderKnowledgeNotes } from "./notes";
import { loadActivityTimeline } from "./activities";

export const SECOND_BRAIN_KNOWLEDGE_CONTRACT = "revenue-os-knowledge.v1";

export type KnowledgeSource =
  "canonical_record" | "founder_note" | "activity_ledger" | "conversation" | "document" | "plugin";

export interface KnowledgeChunk {
  id: string;
  source: KnowledgeSource;
  entityType:
    | "company"
    | "contact"
    | "opportunity"
    | "note"
    | "activity"
    | "document"
    | "conversation"
    | "plugin_record";
  entityId: string;
  title: string;
  content: string;
  occurredAt: string;
  confidence: number;
  author: string | null;
  discrepancy?: string | null;
  revision?: string;
  sourceLocation?: string;
  authority?: "official" | "approved" | "working" | "historical";
}

export interface KnowledgeQueryInput {
  pluginId?: string;
  pluginInput?: Record<string, unknown>;
  entityType?: "company" | "contact" | "opportunity";
  entityId?: string;
  entityName?: string;
  email?: string;
  domain?: string;
  topic?: string;
  limit?: number;
}

export interface KnowledgeSearchResult {
  contract: typeof SECOND_BRAIN_KNOWLEDGE_CONTRACT;
  found: boolean;
  query: string;
  entitySummary: {
    name: string;
    domain?: string | null;
    stage?: string | null;
    estimatedValue?: number | null;
  } | null;
  chunks: KnowledgeChunk[];
  refusalReason: string | null;
  generatedAt: string;
  missing?: string[];
  guidance?: Array<{ id: string; revision: string; authority: string; rule: string; source: string }>;
  pluginContract?: {
    pluginId: string;
    version: number;
    revision: string;
    prerequisites: string[];
    success: { artifact: string; description: string };
  };
}

/**
 * Retrieve grounded, provenance-tagged knowledge from the canonical substrate.
 * Queries companies, contacts, opportunities, founder notes, and activity timeline.
 * Refuses explicitly if nothing matches rather than hallucinating facts.
 */
async function retrieveCanonicalKnowledge(
  supabase: SupabaseClient,
  input: KnowledgeQueryInput,
): Promise<KnowledgeSearchResult> {
  const queryStr = (
    input.entityName ||
    input.email ||
    input.domain ||
    input.topic ||
    input.entityId ||
    ""
  ).trim();

  if (!queryStr) {
    return {
      contract: SECOND_BRAIN_KNOWLEDGE_CONTRACT,
      found: false,
      query: "",
      entitySummary: null,
      chunks: [],
      refusalReason:
        "No query parameters supplied. Provide an entity name, domain, email, or topic.",
      generatedAt: new Date().toISOString(),
    };
  }

  const cleanQuery = queryStr.replace(/[^\p{L}\p{N}@ _-]/gu, " ");

  // 1. Search for matching companies
  let companyQuery = supabase.from("companies").select("*").limit(5);
  if (input.entityId) {
    companyQuery = companyQuery.eq(
      "id",
      input.entityType === "company" ? input.entityId : "00000000-0000-0000-0000-000000000000",
    );
  } else if (input.domain) {
    companyQuery = companyQuery.eq("domain", input.domain.toLowerCase().trim());
  } else {
    companyQuery = companyQuery.or(`name.ilike.%${cleanQuery}%,domain.ilike.%${cleanQuery}%`);
  }
  const { data: companies } = await companyQuery;

  // 2. Search for matching contacts
  let contactQuery = supabase.from("contacts").select("*").limit(5);
  if (input.entityId) {
    contactQuery = contactQuery.eq(
      "id",
      input.entityType === "contact" ? input.entityId : "00000000-0000-0000-0000-000000000000",
    );
  } else if (input.email) {
    contactQuery = contactQuery.eq("primary_email", input.email.toLowerCase().trim());
  } else {
    contactQuery = contactQuery.or(
      `full_name.ilike.%${cleanQuery}%,primary_email.ilike.%${cleanQuery}%`,
    );
  }
  const { data: contacts } = await contactQuery;

  // 3. Search for matching opportunities
  let opportunityQuery = supabase.from("opportunities").select("*").limit(5);
  opportunityQuery = input.entityId
    ? opportunityQuery.eq(
        "id",
        input.entityType === "opportunity"
          ? input.entityId
          : "00000000-0000-0000-0000-000000000000",
      )
    : opportunityQuery.or(`name.ilike.%${cleanQuery}%,email.ilike.%${cleanQuery}%`);
  const { data: opportunities } = await opportunityQuery;

  const matchedCompany = companies?.[0] || null;
  const matchedContact = contacts?.[0] || null;
  const matchedOpp = opportunities?.[0] || null;

  // If no primary entity is found, search founder notes directly by text match
  if (!matchedCompany && !matchedContact && !matchedOpp) {
    const { data: directNotes } = await supabase
      .from("activities")
      .select("*")
      .eq("activity_type", "founder_note")
      .ilike("summary", `%${cleanQuery}%`)
      .limit(5);

    if (!directNotes || directNotes.length === 0) {
      return {
        contract: SECOND_BRAIN_KNOWLEDGE_CONTRACT,
        found: false,
        query: queryStr,
        entitySummary: null,
        chunks: [],
        refusalReason: `No canonical records, founder notes, or activities found for "${queryStr}".`,
        generatedAt: new Date().toISOString(),
      };
    }

    const noteChunks: KnowledgeChunk[] = directNotes.map((n) => ({
      id: String(n.id),
      source: "founder_note",
      entityType: "note",
      entityId: String(n.id),
      title: String(n.title || "Founder note"),
      content: String(n.summary || ""),
      occurredAt: String(n.occurred_at),
      confidence: 0.95,
      author: String(n.actor_email || "founder"),
    }));

    return {
      contract: SECOND_BRAIN_KNOWLEDGE_CONTRACT,
      found: true,
      query: queryStr,
      entitySummary: null,
      chunks: noteChunks,
      refusalReason: null,
      generatedAt: new Date().toISOString(),
    };
  }

  // Build entity summary
  const entitySummary = {
    name:
      (matchedCompany?.name as string) ||
      (matchedContact?.full_name as string) ||
      (matchedOpp?.name as string) ||
      queryStr,
    domain: (matchedCompany?.domain as string) || null,
    stage: (matchedOpp?.stage as string) || null,
    estimatedValue: matchedOpp ? Number(matchedOpp.estimated_value) || 0 : null,
  };

  const chunks: KnowledgeChunk[] = [];

  // A. Company record chunk
  if (matchedCompany) {
    const facts = [
      matchedCompany.industry ? `Industry: ${matchedCompany.industry}` : null,
      matchedCompany.size_band ? `Size: ${matchedCompany.size_band}` : null,
      matchedCompany.location ? `Location: ${matchedCompany.location}` : null,
      matchedCompany.domain ? `Domain: ${matchedCompany.domain}` : null,
      matchedCompany.website ? `Website: ${matchedCompany.website}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    chunks.push({
      id: `company-${matchedCompany.id}`,
      source: "canonical_record",
      entityType: "company",
      entityId: String(matchedCompany.id),
      title: `Company Record: ${matchedCompany.name}`,
      content: facts || "Canonical company registered in Revenue OS.",
      occurredAt: String(matchedCompany.updated_at || matchedCompany.created_at),
      confidence: 1.0,
      author: "system",
    });
  }

  // B. Contact record chunk
  if (matchedContact) {
    const contactFacts = [
      `Name: ${matchedContact.full_name}`,
      matchedContact.primary_email ? `Email: ${matchedContact.primary_email}` : null,
      matchedContact.phone ? `Phone: ${matchedContact.phone}` : null,
      matchedContact.title ? `Title: ${matchedContact.title}` : null,
      matchedContact.lifecycle_stage ? `Lifecycle: ${matchedContact.lifecycle_stage}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    chunks.push({
      id: `contact-${matchedContact.id}`,
      source: "canonical_record",
      entityType: "contact",
      entityId: String(matchedContact.id),
      title: `Contact Record: ${matchedContact.full_name}`,
      content: contactFacts,
      occurredAt: String(matchedContact.updated_at || matchedContact.created_at),
      confidence: 1.0,
      author: "system",
    });
  }

  // C. Opportunity record chunk
  if (matchedOpp) {
    chunks.push({
      id: `opportunity-${matchedOpp.id}`,
      source: "canonical_record",
      entityType: "opportunity",
      entityId: String(matchedOpp.id),
      title: `Opportunity: ${matchedOpp.name}`,
      content: `Stage: ${matchedOpp.stage} | Estimated Value: $${(Number(matchedOpp.estimated_value) || 0).toLocaleString()} | Next Action: ${matchedOpp.next_action || "None specified"}`,
      occurredAt: String(matchedOpp.updated_at || matchedOpp.created_at),
      confidence: 1.0,
      author: "system",
    });
  }

  // D. Founder notes with provenance
  const noteFilter = {
    companyId: matchedCompany?.id ? String(matchedCompany.id) : undefined,
    contactId: matchedContact?.id ? String(matchedContact.id) : undefined,
    opportunityId: matchedOpp?.id ? String(matchedOpp.id) : undefined,
    limit: 10,
  };

  try {
    const founderNotes = await loadFounderKnowledgeNotes(supabase, noteFilter);
    for (const note of founderNotes) {
      // Check for discrepancies between note text and canonical opportunity stage
      let discrepancy: string | null = null;
      if (matchedOpp) {
        const lowerBody = note.body.toLowerCase();
        if (lowerBody.includes("closed won") && matchedOpp.stage !== "won") {
          discrepancy = `Note mentions 'closed won', but canonical opportunity record is currently in stage '${matchedOpp.stage}'. Canonical record governs.`;
        } else if (lowerBody.includes("lost deal") && matchedOpp.stage !== "lost") {
          discrepancy = `Note mentions 'lost deal', but canonical opportunity record is currently in stage '${matchedOpp.stage}'. Canonical record governs.`;
        }
      }

      chunks.push({
        id: `note-${note.id}`,
        source: "founder_note",
        entityType: "note",
        entityId: note.id,
        title: note.title,
        content: note.body,
        occurredAt: note.occurredAt,
        confidence: 0.95,
        author: note.author,
        discrepancy,
      });
    }
  } catch {
    // If founder note loading fails gracefully, proceed with other chunks
  }

  // E. Recent Activity timeline chunks
  if (matchedOpp?.id || matchedContact?.id || matchedCompany?.id) {
    try {
      const activities = await loadActivityTimeline(supabase, {
        opportunityId: matchedOpp?.id ? String(matchedOpp.id) : undefined,
        contactId: matchedContact?.id ? String(matchedContact.id) : undefined,
        companyId: matchedCompany?.id ? String(matchedCompany.id) : undefined,
        limit: 10,
      });

      for (const act of activities) {
        if (act.activity_type === "founder_note") continue; // already loaded above
        chunks.push({
          id: `activity-${act.id}`,
          source: "activity_ledger",
          entityType: "activity",
          entityId: act.id,
          title: act.title,
          content: act.summary || act.title,
          occurredAt: act.occurred_at,
          confidence: 0.9,
          author: act.actor_email,
        });
      }
    } catch {
      // Proceed gracefully
    }
  }

  const limit = Math.min(25, Math.max(1, input.limit ?? 10));
  const limitedChunks = chunks.slice(0, limit);

  return {
    contract: SECOND_BRAIN_KNOWLEDGE_CONTRACT,
    found: limitedChunks.length > 0,
    query: queryStr,
    entitySummary,
    chunks: limitedChunks,
    refusalReason: limitedChunks.length > 0 ? null : "No relevant facts or notes found.",
    generatedAt: new Date().toISOString(),
  };
}

/** Canonical records retain precedence. Documents are cited evidence, never
 * instructions, and search failures are explicit context gaps. */
export async function retrieveKnowledge(
  db: SupabaseClient,
  input: KnowledgeQueryInput,
): Promise<KnowledgeSearchResult> {
  if (input.pluginId) {
    const result = await retrievePluginKnowledge(db, input.pluginId, input.pluginInput);
    return {
      contract: SECOND_BRAIN_KNOWLEDGE_CONTRACT,
      found: result.chunks.length > 0,
      query: input.pluginId,
      chunks: result.chunks,
      entitySummary: null,
      refusalReason: result.chunks.length ? null : "No readable plugin sources found",
      generatedAt: new Date().toISOString(),
      missing: result.missing,
      pluginContract: result.contract,
      guidance: result.guidance,
    };
  }
  if (input.entityId && (!input.entityType || !/^[0-9a-f-]{36}$/i.test(input.entityId)))
    throw new Error("Use a canonical entity type and UUID together");
  const query = (input.topic || input.entityName || input.email || input.domain || "").trim();
  if (query.length > 200) throw new Error("Knowledge queries are limited to 200 characters");
  const limit = Math.min(25, Math.max(1, Math.trunc(input.limit ?? 10)));
  const canonical = await retrieveCanonicalKnowledge(db, input);
  if (query.length < 2 || input.entityId) return canonical;
  try {
    const documents = await searchDocumentKnowledge(db, query, limit);
    const chunks = [...canonical.chunks, ...documents.chunks].slice(0, limit);
    return {
      ...canonical,
      chunks,
      found: chunks.length > 0,
      refusalReason: chunks.length ? null : canonical.refusalReason,
      missing: documents.missing,
    };
  } catch (error) {
    return {
      ...canonical,
      missing: [error instanceof Error ? error.message : "Document search failed"],
    };
  }
}
