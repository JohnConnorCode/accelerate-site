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
const css =
  `@custom-variant dark (&:where(${darkSelectors.join(", ")}));\n` +
  "/* Generated from src/lib/admin/themes.json. Run npm run themes:generate. */\n" +
  themes
    .map((t) => {
      const selector = scopes
        .map((s) => (t.id === "light" ? s : `[data-theme="${t.id}"] ${s}`))
        .join(",\n");
      return `${selector} {\n${Object.entries(t.tokens)
        .map(([k, v]) => `  ${k}: ${v};`)
        .join("\n")}\n  color-scheme: ${t.mode};\n}`;
    })
    .join("\n\n") +
  "\n";
const target = new URL("../src/app/admin-themes.css", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== css)
    throw new Error("Theme CSS is stale. Run npm run themes:generate.");
} else writeFileSync(target, css);
