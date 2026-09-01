import fs from "fs";
import path from "path";
import matter from "gray-matter";

const ARTICLES_DIR = path.join(process.cwd(), "src/content/articles");

const VALID_CATEGORIES = [
  "lead-generation",
  "automation",
  "ai-tools",
  "industry",
  "foundational",
  "local-seo",
] as const;

const CATEGORY_PILLAR_MAP: Record<string, string> = {
  "lead-generation": "Lead Gen",
  automation: "Automation",
  "ai-tools": "AI Tools",
  industry: "Industry",
  foundational: "Foundational",
  "local-seo": "Local SEO",
};

const VALID_FUNNEL_STAGES = ["awareness", "consideration", "decision"] as const;

const WORD_COUNT_RANGES: Record<string, { min: number; max: number }> = {
  awareness: { min: 1500, max: 2500 },
  consideration: { min: 2500, max: 4000 },
  decision: { min: 1200, max: 2000 },
};

// Named-client references were removed site-wide (fabricated/non-consented);
// articles must never reintroduce them, and /results was retired.
const BANNED_CLIENT_REFERENCES = [/farrell/i, /sparkblox/i, /montoya/i, /\/results\//];

const INTERNAL_LINK_PATTERN = /\]\(\s*\/(learn|services|industries|contact|plan-builder)[^)]*\)/g;

const MDX_COMPONENT_PATTERN =
  /<(CTACard|StatHighlight|Callout|StepByStep|Step|ComparisonTable|QuoteBlock|ToolRecommendation|CodeBlock|VideoEmbed)/g;

const CTA_CARD_PATTERN = /<CTACard/g;

// Match standalone "leads" but allow compound terms like "lead-generation", "lead gen"
const LEADS_PATTERN = /\bleads\b/gi;
const LEADS_EXCLUSIONS = [
  /lead-generation/i,
  /lead\s+gen/i,
  /lead\s+generation/i,
  /lead\s+magnet/i,
  /lead\s+scoring/i,
  /team\s+leads/i,
  /this\s+leads\s+to/i,
  /that\s+leads\s+to/i,
  /which\s+leads\s+to/i,
  /often\s+leads/i,
  /it\s+leads/i,
  /naturally\s+leads/i,
  /leads\s+to/i,
  /\/[a-z-]*leads[a-z-]*/, // URL paths containing "leads"
  /generates-leads/i,
  /qualify-leads/i,
  /qualifies.*leads/i,
  /nurtures.*leads/i,
  /capture.*leads/i,
  /converts.*leads/i,
];

interface ArticleResult {
  slug: string;
  pass: boolean;
  failures: string[];
  warnings: string[];
}

