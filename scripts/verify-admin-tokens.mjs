import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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
const glassCard = readFileSync(join(root, "components/ui/GlassCard.tsx"), "utf8");
if (!glassCard.includes("admin-surface-compatible")) {
  throw new Error("Admin surface contract: GlassCard must opt into the shared admin surface tier.");
}
if (
  !css.includes(".admin-shell .admin-surface-compatible") ||
  !css.includes("border-radius: var(--admin-surface-radius)")
) {
  throw new Error(
    "Admin surface contract: shared cards must resolve their radius from --admin-surface-radius inside admin.",
  );
}
for (const elevation of ["flat", "raised", "outlined"]) {
  if (
    !css.includes(`.admin-surface--${elevation}`) ||
    !css.includes(`.admin-surface-compatible--${elevation}`)
  ) {
    throw new Error(
      `Admin surface contract: ${elevation} cards must be defined for both current and legacy surfaces.`,
    );
  }
}
console.log(`Admin token contract passed: ${used.size} used tokens are defined.`);

// -----------------------------------------------------------------------
// Raw Tailwind palette color ratchet for admin surfaces.
//
// Conversations shipped with hardcoded bg-blue-50/text-blue-700/bg-blue-600/
// bg-amber-500 utilities that don't adapt across the four admin themes --
// dark mode turned one message bubble's meta line into white-on-white,
// invisible. Categorical status colors (a pipeline-stage badge map needing
// many distinguishable hues at a glance) are a legitimate, intentional use
// of the raw palette and are not the target here; this budget is aimed at
// one-off UI chrome that should route through --admin-ink,
// --admin-accent-soft, --admin-danger, --admin-success, and --admin-warning
// instead, the same way BRAND_BUDGET in verify-agent-contract.mjs ratchets
// hardcoded business literals down over time rather than banning them
// outright on day one.
//
// The budget is the count of raw-palette-color utility classes each file
// still carries, as of the day this ratchet was added. It may only shrink:
// failing in both directions (too many, or a stale budget above the real
// count) is what keeps a ratchet a ratchet instead of a ceiling nobody ever
// lowers.
const COLOR_BUDGET = {
  "src/app/admin/analytics/page.tsx": 10,
  "src/app/admin/bookings/page.tsx": 2,
  "src/app/admin/campaigns/page.tsx": 19,
  "src/app/admin/chat-leads/page.tsx": 1,
  "src/app/admin/clients/page.tsx": 2,
  "src/app/admin/contact-imports/page.tsx": 32,
  "src/app/admin/contacts/[email]/page.tsx": 6,
  "src/app/admin/contacts/page.tsx": 3,
  "src/app/admin/conversations/page.tsx": 33,
  "src/app/admin/emails/page.tsx": 17,
  "src/app/admin/features/page.tsx": 25,
  "src/app/admin/inbox/page.tsx": 12,
  "src/app/admin/integrations/page.tsx": 44,
  "src/app/admin/leads/page.tsx": 1,
  "src/app/admin/partners/page.tsx": 2,
  "src/app/admin/pipeline/[id]/page.tsx": 3,
  "src/app/admin/pipeline/page.tsx": 25,
  "src/app/admin/proposals/page.tsx": 1,
  "src/app/admin/recovery/page.tsx": 12,
  "src/app/admin/revenue/page.tsx": 4,
  "src/app/admin/setup/page.tsx": 20,
  "src/app/admin/tenants/page.tsx": 32,
  "src/app/admin/today/page.tsx": 39,
  "src/app/admin/website-grades/page.tsx": 9,
  "src/components/admin/AICapabilities.tsx": 9,
  "src/components/admin/AIRunHistory.tsx": 29,
  "src/components/admin/AdminAIChat.tsx": 16,
  "src/components/admin/AdminErrorBoundary.tsx": 3,
  "src/components/admin/AdminReadBody.tsx": 4,
  "src/components/admin/AdminShell.tsx": 4,
  "src/components/admin/ChannelBreakdown.tsx": 5,
  "src/components/admin/ClientDetail.tsx": 1,
  "src/components/admin/ContactTimeline.tsx": 3,
  "src/components/admin/ContentItemForm.tsx": 2,
  "src/components/admin/ConversionFunnel.tsx": 3,
  "src/components/admin/EmailBlockComposer.tsx": 4,
  "src/components/admin/LeadsTable.tsx": 6,
  "src/components/admin/NotificationBell.tsx": 1,
  "src/components/admin/PlausibleWidget.tsx": 1,
  "src/components/admin/ProposalEditor.tsx": 1,
  "src/components/admin/RevenueAICommand.tsx": 5,
  "src/components/admin/RevenueSetupGate.tsx": 3,
  "src/components/admin/RevenueSnapshot.tsx": 5,
  "src/components/admin/StatusBadge.tsx": 36,
  "src/components/admin/TaskWidget.tsx": 5,
  "src/components/admin/TenantProviderControls.tsx": 11,
  "src/components/admin/TodaysPriorities.tsx": 14,
};

const colorPattern =
  /\b(?:bg|text|border|ring|from|to|via|hover:bg|hover:text|dark:bg|dark:text|dark:border)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white)-[0-9]{2,3}\b/g;

const adminFiles = files.filter((file) => {
  const rel = relative(root, file).replace(/\\/g, "/");
  return rel.startsWith("app/admin/") || rel.startsWith("components/admin/");
});

const colorCounts = new Map();
for (const file of adminFiles) {
  const relPath = "src/" + relative(root, file).replace(/\\/g, "/");
  const hits = (readFileSync(file, "utf8").match(colorPattern) || []).length;
  if (hits > 0) colorCounts.set(relPath, hits);
}

const colorFailures = [];
for (const [file, hits] of colorCounts) {
  const budget = COLOR_BUDGET[file] ?? 0;
  if (hits > budget) {
    colorFailures.push(
      `${file} has ${hits} raw Tailwind palette color utilit${hits === 1 ? "y" : "ies"} but a budget of ${budget}. Route new admin chrome through --admin-ink/--admin-accent-soft/--admin-danger/--admin-success/--admin-warning, or lower the budget if this is a legitimate categorical color (e.g. a fixed multi-hue status map).`,
    );
  }
}
for (const [file, budget] of Object.entries(COLOR_BUDGET)) {
  const hits = colorCounts.get(file) ?? 0;
  if (hits < budget) {
    colorFailures.push(
      `${file} now has ${hits} raw Tailwind palette color utilit${hits === 1 ? "y" : "ies"}, below its budget of ${budget}. Lower the budget in verify-admin-tokens.mjs so the ratchet holds.`,
    );
  }
}
if (colorFailures.length) throw new Error(colorFailures.join("\n"));

console.log(`Admin color ratchet passed: ${colorCounts.size} files within their raw-color budget.`);
