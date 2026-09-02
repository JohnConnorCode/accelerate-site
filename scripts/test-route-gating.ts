/**
 * Proves the pure parts of module-route-gating-enforcement: the
 * longest-prefix resolver picks the right owner for a nested dynamic page,
 * an unowned path (redirects, auth pages) never resolves to a module and so
 * is never gated, every module's own declared routes resolve back to it, and
 * the integrations console is exempt from the notice it would otherwise show
 * on itself. src/lib/admin/module-guard.ts composes this same resolver and
 * isModuleEnabled() with requireAdmin(), which needs next/headers request
 * scope and so is exercised at that layer by test-tenant-isolation.ts and
 * live QA, not here. scripts/verify-module-route-guards.mjs is the source-
 * level proof that every module-owned API route file actually calls the
 * module-aware helper rather than the bare one.
 */
import assert from "node:assert/strict";
import { resolveModuleForAdminPath } from "../src/lib/revenue-os/module-routes";
import {
  isModuleEnabled,
  REVENUE_OS_MODULES,
  SELF_LOCKOUT_EXEMPT_MODULES,
} from "../src/lib/revenue-os/modules";

// Longest-prefix match: a dynamic detail page under a module's declared
// route resolves to that module without the module enumerating children.
assert.equal(resolveModuleForAdminPath("/admin/clients")?.id, "clients");
assert.equal(resolveModuleForAdminPath("/admin/clients/9f1c2e")?.id, "clients");
assert.equal(resolveModuleForAdminPath("/admin/pipeline/abc-123")?.id, "core-pipeline");
assert.equal(resolveModuleForAdminPath("/admin/contacts/jane@example.com")?.id, "core-contacts");
assert.equal(resolveModuleForAdminPath("/admin/contact-imports")?.id, "core-contacts");

// A prefix must not match a sibling that merely starts with the same
// characters. "/admin/leads" must never claim "/admin/leads-capture-x".
assert.equal(resolveModuleForAdminPath("/admin/leads")?.id, "leads-capture");
assert.equal(resolveModuleForAdminPath("/admin/leads-capture-x"), null);

// Unowned paths: redirects and auth pages resolve to no module, so they are
// never gated. This is the deliberate fail-open case, bounded by
// scripts/verify-module-contract.mjs requiring every real admin page to be
// claimed by some module's routes[] in the first place.
for (const unowned of ["/admin", "/admin/login", "/admin/update-password", "/admin/ai-operations"])
  assert.equal(resolveModuleForAdminPath(unowned), null, `${unowned} must resolve to no module`);

// Core modules are always enabled regardless of tenant config, so gating
// never applies to them even though the resolver claims their routes.
const coreOwned = resolveModuleForAdminPath("/admin/today");
assert.ok(coreOwned && coreOwned.isCore);
assert.equal(isModuleEnabled(coreOwned!.id, { modules: { [coreOwned!.id]: false } }), true);

// A disabled optional module resolves to disabled through the same helper
// the layout and the API guard both call.
const optionalOwned = resolveModuleForAdminPath("/admin/proposals");
assert.ok(optionalOwned && !optionalOwned.isCore);
assert.equal(
  isModuleEnabled(optionalOwned!.id, { modules: { [optionalOwned!.id]: false } }),
  false,
);
assert.equal(isModuleEnabled(optionalOwned!.id, { modules: { [optionalOwned!.id]: true } }), true);

// The integrations console owns the toggle UI for every other module, so it
// must resolve to a real module (it is still gated for its own API reads)
// but is exempt from the page-level notice, or disabling it would strand an
// operator with no UI path back to re-enabling anything.
const integrationsModule = resolveModuleForAdminPath("/admin/integrations");
assert.ok(integrationsModule && !integrationsModule.isCore);
assert.ok(SELF_LOCKOUT_EXEMPT_MODULES.has(integrationsModule!.id));

// Every declared route across every module resolves to that same module and
// no other, so the resolver never silently reassigns ownership.
for (const mod of REVENUE_OS_MODULES) {
  for (const route of mod.routes ?? []) {
    assert.equal(
      resolveModuleForAdminPath(route)?.id,
      mod.id,
      `${route} must resolve back to its declaring module ${mod.id}`,
    );
  }
}

console.log(JSON.stringify({ result: "passed", modules: REVENUE_OS_MODULES.length }));
