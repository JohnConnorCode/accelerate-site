#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { marketingPositioning } from "../src/content/marketing-positioning";

const ROOT = process.cwd();
const CONTRACT = "docs/contracts/MARKETING-POSITIONING-CONTRACT.md";

assert.ok(existsSync(CONTRACT), "the durable marketing positioning contract is missing");
const contract = readFileSync(CONTRACT, "utf8");
for (const required of [
  "Strategy and consulting",
  "Custom systems and integrations",
  "Managed execution",
  "Training and optimization",
  "The Command Center is one integrated solution",
]) {
  assert.ok(contract.includes(required), `positioning contract lost required rule: ${required}`);
}

assert.equal(
  marketingPositioning.engagementModes.length,
  4,
  "the homepage must present all four engagement modes",
);
assert.ok(
  marketingPositioning.engagementModes.every((mode) => mode.href.startsWith("/services")),
  "homepage engagement modes must route to Services, not a single product",
);
assert.match(marketingPositioning.coreOffer, /free up time/i);
assert.match(marketingPositioning.coreOffer, /increase revenue/i);
assert.match(marketingPositioning.coreOffer, /advise, build, integrate, and run/i);
assert.match(marketingPositioning.commandCenter.description, /For some businesses/i);
assert.match(marketingPositioning.commandCenter.description, /For others/i);

const systems = readFileSync("src/components/home/Systems.tsx", "utf8");
assert.match(systems, /marketingPositioning\.engagementModes/);
assert.doesNotMatch(systems, /href:\s*["']\/command-center/);

const commandCenter = readFileSync("src/components/home/CommandCenter.tsx", "utf8");
assert.match(commandCenter, /marketingPositioning\.commandCenter\.description/);

const assistantPrompt = readFileSync("src/lib/chat/system-prompt.ts", "utf8");
assert.match(assistantPrompt, /marketingPositioning\.coreOffer/);
assert.match(assistantPrompt, /Do not assume they need a Command Center/);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const scopedFiles = [
  ...walk(join(ROOT, "src/components/home")),
  ...[
    "src/components/sections/ServicesPage.tsx",
    "src/components/sections/AboutPage.tsx",
    "src/components/sections/ContactPage.tsx",
    "src/components/sections/ResourcesPage.tsx",
    "src/components/sections/PartnersPage.tsx",
    "src/components/sections/CommandCenterPage.tsx",
    "src/components/sections/OpenSourcePage.tsx",
    "src/components/chat/ChatPanel.tsx",
    "src/components/roofing/RoofingCampaignPage.tsx",
    "src/content/services.ts",
    "src/content/verticals.ts",
    "src/content/industry-visuals.ts",
    "src/content/open-source.ts",
    "src/content/email-sequences.ts",
    "src/lib/email/registry.ts",
    "src/lib/email/templates.ts",
    "src/lib/search/index.ts",
    "src/app/(marketing)/page.tsx",
    "src/app/layout.tsx",
    "src/app/(marketing)/layout.tsx",
    "src/app/(marketing)/services/page.tsx",
    "src/app/(marketing)/industries/page.tsx",
    "src/app/(marketing)/command-center/page.tsx",
    "src/app/(marketing)/open-source/page.tsx",
    "src/app/(marketing)/about/page.tsx",
    "src/app/(marketing)/contact/page.tsx",
    "src/app/(marketing)/resources/page.tsx",
    "src/app/(marketing)/partners/page.tsx",
    "src/app/(marketing)/roofing/page.tsx",
  ].map((file) => join(ROOT, file)),
];

const banned = [
  { re: /same\s+[^.!?\n]{1,60}[.!?]\s*Different\s+/i, why: "Same X. Different Y. framing" },
  { re: /Same machine[.!?]\s*Different Tuesday/i, why: "founder-banned homepage framing" },
  { re: /\bmove the needle\b/i, why: "consultant filler" },
  { re: /\bdeployment protocol\b/i, why: "consultant filler" },
  { re: /\bzero-latency\b/i, why: "consultant filler" },
  { re: /\bhigh-leverage\b/i, why: "consultant filler" },
  { re: /engineer(?:ed|ing)? (?:them|it) out of existence/i, why: "opaque consultant framing" },
  { re: /The Accelerate Team/, why: "old team sign-off; prospect mail is signed by the founder" },
  { re: /Solution Generator/, why: "old product name; the artifact is a plan" },
  { re: /Launch package/, why: "old packaging; recommend the smallest solution for the business" },
];

// Mutation checks: prove the guard catches the two regressions that prompted
// this contract instead of merely passing the current tree.
assert.ok(banned.some((rule) => rule.re.test("Same machine. Different Tuesday.")));
assert.equal(
  [{ href: "/command-center#capabilities" }].every((mode) => mode.href.startsWith("/services")),
  false,
  "a Command Center-only service map must fail the routing invariant",
);

const failures: string[] = [];
for (const file of [...new Set(scopedFiles)].filter(existsSync)) {
  const source = withoutComments(readFileSync(file, "utf8"));
  for (const rule of banned) {
    const match = source.match(rule.re);
    if (match) failures.push(`${file.slice(ROOT.length + 1)}: "${match[0]}" (${rule.why})`);
  }
}

assert.deepEqual(failures, [], `positioning regressions found:\n${failures.join("\n")}`);
console.log(`Positioning copy contract passed across ${new Set(scopedFiles).size} scoped files.`);