function verifyArticle(filename: string): ArticleResult {
  const slug = filename.replace(/\.mdx$/, "");
  const filePath = path.join(ARTICLES_DIR, filename);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);
  const failures: string[] = [];
  const warnings: string[] = [];

  // --- Required frontmatter fields ---
  const requiredFields = [
    "title",
    "slug",
    "excerpt",
    "date",
    "category",
    "pillar",
    "tags",
    "author",
    "targetKeywords",
    "funnelStage",
  ];
  for (const field of requiredFields) {
    if (!data[field]) {
      failures.push(`Missing required frontmatter: ${field}`);
    }
  }

  // --- Slug matches filename ---
  if (data.slug && data.slug !== slug) {
    failures.push(`Slug mismatch: frontmatter slug "${data.slug}" != filename "${slug}"`);
  }

  // --- Date format ---
  if (data.date) {
    const dateStr = String(data.date);
    // gray-matter may parse date as Date object
    const dateMatch =
      typeof data.date === "object" && data.date instanceof Date
        ? true
        : /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    if (!dateMatch) {
      failures.push(`Invalid date format: "${dateStr}" (expected YYYY-MM-DD)`);
    }
  }

  // --- Category valid ---
  if (
    data.category &&
    !VALID_CATEGORIES.includes(data.category as (typeof VALID_CATEGORIES)[number])
  ) {
    failures.push(`Invalid category: "${data.category}"`);
  }

  // --- Category/pillar paired ---
  if (data.category && data.pillar) {
    const expectedPillar = CATEGORY_PILLAR_MAP[data.category];
    if (expectedPillar && data.pillar !== expectedPillar) {
      failures.push(
        `Category/pillar mismatch: "${data.category}" should pair with "${expectedPillar}", got "${data.pillar}"`,
      );
    }
  }

  // --- Funnel stage valid ---
  if (
    data.funnelStage &&
    !VALID_FUNNEL_STAGES.includes(data.funnelStage as (typeof VALID_FUNNEL_STAGES)[number])
  ) {
    failures.push(`Invalid funnelStage: "${data.funnelStage}"`);
  }

  // --- Tags 3-6 ---
  if (Array.isArray(data.tags)) {
    if (data.tags.length < 3) {
      failures.push(`Too few tags: ${data.tags.length} (need 3-6)`);
    }
    if (data.tags.length > 6) {
      failures.push(`Too many tags: ${data.tags.length} (need 3-6)`);
    }
  }

  // --- Word count by funnel stage (warning) ---
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const range = data.funnelStage ? WORD_COUNT_RANGES[data.funnelStage as string] : undefined;
  if (range) {
    if (wordCount < range.min) {
      warnings.push(
        `Word count ${wordCount} below ${data.funnelStage} range (${range.min}-${range.max})`,
      );
    }
    if (wordCount > range.max) {
      warnings.push(
        `Word count ${wordCount} above ${data.funnelStage} range (${range.min}-${range.max})`,
      );
    }
  }

  // --- Banned client references (removed site-wide, must not reappear) ---
  const bannedHit = BANNED_CLIENT_REFERENCES.find((pattern) => pattern.test(content));
  if (bannedHit) {
    failures.push(
      `Banned client/case-study reference found (${bannedHit}) — named clients were removed site-wide`,
    );
  }

  // --- MDX components (at least 2) ---
  const componentMatches = content.match(MDX_COMPONENT_PATTERN);
  const componentCount = componentMatches ? componentMatches.length : 0;
  if (componentCount < 2) {
    failures.push(`Only ${componentCount} MDX component(s) used (need at least 2)`);
  }

  // --- CTACard (at least 1) ---
  const ctaMatches = content.match(CTA_CARD_PATTERN);
  const ctaCount = ctaMatches ? ctaMatches.length : 0;
  if (ctaCount < 1) {
    failures.push("No CTACard found (need at least 1)");
  }

  // --- Internal links (at least 2) ---
  const internalLinks = content.match(INTERNAL_LINK_PATTERN);
  const linkCount = internalLinks ? internalLinks.length : 0;
  if (linkCount < 2) {
    failures.push(
      `Only ${linkCount} internal link(s) found (need at least 2 to /learn/, /services/, /industries/, /contact, /plan-builder)`,
    );
  }

  // --- No standalone "leads" ---
  const leadsMatches = content.match(LEADS_PATTERN);
  if (leadsMatches) {
    // Check each occurrence against exclusions
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineLeads = line.match(LEADS_PATTERN);
      if (!lineLeads) continue;

      // Check if any exclusion pattern matches the surrounding context
      const isExcluded = LEADS_EXCLUSIONS.some((exc) => exc.test(line));
      if (!isExcluded) {
        // Check if it's in frontmatter (skip frontmatter)
        const frontmatterEnd = fileContent.indexOf("---", 3);
        const lineOffset = fileContent
          .split("\n")
          .slice(0, i + 1)
          .join("\n").length;
        if (lineOffset > frontmatterEnd) {
          failures.push(
            `Found standalone "leads" on line ${i + 1}: "${line.trim().substring(0, 80)}..."`,
          );
          break; // Report only first occurrence
        }
      }
    }
  }

  return {
    slug,
    pass: failures.length === 0,
    failures,
    warnings,
  };
}

function main() {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error("Articles directory not found:", ARTICLES_DIR);
    process.exit(1);
  }

  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .sort();

  console.log(`\n📝 Verifying ${files.length} articles...\n`);

  let passCount = 0;
  let failCount = 0;
  const allResults: ArticleResult[] = [];

  for (const file of files) {
    const result = verifyArticle(file);
    allResults.push(result);

    if (result.pass) {
      passCount++;
      if (result.warnings.length > 0) {
        console.log(`✅ ${result.slug}`);
        for (const w of result.warnings) {
          console.log(`   ⚠️  ${w}`);
        }
      } else {
        console.log(`✅ ${result.slug}`);
      }
    } else {
      failCount++;
      console.log(`❌ ${result.slug}`);
      for (const f of result.failures) {
        console.log(`   ✗ ${f}`);
      }
      for (const w of result.warnings) {
        console.log(`   ⚠️  ${w}`);
      }
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Results: ${passCount} passed, ${failCount} failed out of ${files.length} articles`);

  if (failCount > 0) {
    console.log(`\n❌ ${failCount} article(s) failed verification.\n`);
    process.exit(1);
  } else {
    console.log(`\n✅ All articles passed verification.\n`);
  }
}

main();
