import assert from "node:assert/strict";
import { getRevenueAiTools } from "../src/lib/revenue-os/ai-tools";
import {
  applySourceAuthority,
  authorityOrder,
  listSourceAuthorities,
  registerSourceAuthority,
  sourceAuthorityRequestKey,
  systemKeyForKnowledgeSource,
} from "../src/lib/revenue-os/source-authority";
import { retrieveKnowledge } from "../src/lib/revenue-os/knowledge";
import { AuthorizedMemorySupabase as MemorySupabase } from "./lib/autonomy-fixture";

const ACTOR = "founder@example.com";
const VERIFIED = "2026-09-01T00:00:00.000Z";

function db() {
  const mem = new MemorySupabase({
    source_authority_registry: [],
    audit_log: [],
    companies: [],
    contacts: [],
    opportunities: [],
    activities: [],
  });
  return { mem, client: mem.client as never };
}

const base = {
  displayName: "Canonical CRM",
  truthDomains: ["contact_identity", "pipeline_stage"],
  authorityTier: "official" as const,
  ownerEmail: ACTOR,
  lastVerifiedAt: VERIFIED,
  verificationLapseDays: 90,
};

(async () => {
  // AC1: registry maps system to domains with tier, owner, verification and scope.
  {
    const { client } = db();
    const entry = await registerSourceAuthority(client, {
      systemKey: "Canonical_CRM",
      ...base,
      appliesTo: { entityTypes: ["contact", "opportunity"] },
      actorEmail: ACTOR,
    });
    assert.equal(entry.system_key, "canonical_crm");
    assert.equal(entry.authority_tier, "official");
    assert.equal(entry.owner_email, ACTOR);
    assert.deepEqual(entry.truth_domains, ["contact_identity", "pipeline_stage"]);
    assert.equal(entry.verification_lapse_days, 90);
    assert.deepEqual(entry.applies_to, { entityTypes: ["contact", "opportunity"] });
    const listed = await listSourceAuthorities(client);
    assert.equal(listed.length, 1);
    const listedEntry = listed[0];
    assert.ok(listedEntry);
    assert.equal(listedEntry.id, entry.id);
  }

  // AC1 replay: same request key returns the existing row.
  {
    const { mem, client } = db();
    const first = await registerSourceAuthority(client, { systemKey: "canonical_crm", ...base });
    const second = await registerSourceAuthority(client, { systemKey: "canonical_crm", ...base });
    assert.equal(first.id, second.id);
    assert.equal(mem.rows("source_authority_registry").length, 1);
    assert.equal(
      first.request_key,
      sourceAuthorityRequestKey({
        systemKey: "canonical_crm",
        displayName: base.displayName,
        truthDomains: base.truthDomains,
        authorityTier: base.authorityTier,
        ownerEmail: base.ownerEmail,
        lastVerifiedAt: new Date(VERIFIED).toISOString(),
        verificationLapseDays: 90,
        appliesTo: null,
      }),
    );
  }

  // Update with a new payload writes a new verification date and audits.
  {
    const { mem, client } = db();
    await registerSourceAuthority(client, { systemKey: "canonical_crm", ...base });
    const updated = await registerSourceAuthority(client, {
      systemKey: "canonical_crm",
      ...base,
      lastVerifiedAt: "2026-09-18T00:00:00.000Z",
      actorEmail: ACTOR,
    });
    assert.equal(mem.rows("source_authority_registry").length, 1);
    assert.ok(updated.last_verified_at.startsWith("2026-09-18"));
    assert.ok(mem.rows("audit_log").some((row) => String(row.action).includes("source_authority")));
  }

  // Invalid input fails closed.
  {
    const { client } = db();
    await assert.rejects(
      () => registerSourceAuthority(client, { systemKey: "CRM!", ...base }),
      /lowercase slug/,
    );
    await assert.rejects(
      () =>
        registerSourceAuthority(client, {
          systemKey: "canonical_crm",
          ...base,
          authorityTier: "trusted" as "official",
        }),
      /Unknown authority tier/,
    );
    await assert.rejects(
      () =>
        registerSourceAuthority(client, {
          systemKey: "canonical_crm",
          ...base,
          ownerEmail: "not-an-email",
        }),
      /valid email/,
    );
    await assert.rejects(
      () =>
        registerSourceAuthority(client, {
          systemKey: "canonical_crm",
          ...base,
          truthDomains: [],
        }),
      /must not be empty/,
    );
    await assert.rejects(
      () =>
        registerSourceAuthority(client, {
          systemKey: "canonical_crm",
          ...base,
          lastVerifiedAt: "soon",
        }),
      /ISO date/,
    );
  }

  // Same request key cannot bind a different system.
  {
    const { client } = db();
    const first = await registerSourceAuthority(client, { systemKey: "canonical_crm", ...base });
    await assert.rejects(
      () =>
        registerSourceAuthority(client, {
          systemKey: "gmail",
          ...base,
          displayName: "Gmail",
          requestKey: first.request_key,
        }),
      /already bound/,
    );
  }

  // AC2: retrieval orders by authority; unregistered sources stay low; conflicts flagged.
  {
    const now = Date.parse("2026-09-19T00:00:00.000Z");
    const { client } = db();
    await registerSourceAuthority(client, { systemKey: "canonical_crm", ...base });
    await registerSourceAuthority(client, {
      systemKey: "gmail",
      displayName: "Gmail",
      truthDomains: ["contact_identity"],
      authorityTier: "working",
      ownerEmail: ACTOR,
      lastVerifiedAt: VERIFIED,
    });
    const index = new Map(
      (await listSourceAuthorities(client)).map((entry) => [entry.system_key, entry]),
    );
    const tagged = applySourceAuthority(
      [
        {
          source: "activity_ledger",
          entityType: "contact",
          entityId: "c1",
          content: "Informal title: intern",
          occurredAt: "2026-09-18T00:00:00.000Z",
        },
        {
          source: "canonical_record",
          entityType: "contact",
          entityId: "c1",
          content: "Title: VP Sales",
          occurredAt: "2026-08-01T00:00:00.000Z",
        },
        {
          source: "conversation",
          entityType: "contact",
          entityId: "c1",
          content: "Said they are intern",
          occurredAt: "2026-09-17T00:00:00.000Z",
        },
      ],
      index,
      now,
    );
    const first = tagged.chunks[0];
    assert.ok(first);
    assert.equal(first.systemKey, "canonical_crm");
    assert.equal(first.authorityTier, "official");
    assert.equal(first.current, true);
    const unregistered = tagged.chunks.find((chunk) => chunk.systemKey === "activity_ledger");
    assert.equal(unregistered?.authorityTier, "low");
    assert.equal(systemKeyForKnowledgeSource("canonical_record"), "canonical_crm");
    assert.ok(authorityOrder("official") < authorityOrder("low"));

    const canonical = (await listSourceAuthorities(client))[0];
    assert.ok(canonical);
    const conflicted = applySourceAuthority(
      [
        {
          source: "canonical_record",
          entityType: "contact",
          entityId: "c1",
          content: "Title: VP Sales",
          occurredAt: "2026-08-01T00:00:00.000Z",
        },
        {
          source: "conversation",
          entityType: "contact",
          entityId: "c1",
          content: "Title: intern",
          occurredAt: "2026-09-17T00:00:00.000Z",
        },
      ],
      new Map([
        [
          "canonical_crm",
          {
            ...canonical,
            system_key: "canonical_crm",
            truth_domains: ["contact_identity"],
          },
        ],
        [
          "conversations",
          {
            ...canonical,
            id: "other",
            system_key: "conversations",
            authority_tier: "working" as const,
            truth_domains: ["contact_identity"],
          },
        ],
      ]),
      now,
    );
    const conflict = conflicted.conflicts[0];
    assert.ok(conflict);
    assert.ok(conflicted.chunks.every((chunk) => chunk.conflict));
    assert.ok(conflict.detail.includes("neither is auto-resolved"));
  }

  // AC3: stale knowledge is surfaced, not served as current.
  {
    const now = Date.parse("2026-09-19T00:00:00.000Z");
    const { client } = db();
    await registerSourceAuthority(client, {
      systemKey: "drive",
      displayName: "Drive playbook",
      truthDomains: ["playbooks"],
      authorityTier: "approved",
      ownerEmail: ACTOR,
      lastVerifiedAt: "2026-01-01T00:00:00.000Z",
      verificationLapseDays: 30,
    });
    const index = new Map(
      (await listSourceAuthorities(client)).map((entry) => [entry.system_key, entry]),
    );
    const tagged = applySourceAuthority(
      [
        {
          source: "drive",
          entityType: "note",
          entityId: "n1",
          content: "Old playbook price is $4k",
          occurredAt: "2026-01-02T00:00:00.000Z",
        },
        {
          source: "canonical_record",
          entityType: "note",
          entityId: "n2",
          content: "Current list price is $6k",
          occurredAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      index,
      now,
    );
    const currentChunk = tagged.chunks[0];
    const staleChunk = tagged.chunks[1];
    assert.ok(currentChunk && staleChunk);
    assert.equal(currentChunk.systemKey, "canonical_crm");
    assert.equal(currentChunk.current, true);
    assert.equal(staleChunk.systemKey, "drive");
    assert.equal(staleChunk.stale, true);
    assert.equal(staleChunk.current, false);
  }

  // Retrieval path tags authority on live chunks.
  {
    const { client } = db();
    const registered = await registerSourceAuthority(client, {
      systemKey: "canonical_crm",
      ...base,
    });
    type Row = Record<string, unknown>;
    function stubSupabase(tables: Record<string, { data?: Row[] }> = {}) {
      function query() {
        const self: Record<string, unknown> = {};
        const chain = () => self;
        for (const method of [
          "select",
          "eq",
          "or",
          "ilike",
          "limit",
          "order",
          "maybeSingle",
          "single",
        ]) {
          self[method] = chain;
        }
        self.then = (resolve: (result: { data: unknown; error: unknown }) => unknown) =>
          resolve({ data: tables[current]?.data ?? [], error: null });
        return self;
      }
      let current = "";
      return {
        from: (table: string) => {
          current = table;
          return query();
        },
      } as never;
    }
    const result = await retrieveKnowledge(
      stubSupabase({
        source_authority_registry: { data: [{ ...registered }] },
        companies: {
          data: [
            {
              id: "comp-1",
              name: "Acme Corp",
              domain: "acme.com",
              created_at: "2026-08-01T00:00:00.000Z",
            },
          ],
        },
        contacts: { data: [] },
        opportunities: { data: [] },
        activities: { data: [] },
      }),
      { entityName: "Acme Corp" },
    );
    assert.equal(result.found, true);
    const company = result.chunks.find((chunk) => chunk.entityType === "company");
    assert.equal(company?.authorityTier, "official");
    assert.equal(company?.systemKey, "canonical_crm");
    assert.equal(company?.current, true);
    assert.equal(result.conflicts.length, 0);
  }

  // AI/admin parity: list is a read; register stages a reviewed write.
  {
    const tools = getRevenueAiTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    const list = byName.get("list_source_authorities");
    const register = byName.get("register_source_authority");
    assert.ok(list && register, "source authority tools are registered");
    assert.equal(list?.impact, "read");
    assert.equal(list?.confirmationRequired, false);
    assert.equal(register?.impact, "internal_write");
    assert.equal(register?.confirmationRequired, true);
    const core = new Set(getRevenueAiTools("core").map((tool) => tool.name));
    assert.ok(core.has("list_source_authorities") && core.has("register_source_authority"));
  }

  // Same explicit request key cannot change the authority tier.
  {
    const { mem, client } = db();
    const first = await registerSourceAuthority(client, {
      systemKey: "canonical_crm",
      ...base,
      requestKey: "explicit-replay-key",
      actorEmail: ACTOR,
    });
    await assert.rejects(
      () =>
        registerSourceAuthority(client, {
          systemKey: "canonical_crm",
          ...base,
          authorityTier: "working",
          requestKey: "explicit-replay-key",
          actorEmail: ACTOR,
        }),
      /already bound to a different payload/,
    );
    assert.equal(mem.rows("source_authority_registry")[0]?.authority_tier, "official");
    assert.equal(first.authority_tier, "official");
  }

  // Audit failure does not leave a committed registry row; retry restores both.
  {
    const { mem, client } = db();
    mem.fail("audit_log", { message: "injected audit failure" });
    await assert.rejects(
      () => registerSourceAuthority(client, { systemKey: "canonical_crm", ...base, actorEmail: ACTOR }),
      /injected audit failure/,
    );
    assert.equal(mem.rows("source_authority_registry").length, 0);
    mem.recover("audit_log");
    const retried = await registerSourceAuthority(client, {
      systemKey: "canonical_crm",
      ...base,
      actorEmail: ACTOR,
    });
    assert.equal(mem.rows("source_authority_registry").length, 1);
    assert.ok(mem.rows("audit_log").some((row) => row.entity_id === retried.id));
  }

  // A successful write whose audit was lost is repaired on exact replay.
  {
    const { mem, client } = db();
    const first = await registerSourceAuthority(client, {
      systemKey: "canonical_crm",
      ...base,
      requestKey: "restore-audit",
      actorEmail: ACTOR,
    });
    mem.tables.audit_log = [];
    const second = await registerSourceAuthority(client, {
      systemKey: "canonical_crm",
      ...base,
      requestKey: "restore-audit",
      actorEmail: ACTOR,
    });
    assert.equal(first.id, second.id);
    assert.ok(mem.rows("audit_log").some((row) => row.entity_id === first.id));
  }

  // Unique-conflict recovery requires an exact payload match.
  {
    const winner = {
      id: "winner-1",
      tenant_id: "tenant-a",
      system_key: "canonical_crm",
      display_name: base.displayName,
      truth_domains: base.truthDomains,
      authority_tier: "official",
      owner_email: ACTOR,
      last_verified_at: new Date(VERIFIED).toISOString(),
      verification_lapse_days: 90,
      applies_to: null,
      request_key: "winner-key",
      created_at: VERIFIED,
      updated_at: VERIFIED,
    };
    let selects = 0;
    const conflictClient = {
      from(table: string) {
        let op = "select";
        const self: Record<string, unknown> = {};
        const chain = () => self;
        for (const method of ["select", "eq", "limit", "update", "delete"]) self[method] = chain;
        self.insert = () => {
          op = "insert";
          return self;
        };
        self.maybeSingle = self.single = () => self;
        self.then = (resolve: (result: { data: unknown; error: unknown }) => unknown) => {
          if (table === "audit_log") return resolve({ data: [], error: null });
          if (op === "insert")
            return resolve({ data: null, error: { code: "23505", message: "duplicate" } });
          selects += 1;
          if (selects === 1) return resolve({ data: null, error: null });
          if (selects === 2) return resolve({ data: null, error: null });
          return resolve({ data: winner, error: null });
        };
        return self;
      },
    };
    await assert.rejects(
      () =>
        registerSourceAuthority(conflictClient as never, {
          systemKey: "canonical_crm",
          ...base,
          authorityTier: "working",
          requestKey: "other-key",
          actorEmail: ACTOR,
        }),
      /does not match this request/,
    );
  }

  console.log(JSON.stringify({ result: "source-authority coverage added", checks: 14 }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
