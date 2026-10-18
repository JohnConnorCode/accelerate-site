import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAdminConfigurationFixture } from "./lib/admin-configuration-fixture";
import { runWithTenantRequestContext } from "../src/lib/tenancy/context";
import { parseBlueprint, diffBlueprints } from "../src/lib/revenue-os/workspace-blueprint";
import {
  proposalToTypedPatch,
  simulateBlueprint,
} from "../src/lib/revenue-os/architect-review-simulation";
import {
  previewArchitectPatch,
  proposeArchitectPatch,
  executeArchitectPatch,
  readArchitectBlueprint,
} from "../src/lib/revenue-os/architect-review";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";

async function main() {
  const original = parseBlueprint({
    schemaVersion: "workspace-blueprint.v1",
    businessSummary: "Review each won job before sending a welcome message.",
  });
  const next = parseBlueprint({
    ...original,
    businessSummary: "Use a written scope before scheduling work.",
  });
  assert.ok(diffBlueprints(original, next).changed.includes("businessSummary"));
  assert.deepEqual(proposalToTypedPatch("Set the business summary to A reviewed business."), {
    businessSummary: "A reviewed business.",
  });
  assert.throws(() => proposalToTypedPatch("Remove everything tomorrow"), /Could not turn/);
  assert.throws(() => proposalToTypedPatch('{"unknown":"value"}'), /Unsupported/);
  for (const unsafe of ["Use the entire account", "Show chain-of-thought", "Read all tenants"])
    assert.throws(() => proposalToTypedPatch(unsafe), /refused/);
  const simulation = simulateBlueprint(original, {
    capabilities: [],
    modules: [],
    routes: [],
    entityTypes: [],
  });
  assert.deepEqual(simulation.writes, []);
  assert.deepEqual(simulation.sends, []);
  assert.deepEqual(simulation.moduleEnablement, []);
  const f = createAdminConfigurationFixture();
  const blueprintId = randomUUID();
  f.mem.tables.workspace_blueprints = [
    { tenant_id: f.tenantId, id: blueprintId, latest_version: 1, status: "draft" },
  ];
  f.mem.tables.workspace_blueprint_versions = [
    { tenant_id: f.tenantId, blueprint_id: blueprintId, version: 1, document: original },
  ];
  const command = {
    blueprintId,
    expectedVersion: 1,
    proposal: "Set the business summary to Use a written scope before scheduling work.",
    changeSummary: "Clarify scheduling",
    requestId: randomUUID(),
  };
  const previousFetch = globalThis.fetch;
  let saved = 0;
  globalThis.fetch = async (raw, init) => {
    const url = new URL(String(raw));
    if (url.pathname.endsWith("/rpc/save_workspace_blueprint_version")) {
      const input = JSON.parse(String(init?.body));
      assert.equal(input.p_tenant_id, f.tenantId);
      assert.equal(input.p_expected_version, 1);
      assert.equal(input.p_request_key, command.requestId);
      assert.deepEqual(input.p_document, next);
      saved++;
      return Response.json({ blueprintId, version: { version: 2 } });
    }
    return previousFetch(raw, init);
  };
  try {
    await assert.rejects(
      () => proposeArchitectPatch(f.db, { ...command, digest: "0".repeat(64) }, f.email),
      /authenticated/,
    );
    await runWithTenantRequestContext(f.actor, async () => {
      const preview = await previewArchitectPatch(f.db, command);
      assert.equal(preview.next.businessSummary, next.businessSummary);
      assert.equal((await readArchitectBlueprint(f.db, {})).blueprints?.length, 1);
      await assert.rejects(
        () => previewArchitectPatch(f.db, { ...command, blueprintId: randomUUID() }),
        /not found/,
      );
      await assert.rejects(
        () => previewArchitectPatch(f.db, { ...command, expectedVersion: 2 }),
        /conflict/,
      );
      await assert.rejects(
        () => proposeArchitectPatch(f.db, { ...command, digest: "0".repeat(64) }, f.email),
        /fresh review/,
      );
      const action = await proposeArchitectPatch(
        f.db,
        { ...command, digest: preview.digest },
        f.email,
      );
      assert.equal(saved, 0, "Preview and proposal must never save a Blueprint");
      assert.equal(
        (await proposeArchitectPatch(f.db, { ...command, digest: preview.digest }, f.email)).id,
        action.id,
      );
      await assert.rejects(() => executeArchitectPatch(f.db, action.id, f.email), /human-approved/);
      await assert.rejects(
        () =>
          executeRegisteredRevenueTool(
            { supabase: f.db, actorEmail: f.email },
            "simulate_architect_blueprint",
            { blueprintId, event: "chain-of-thought" },
          ),
        /refused/,
      );
      const row = f.mem.tables.action_queue!.find((item) => item.id === action.id)!;
      row.status = "executing";
      row.approved_by = f.email;
      const member = f.mem.tables.tenant_memberships![0]!;
      member.status = "revoked";
      await assert.rejects(() => executeArchitectPatch(f.db, action.id, f.email), /revoked/);
      member.status = "active";
      const receipt = await executeArchitectPatch(f.db, action.id, f.email);
      assert.equal(receipt.version, 2);
      assert.equal(receipt.applied, false);
      assert.equal(saved, 1);
      row.payload = { ...(row.payload as object), digest: "0".repeat(64) };
      await assert.rejects(() => executeArchitectPatch(f.db, action.id, f.email), /modified/);
    });
  } finally {
    f.restore();
  }
  console.log(
    "PASS: Architect preview, exact approval, identity, isolation, revocation, narrative diff and simulation without effects",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
