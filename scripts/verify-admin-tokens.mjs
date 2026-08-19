import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(css|tsx|ts)$/.test(name)) files.push(path);
  }
}
walk(root);

const css = readFileSync(join(root, "app/globals.css"), "utf8");
const defined = new Set([...css.matchAll(/(--admin-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
const used = new Set();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/var\((--admin-[a-z0-9-]+)/g)) used.add(match[1]);
}
const missing = [...used].filter((token) => !defined.has(token)).sort();
if (missing.length) throw new Error(`Undefined admin tokens:\n${missing.join("\n")}`);
console.log(`Admin token contract passed: ${used.size} used tokens are defined.`);
