import assert from "node:assert/strict";
import {
  flagSourceConflicts,
  isSourceStale,
  listSources,
  registerSource,
  resolveSourceAuthority,
  retrieveKnowledgeWithAuthority,
  verifySource,
} from "../src/lib/revenue-os/source-authority";
import { AuthorizedMemorySupabase as MemorySupabase } from "./lib/autonomy-fixture";

function db() {
  const mem = new MemorySupabase({
    source_authorities: [],
    audit_log: [],
    companies: [],
    contacts: [],
    opportunities: [],
    activities: [],
  });
  return { mem, client: mem.client as never };
}

(async () => {
  // AC1: registry maps systems to truth domains with tier, owner and scope.
  {
    const { client } = db();
    const s = await registerSource(client, {
      sourceKey: "Stripe",
      truthDomains: ["financial"],
      authority: "official",
      ownerEmail: "founder@example.com",
      actorEmail: "founder@example.com",
    });
    assert.equal(s.source_key, "stripe");
    assert.equal(s.authority, "official");
    assert.deepEqual(s.truth_domains, ["financial"]);
    const all = await listSources(client);
    assert.equal(all.length, 1);
  }

  // AC1 replay: repeat registration updates instead of duplicating.
  {
    const { mem, client } = db();
    await registerSource(client, { sourceKey: "CRM", truthDomains: ["customer"] });
    const updated = await registerSource(client, {
      sourceKey: "crm",
      truthDomains: ["customer", "deal"],
      authority: "approved",
    });
    assert.deepEqual(updated.truth_domains, ["customer", "deal"]);
    assert.equal(updated.authority, "approved");
    assert.equal(mem.rows("source_authorities").length, 1);
  }

  // AC1 invalid input fails closed.
  {
    const { client } = db();
    await assert.rejects(
      () => registerSource(client, { sourceKey: "   ", truthDomains: ["x"] }),
      /must not be empty/,
    );
    await assert.rejects(
      () => registerSource(client, { sourceKey: "x", truthDomains: [] }),
      /truth domain/,
    );
    await assert.rejects(
      () =>
        registerSource(client, {
          sourceKey: "x",
          truthDomains: ["y"],
          authority: "divine" as "official",
        }),
      /Unknown authority/,
    );
  }

  // AC2: unregistered sources fail closed to low authority; ordering prefers tiers.
  {
    assert.equal(resolveSourceAuthority("slack", []), "historical");
    assert.equal(
      resolveSourceAuthority("Drive", [{ source_key: "drive", authority: "approved" as const }]),
      "approved",
    );
  }

  // AC2: conflicts flag instead of resolving silently.
  {
    const conflicts = flagSourceConflicts([
      { entityType: "company", entityId: "c1", content: "Acme does X", authority: "official" },
      { entityType: "company", entityId: "c1", content: "Acme does Y", authority: "working" },
      { entityType: "company", entityId: "c2", content: "Beta does Z", authority: "working" },
    ]);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.entityId, "c1");
    assert.deepEqual(conflicts[0]?.tiers, ["official", "working"]);
    // Same content across tiers is agreement, not conflict.
    assert.equal(
      flagSourceConflicts([
        { entityType: "company", entityId: "c9", content: "Same", authority: "official" },
        { entityType: "company", entityId: "c9", content: "Same", authority: "working" },
      ]).length,
      0,
    );
  }

  // AC3: stale surfaces; verification clears it.
  {
    const { client } = db();
    const s = await registerSource(client, { sourceKey: "wiki", truthDomains: ["process"] });
    assert.equal(isSourceStale(s), true);
    const verified = await verifySource(client, { id: s.id, actorEmail: "founder@example.com" });
    assert.equal(isSourceStale(verified), false);
    assert.equal(isSourceStale({ last_verified_at: "2020-01-01T00:00:00.000Z" }), true);
  }

  // AC2 end to end: retrieval orders by tier and tags authority.
  {
    const { mem, client } = db();
    await registerSource(client, {
      sourceKey: "canonical_record",
      truthDomains: ["crm"],
      authority: "official",
    });
    await registerSource(client, {
      sourceKey: "conversation",
      truthDomains: ["context"],
      authority: "historical",
    });
    mem.rows("companies").push({
      id: "co-1",
      name: "Acme",
      domain: "acme.example",
      industry: "Manufacturing",
      updated_at: "2026-09-01T00:00:00Z",
      created_at: "2026-09-01T00:00:00Z",
    });
    const result = await retrieveKnowledgeWithAuthority(client, { domain: "acme.example" });
    assert.equal(result.found, true);
    assert.ok(result.chunks.length > 0);
    const first = result.chunks[0];
    assert.ok(first);
    assert.equal(first.authority, "official");
    const tiers = result.chunks.map((c) => c.authority);
    const rank: Record<string, number> = { official: 4, approved: 3, working: 2, historical: 1 };
    assert.deepEqual(
      [...tiers].sort((a, b) => (rank[b] ?? 0) - (rank[a] ?? 0)),
      tiers,
    );
  }

  console.log(JSON.stringify({ result: "source-authority coverage added", checks: 10 }));
})();
