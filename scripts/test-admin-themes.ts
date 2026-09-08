import assert from "node:assert/strict";
import {
  adminThemeDefinitionSchema,
  compileAdminTheme,
  themeContrast,
  themeDeclarations,
  themeFromPreset,
  validateAdminTheme,
} from "../src/lib/admin/theme-definition";
import themes from "../src/lib/admin/themes.json";
import { workspaceBrandSchema } from "../src/lib/revenue-os/branding-contract";

for (const preset of themes) {
  const theme = validateAdminTheme(themeFromPreset(preset.id));
  const tokens = compileAdminTheme(theme);
  const required = Object.keys(themes[0]!.tokens).filter(
    (key) => key !== "--admin-mobile-dock-index",
  );
  for (const key of required) assert.ok(tokens[key], `${preset.id}: missing ${key}`);
  for (const background of ["--admin-canvas", "--admin-surface"]) {
    for (const text of [
      "--admin-ink",
      "--admin-muted",
      "--admin-accent",
      "--admin-danger",
      "--admin-warning",
      "--admin-success",
    ]) {
      assert.ok(
        themeContrast(tokens[text]!, tokens[background]!) >= 4.5,
        `${preset.id}: ${text} on ${background}`,
      );
    }
  }
  assert.ok(themeContrast(tokens["--admin-action"]!, tokens["--admin-action-ink"]!) >= 4.5);
  assert.ok(themeContrast(tokens["--admin-nav-faint"]!, tokens["--admin-sidebar"]!) >= 4.5);
  assert.deepEqual(validateAdminTheme(JSON.parse(JSON.stringify(theme))), theme);
  assert.ok(!themeDeclarations(theme).includes("</style>"));
  assert.ok(workspaceBrandSchema.shape.adminTheme.safeParse(theme).success);
}
const valid = themeFromPreset("signal");
assert.throws(
  () =>
    validateAdminTheme({ ...valid, palette: { ...valid.palette, muted: valid.palette.surface } }),
  /contrast/,
);
assert.throws(() => validateAdminTheme({ ...valid, mode: "light" }), /brightness/);
assert.throws(
  () => validateAdminTheme({ ...valid, geometry: { surfaceRadius: 4, controlRadius: 16 } }),
  /corners/,
);
assert.throws(() =>
  validateAdminTheme({
    ...valid,
    palette: { ...valid.palette, accent: "url(https://invalid.example)" },
  }),
);
assert.throws(() => validateAdminTheme({ ...valid, css: "body{display:none}" }));
assert.throws(() => validateAdminTheme({ ...valid, font: "url(font)" }));
assert.ok(adminThemeDefinitionSchema.safeParse(valid).success);
assert.ok(
  workspaceBrandSchema.shape.adminTheme.safeParse(undefined).success,
  "Legacy branding stays optional",
);
console.log(
  `Admin themes passed: ${themes.length} presets, token completeness, contrast, portable round trips, invalid definitions and legacy compatibility.`,
);
