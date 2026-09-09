import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const navigation = readFileSync(resolve(root, "src/lib/admin/navigation.ts"), "utf8");
const guidance = readFileSync(resolve(root, "src/lib/admin/page-guidance.ts"), "utf8");
const header = readFileSync(resolve(root, "src/components/admin/PageHeader.tsx"), "utf8");

const ids = [...navigation.matchAll(/id: "([^"]+)",/g)].map((match) => match[1]);
const missing = ids.filter((id) => !guidance.includes(`"${id}": {`));
const problems = [
  ...missing.map((id) => `Missing contextual guidance for ${id}`),
  ...(header.includes("How this works") ? [] : ["PageHeader does not expose contextual help"]),
  ...(navigation.includes('label: "Delivery Runs"') ? ["Deprecated Delivery Runs label remains"] : []),
  ...(navigation.includes('label: "Identity review"') ? ["Deprecated Identity review label remains"] : []),
];

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(`Admin language audit passed: ${ids.length} navigation destinations have shared guidance.`);
