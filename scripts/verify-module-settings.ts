#!/usr/bin/env node
/**
 * scripts/build-extension-modules.mjs validates settings on a manifest
 * before it ever becomes a module, but that only covers third-party
 * extensions. A core module declares settings directly in modules.ts with
 * no build-time gate at all. This is that gate, for both: it imports the
 * real, compiled REVENUE_OS_MODULES registry rather than re-parsing source,
 * so it can never drift from what actually ships, and it is the second,
 * independent check the field-level doc comment on ModuleSettingField
 * promises exists.
 */
import { REVENUE_OS_MODULES } from "../src/lib/revenue-os/modules";

const SETTING_TYPES = ["string", "number", "boolean", "enum", "url"];
const SECRET_LOOKING = /secret|token|password|api[_-]?key|credential/i;

const failures = [];
let checkedFields = 0;

for (const mod of REVENUE_OS_MODULES) {
  if (!mod.settings?.length) continue;
  const seen = new Set();
  for (const field of mod.settings) {
    checkedFields += 1;
    if (!field.key || typeof field.key !== "string") {
      failures.push(`${mod.id}: a settings entry has no string key`);
      continue;
    }
    if (seen.has(field.key)) failures.push(`${mod.id}: settings key "${field.key}" is duplicated`);
    seen.add(field.key);
    if (SECRET_LOOKING.test(field.key) || SECRET_LOOKING.test(field.label ?? ""))
      failures.push(
        `${mod.id}: settings key "${field.key}" looks like a secret. Credentials go through integration-adapters.ts, never tenants.config.`,
      );
    if (!SETTING_TYPES.includes(field.type))
      failures.push(
        `${mod.id}: settings "${field.key}" type "${field.type}" must be one of ${SETTING_TYPES.join(", ")}`,
      );
    if (field.type === "enum" && !(Array.isArray(field.options) && field.options.length))
      failures.push(`${mod.id}: settings "${field.key}" is type enum but declares no options`);
    if (field.type !== "enum" && field.options)
      failures.push(`${mod.id}: settings "${field.key}" declares options but is not type enum`);
  }
}

if (failures.length) {
  console.error(`Module settings validation failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(JSON.stringify({ result: "passed", checkedFields }, null, 2));
