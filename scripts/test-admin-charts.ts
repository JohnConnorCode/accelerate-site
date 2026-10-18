/**
 * Scoped guard for the shared admin chart primitives.
 *
 * Enforces the two invariants a chart primitive must never break: colors come
 * from theme tokens (never a hardcoded hex), and proportion helpers clamp
 * instead of throwing on invalid input.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CHART_SERIES, clampPercent, seriesColor } from "../src/components/admin/charts/chart-tokens";

const here = dirname(fileURLToPath(import.meta.url));
const chartsDir = join(here, "..", "src", "components", "admin", "charts");

assert.equal(seriesColor(0), CHART_SERIES[0], "seriesColor starts at the first series token");
assert.equal(
  seriesColor(CHART_SERIES.length),
  CHART_SERIES[0],
  "seriesColor wraps when the series count exceeds the palette",
);
for (const token of CHART_SERIES) {
  assert.match(token, /^var\(--admin-/, "every series color must be an admin theme token");
}

assert.equal(clampPercent(-25), 0, "negative proportions clamp to 0");
assert.equal(clampPercent(175), 100, "proportions above 100 clamp to 100");
assert.equal(clampPercent(Number.NaN), 0, "non-finite proportions clamp to 0 instead of throwing");
assert.equal(clampPercent(42), 42, "valid proportions pass through");

const hexColor = /#[0-9a-fA-F]{3,8}\b/;
for (const file of readdirSync(chartsDir)) {
  if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
  const source = readFileSync(join(chartsDir, file), "utf8");
  assert.ok(!hexColor.test(source), `${file} must not hardcode a hex color; use a theme token`);
}

console.log(
  "admin chart primitives: theme-token, clamping and no-hardcoded-color guards pass",
);
