#!/usr/bin/env tsx
/** Produces reviewable setup data; never writes to a workspace or calls a model. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  RADAR_PROFILE_DEFAULTS,
  radarProfileReadiness,
} from "../src/lib/revenue-os/radar-profile-contract";
const { values } = parseArgs({
  options: { preset: { type: "string" }, profile: { type: "string" } },
});
const names = ["superdebate", "service-business"];
if (values.preset && !names.includes(values.preset))
  throw new Error(
    `Unknown preset. Choose ${names.join(" or ")}, or supply your own --profile file.`,
  );
const read = (path: string) => {
  const raw = readFileSync(path, "utf8");
  if (Buffer.byteLength(raw) > 32768) throw new Error("Profile exceeds 32 KiB");
  return JSON.parse(raw);
};
const preset = values.preset
  ? read(
      fileURLToPath(
        new URL(`../plugins/opportunity-radar/presets/${values.preset}.json`, import.meta.url),
      ),
    )
  : {};
const custom = values.profile ? read(values.profile) : {};
const result = radarProfileReadiness({ ...RADAR_PROFILE_DEFAULTS, ...preset, ...custom });
console.log(
  JSON.stringify(
    {
      ...result,
      change: { moduleId: "opportunity-radar", settings: result.profile },
      enableChange: result.ready ? { moduleId: "opportunity-radar", enabled: true } : null,
      instructions: [
        "Review these public settings. Read current values with get_module_configuration filtered to opportunity-radar.",
        "Use preview_module_configuration with change, then propose_module_configuration with that exact change and returned digest. The owner approves through the existing action queue.",
        "After settings are applied, separately preview/propose enableChange and review that approval. Setup does not start discovery, spend money, send outreach or publish content.",
        "Use --profile your-public-business-profile.json for your own organization. Presets are editable starting points, not verified evidence or relationships.",
      ],
    },
    null,
    2,
  ),
);
