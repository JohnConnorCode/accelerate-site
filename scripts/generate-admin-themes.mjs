import { readFileSync, writeFileSync } from "node:fs";
const themes = JSON.parse(
  readFileSync(new URL("../src/lib/admin/themes.json", import.meta.url), "utf8"),
);
const scopes = [
  ".admin-shell",
  ".admin-overlay-token-scope",
  "body.admin-dialog-open",
  "body.admin-notifications-open",
];
const darkSelectors = [
  ...themes.filter((t) => t.mode === "dark").map((t) => `[data-theme="${t.id}"]`),
  'html[data-theme="workspace"]:has(style[data-admin-workspace-mode="dark"])',
].flatMap((s) => [s, `${s} *`]);
/** Decorative select chevron tinted with the theme's muted ink. Mirrors
 *  selectChevron() in src/lib/admin/theme-definition.ts, which derives the
 *  same token for custom themes at compile time; keep the two in sync. */
function selectChevron(color) {
  const stroke = color.startsWith("#") ? `%23${color.slice(1)}` : encodeURIComponent(color);
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='${stroke}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;
}
// The dark variant keys off the document theme attribute, so the public site
// needs it too. It lives in its own sheet that the root stylesheet imports;
// admin-themes.css stays behind the admin chrome where it is scoped.
const variantCss =
  "/* Tailwind dark-mode resolution shared by the public site and the admin.\n" +
  "   Generated from src/lib/admin/themes.json. Run npm run themes:generate. */\n" +
  `@custom-variant dark (&:where(${darkSelectors.join(", ")}));\n`;
const css =
  "/* Generated from src/lib/admin/themes.json. Run npm run themes:generate. */\n" +
  themes
    .map((t) => {
      // One :is() keeps every preset at the same specificity as the shared
      // foundations, so import order (foundations, then themes) decides which
      // value wins instead of selector shape.
      const selector = `:is(${scopes
        .map((s) => (t.id === "light" ? s : `[data-theme="${t.id}"] ${s}`))
        .join(", ")})`;
      const tokens = {
        ...t.tokens,
        "--admin-select-chevron": selectChevron(t.tokens["--admin-muted"]),
      };
      return `${selector} {\n${Object.entries(tokens)
        .map(([k, v]) => `  ${k}: ${v};`)
        .join("\n")}\n  color-scheme: ${t.mode};\n}`;
    })
    .join("\n\n") +
  "\n";
const targets = [
  [new URL("../src/app/theme-variants.css", import.meta.url), variantCss],
  [new URL("../src/app/admin-themes.css", import.meta.url), css],
];
if (process.argv.includes("--check")) {
  for (const [target, expected] of targets) {
    if (readFileSync(target, "utf8") !== expected)
      throw new Error("Theme CSS is stale. Run npm run themes:generate.");
  }
} else for (const [target, content] of targets) writeFileSync(target, content);
