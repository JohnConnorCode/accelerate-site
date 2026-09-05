#!/usr/bin/env tsx
/**
 * Test Suite: Pluggable Module / Plugin Contract for Revenue OS
 *
 * Verifies:
 * 1. Module registry definition and taxonomy invariants
 * 2. Core module immutability (core modules cannot be disabled)
 * 3. Optional module toggling and clean navigation filtering
 * 4. AI tool availability gating based on module status
 * 5. Execution refusal when calling AI tools belonging to disabled modules
 * 6. Backward compatibility with default tenant configuration
 */
import assert from "node:assert/strict";
import {
  REVENUE_OS_MODULES,
  NAV_LINK_TO_MODULE_MAP,
  AI_TOOL_TO_MODULE_MAP,
  isModuleEnabled,
  getActiveModules,
  isNavLinkEnabled,
  isAiToolModuleEnabled,
} from "../src/lib/revenue-os/modules";
import { EXTENSION_MODULES } from "../src/lib/revenue-os/extension-modules.generated";
import { adminNavSections, filterNavSectionsByTenant } from "../src/lib/admin/navigation";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import { tenant } from "../src/config/tenant";
import { MemorySupabase } from "./lib/memory-supabase";

async function main() {
  console.log("Starting Plugin & Module Contract tests...");

  // 1. Module registry definition invariants
  const moduleIds = new Set<string>();
  for (const mod of REVENUE_OS_MODULES) {
    assert.ok(mod.id && typeof mod.id === "string", "Module must have a valid string id");
    assert.ok(!moduleIds.has(mod.id), `Duplicate module id found: ${mod.id}`);
    moduleIds.add(mod.id);
    assert.ok(mod.name && mod.name.length > 0, `Module ${mod.id} must have a name`);
    assert.ok(
      mod.description && mod.description.length > 0,
      `Module ${mod.id} must have a description`,
    );
    assert.ok(
      ["revenue", "delivery", "intelligence", "sources", "system"].includes(mod.category),
      `Invalid category for ${mod.id}`,
    );
    assert.equal(typeof mod.isCore, "boolean", `Module ${mod.id} must define isCore boolean`);
    assert.equal(
      typeof mod.defaultEnabled,
      "boolean",
      `Module ${mod.id} must define defaultEnabled boolean`,
    );
    assert.ok(Array.isArray(mod.navLinkIds), `Module ${mod.id} must define navLinkIds array`);
  }

  // 2. Core modules cannot be disabled
  const coreModules = REVENUE_OS_MODULES.filter((m) => m.isCore);
  assert.ok(coreModules.length >= 4, "Must have at least 4 core modules");
  for (const core of coreModules) {
    const disabledAttempt = { modules: { [core.id]: false } };
    assert.equal(
      isModuleEnabled(core.id, disabledAttempt),
      true,
      `Core module '${core.id}' must remain enabled even when explicitly set to false in config`,
    );
  }

  // 3. Optional modules can be disabled
  const optionalModules = REVENUE_OS_MODULES.filter((m) => !m.isCore);
  assert.ok(optionalModules.length >= 5, "Must have optional modules defined");
  for (const opt of optionalModules) {
    assert.equal(isModuleEnabled(opt.id, null), opt.defaultEnabled);
    assert.equal(isModuleEnabled(opt.id, { modules: {} }), opt.defaultEnabled);
    assert.equal(isModuleEnabled(opt.id, { modules: { [opt.id]: false } }), false);
    assert.equal(isModuleEnabled(opt.id, { modules: { [opt.id]: true } }), true);
  }

  // 4. Navigation integration & filtering
  const allFlatNavLinks = adminNavSections.flatMap((s) => s.links);
  for (const link of allFlatNavLinks) {
    const owningModule = NAV_LINK_TO_MODULE_MAP.get(link.id);
    assert.ok(
      owningModule,
      `Admin nav link '${link.id}' must map to a registered module in REVENUE_OS_MODULES`,
    );
  }

  // Test disabling a single module (e.g. proposals)
  const proposalsDisabledConfig = { modules: { proposals: false } };
  assert.equal(isNavLinkEnabled("proposals", proposalsDisabledConfig), false);
  assert.equal(isNavLinkEnabled("pipeline", proposalsDisabledConfig), true);

  const filteredSections = filterNavSectionsByTenant(adminNavSections, proposalsDisabledConfig);
  const filteredLinks = filteredSections.flatMap((s) => s.links);
  assert.ok(
    !filteredLinks.some((l) => l.id === "proposals"),
    "Proposals nav link must be removed when module is disabled",
  );
  assert.ok(
    filteredLinks.some((l) => l.id === "pipeline"),
    "Pipeline nav link must remain present",
  );
  assert.ok(
    filteredLinks.some((l) => l.id === "today"),
    "Today nav link must remain present",
  );

  // Test disabling multiple modules (e.g. all delivery tools)
  const deliveryDisabledConfig = {
    modules: {
      bookings: false,
      clients: false,
      content: false,
      resources: false,
    },
  };
  const noDeliverySections = filterNavSectionsByTenant(adminNavSections, deliveryDisabledConfig);
  assert.ok(
    !noDeliverySections.some((s) => s.label === "Delivery"),
    "Delivery section must be omitted when all its links are disabled",
  );

  // 5. AI Tools module gating
  const campaignToolModule = AI_TOOL_TO_MODULE_MAP.get("propose_campaign_activation");
  assert.ok(campaignToolModule, "propose_campaign_activation must map to the campaigns module");
  assert.equal(campaignToolModule?.id, "campaigns");

  // When campaigns module is enabled
  const enabledCheck = isAiToolModuleEnabled("propose_campaign_activation", {
    modules: { campaigns: true },
  });
  assert.equal(enabledCheck.enabled, true);

  // When campaigns module is disabled
  const disabledCheck = isAiToolModuleEnabled("propose_campaign_activation", {
    modules: { campaigns: false },
  });
  assert.equal(disabledCheck.enabled, false);
  assert.match(disabledCheck.reason || "", /Outbound Campaigns/);

  // Verify executeRegisteredRevenueTool throws cleanly when calling a tool of a disabled module
  const stubSupabase = new MemorySupabase({ campaigns: [] }).client as unknown as Parameters<
    typeof executeRegisteredRevenueTool
  >[0]["supabase"];

  let executionRefused = false;
  try {
    await executeRegisteredRevenueTool(
      {
        supabase: stubSupabase,
        actorEmail: "test@acceleratewith.us",
        toolPack: "outreach",
        tenantConfig: { modules: { campaigns: false } },
      },
      "propose_campaign_activation",
      { campaignId: "camp-123", reasoning: "Test activation" },
    );
  } catch (error) {
    executionRefused = true;
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, /module \(campaigns\) is disabled/i);
  }
  assert.ok(
    executionRefused,
    "executeRegisteredRevenueTool must refuse execution for disabled module tool",
  );

  // 6. Live / default Accelerate compatibility
  // Every module whose manifest says defaultEnabled is active without any
  // tenant override, and every module that says otherwise is not. This used to
  // assert that all modules are active, which held only while core was the
  // whole registry; an extension manifest may ship defaultEnabled: false.
  const activeDefaultModules = getActiveModules(tenant);
  const expectedDefaultActive = REVENUE_OS_MODULES.filter(
    (mod) => mod.isCore || mod.defaultEnabled,
  );
  assert.equal(
    activeDefaultModules.length,
    expectedDefaultActive.length,
    "Modules active by default must be exactly the core modules plus those declaring defaultEnabled",
  );
  for (const mod of REVENUE_OS_MODULES) {
    const isActive = activeDefaultModules.some((active) => active.id === mod.id);
    assert.equal(
      isActive,
      mod.isCore || mod.defaultEnabled,
      `Module ${mod.id} default activation must follow isCore/defaultEnabled`,
    );
  }

  // 7. The extension seam: a module registered from extensions/*.module.json
  // is a first-class module, gated exactly like a core one.
  const extensionModules = EXTENSION_MODULES;
  for (const mod of extensionModules) {
    assert.equal(mod.isCore, false, `Extension module ${mod.id} must never claim isCore`);
    assert.ok(
      isModuleEnabled(mod.id, { modules: { [mod.id]: true } }),
      `Extension module ${mod.id} must be enableable by tenant config`,
    );
    assert.equal(
      isModuleEnabled(mod.id, { modules: { [mod.id]: false } }),
      false,
      `Extension module ${mod.id} must be disableable by tenant config`,
    );
    for (const navId of mod.navLinkIds) {
      assert.equal(
        isNavLinkEnabled(navId, { modules: { [mod.id]: false } }),
        false,
        `Disabling ${mod.id} must hide its nav link ${navId}`,
      );
    }
  }

  const defaultNavSections = filterNavSectionsByTenant(adminNavSections, tenant);
  const defaultFlatLinks = defaultNavSections.flatMap((s) => s.links);
  const expectedDefaultLinks = allFlatNavLinks.filter((link) => {
    const owner = REVENUE_OS_MODULES.find((mod) => mod.navLinkIds.includes(link.id));
    return !owner || owner.isCore || owner.defaultEnabled;
  });
  assert.equal(
    defaultFlatLinks.length,
    expectedDefaultLinks.length,
    "Default nav must show exactly the links owned by default-active modules",
  );

  console.log(
    `All ${REVENUE_OS_MODULES.length} modules (${extensionModules.length} from extension manifests) and plugin contract gates passed successfully!`,
  );
}

main().catch((err) => {
  console.error("Plugin tests failed:", err);
  process.exit(1);
});
