import { z } from "zod";
import { runWithTenantRequestContext } from "../src/lib/tenancy/context";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  RADAR_PROFILE_DEFAULTS,
  RADAR_PROFILE_FIELDS,
  radarProfileReadiness,
  radarProfileSchema,
} from "../src/lib/revenue-os/radar-profile-contract";
import { pluginSettingsContract } from "../src/lib/revenue-os/plugin-settings-contract";
import { MODULE_MAP, validateModuleSettingsInput } from "../src/lib/revenue-os/modules";
import { createAdminConfigurationFixture } from "./lib/admin-configuration-fixture";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import { readModuleConfiguration } from "../src/lib/revenue-os/module-configuration-read";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import {
  previewModuleConfiguration,
  proposeModuleConfiguration,
} from "../src/lib/revenue-os/module-actions";
async function main() {
  const moduleId = "opportunity-radar";
  assert.equal(MODULE_MAP.get(moduleId)!.defaultEnabled, false);
  assert.deepEqual(MODULE_MAP.get(moduleId)!.settings, RADAR_PROFILE_FIELDS);
  assert.deepEqual(
    Object.fromEntries(RADAR_PROFILE_FIELDS.map((f) => [f.key, f.default])),
    RADAR_PROFILE_DEFAULTS,
  );
  const schema = z.toJSONSchema(radarProfileSchema);
  for (const field of RADAR_PROFILE_FIELDS.filter((f) => f.type === "number")) {
    const property = schema.properties![field.key] as { minimum: number; maximum: number };
    assert.equal(property.minimum, field.min);
    assert.equal(property.maximum, field.max);
  }
  assert.equal(radarProfileReadiness(RADAR_PROFILE_DEFAULTS).ready, false);
  assert.throws(() => pluginSettingsContract("constructor"), /Unknown plugin settings/);
  for (const settings of [
    { website: "http://example.org" },
    { website: "https://user:password@example.org" },
    { timeZone: "not-a-zone" },
    { dailyShortlist: 5.5 },
    { dailyShortlist: 11 },
    { maxDiscoveries: 0 },
    { dailyModelBudgetUsd: -1 },
    { sourceMode: "paid" },
    { outreachMode: "send" },
    { unknown: "x" },
  ])
    assert.equal(validateModuleSettingsInput(moduleId, settings).valid, false);
  for (const preset of ["superdebate", "service-business"]) {
    const fixture = JSON.parse(
      readFileSync(`plugins/opportunity-radar/presets/${preset}.json`, "utf8"),
    );
    const ready = radarProfileReadiness({ ...RADAR_PROFILE_DEFAULTS, ...fixture });
    assert.equal(ready.ready, true);
    assert.equal(ready.capabilities.automaticDiscovery, false);
    const cli = JSON.parse(
      execFileSync(
        process.execPath,
        ["--import", "tsx", "scripts/radar-setup.ts", "--preset", preset],
        { encoding: "utf8" },
      ),
    );
    assert.deepEqual(cli.change.settings, ready.profile);
    const f = createAdminConfigurationFixture();
    try {
      await runWithTenantRequestContext(f.actor, async () => {
        const context = { supabase: f.db, actorEmail: f.email };
        const current = async () => (await readModuleConfiguration(f.db, { moduleId })).modules[0]!;
        assert.equal((await current()).enabled, false);
        await assert.rejects(
          () => previewModuleConfiguration(f.db, { change: { moduleId, enabled: true } }),
          /Configure required/,
        );
        const preview = (
          await executeRegisteredRevenueTool(context, "preview_module_configuration", {
            change: cli.change,
          })
        ).output as Awaited<ReturnType<typeof previewModuleConfiguration>>;
        const action = (
          await executeRegisteredRevenueTool(context, "propose_module_configuration", {
            change: cli.change,
            digest: preview.digest,
          })
        ).output as Awaited<ReturnType<typeof proposeModuleConfiguration>>;
        assert.equal((await current()).settings.organization, "");
        await approveAndExecuteAction(f.db, action.id, f.email);
        assert.equal((await current()).settings.organization, fixture.organization);
        await assert.rejects(
          () => approveAndExecuteAction(f.db, action.id, f.email),
          /already handled/,
        );
        assert.equal(
          (f.mem.rows("tenants")[0]!.config as Record<string, unknown>).unrelated,
          "retain",
        );
        const foreign = (
          await readModuleConfiguration(bindTenantDatabase(f.mem.client, f.other, true), {
            moduleId,
          })
        ).modules[0]!;
        assert.equal(foreign.settings.organization, "");
        for (const enabled of [true, false]) {
          const change = { moduleId, enabled };
          const p = await previewModuleConfiguration(f.db, { change });
          const a = await proposeModuleConfiguration(f.db, { change, digest: p.digest }, f.email);
          await approveAndExecuteAction(f.db, a.id, f.email);
          assert.equal((await current()).enabled, enabled);
        }
        const stale = await previewModuleConfiguration(f.db, {
          change: { moduleId, settings: { region: "Elsewhere" } },
        });
        const change = { moduleId, settings: { region: "Updated location" } };
        const p = await previewModuleConfiguration(f.db, { change });
        const a = await proposeModuleConfiguration(f.db, { change, digest: p.digest }, f.email);
        await approveAndExecuteAction(f.db, a.id, f.email);
        await assert.rejects(
          () =>
            proposeModuleConfiguration(
              f.db,
              { change: stale.change, digest: stale.digest },
              f.email,
            ),
          /changed/,
        );
      });
    } finally {
      f.restore();
    }
  }
  console.log(
    "Radar setup: generated settings parity, two-business CLI/profile reuse, invalid input, governed AI approval, enable/disable, replay, stale revision and tenant isolation passed. Automatic discovery/sending remain unavailable.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
