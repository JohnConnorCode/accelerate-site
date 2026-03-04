# Content Pipeline Guide — Accelerate Learning Hub

How to create, schedule, and publish articles for acceleratewith.us/learn.

This guide is the quality gate. Every article — whether written by a human, an agent, or a team — must meet these standards before it ships. If it doesn't pass the editorial checklist at the bottom, it doesn't publish.

---

## Quick Start

To add an article:

1. Create `src/content/articles/your-slug.mdx`
2. Add frontmatter (see spec below)
3. Check `src/content/proof-points.ts` for which case study to cite (every article needs at least one)
4. Write the article using MDX components
5. Run `npm run verify:articles` to check all quality gates automatically
6. Run the editorial checklist (bottom of this doc) for subjective quality checks
7. Push to the repo
8. Article appears automatically when its `date` arrives (ISR revalidates hourly)

> **Scheduled articles must also pass all quality gates.** Articles with future dates will auto-publish via ISR when their date arrives — there is no manual review step at publish time. Verify them before merging.

---

## How Publishing Works

Articles are MDX files with a `date` field. The site only shows articles where `date <= today`. Pages revalidate via ISR every hour (`revalidate = 3600`), so a scheduled article appears within ~1 hour of its publish date.

- **No cron jobs.** No deploy hooks. No manual intervention.
- **To publish immediately:** set `date` to today or a past date.
- **To schedule:** set `date` to any future date.
- **To unpublish:** delete the file or set `date` far in the future.

The date filtering logic lives in `src/lib/mdx.ts` → `getAllArticles()` and `getArticleBySlug()`.

---

## Frontmatter Spec

Every article needs this frontmatter block at the top of the `.mdx` file:

```yaml
---
title: "Your Article Title — Be Specific, Include Primary Keyword"
slug: "your-article-slug"
excerpt: "1-2 sentences. This appears in article cards, OG descriptions, and RSS. Make it compelling."
date: "YYYY-MM-DD"
category: "automation"
pillar: "Automation"
tags: ["primary keyword", "secondary keyword", "related topic"]
author: "John Connor"
authorRole: "Founder, Accelerate"
seoTitle: "SEO-Optimized Title | Include Brand or Year"
seoDescription: "Meta description for search results. 150-160 chars. Include primary keyword naturally."
targetKeywords: ["primary keyword", "secondary keyword", "long-tail variation"]
funnelStage: "awareness"
---
```

### Field Reference

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `title` | Yes | string | Article headline. 50-70 chars ideal for SERPs. |
| `slug` | Yes | string | URL path. Must match filename (without `.mdx`). Lowercase, hyphens only. |
| `excerpt` | Yes | string | 1-2 sentences. Shown on cards, in OG tags, and RSS. |
| `date` | Yes | `YYYY-MM-DD` | Publish date. Future dates = scheduled. |
| `category` | Yes | enum | One of: `lead-generation`, `automation`, `ai-tools`, `industry`, `foundational`, `local-seo` |
| `pillar` | Yes | enum | One of: `Lead Gen`, `Automation`, `AI Tools`, `Industry`, `Foundational`, `Local SEO` |
| `tags` | Yes | string[] | 3-6 tags. Used for filtering, related articles, and tag pages. |
| `author` | Yes | string | Author name. |
| `authorRole` | No | string | e.g. "Founder, Accelerate" |
| `seoTitle` | No | string | Custom meta title. Falls back to `title` if omitted. |
| `seoDescription` | No | string | Custom meta description. Falls back to `excerpt`. |
| `targetKeywords` | Yes | string[] | 2-4 keywords. Used in JSON-LD schema. |
| `funnelStage` | Yes | enum | `awareness` (educational), `consideration` (comparison/how-to), `decision` (buy/hire) |
| `featured` | No | boolean | If `true`, shown as featured card on /learn. Only 1 article should be featured at a time. |
| `updatedDate` | No | `YYYY-MM-DD` | Set when substantially updating an existing article. |

### Category / Pillar Mapping

These must stay paired correctly:

| category | pillar |
|----------|--------|
| `lead-generation` | `Lead Gen` |
| `automation` | `Automation` |
| `ai-tools` | `AI Tools` |
| `industry` | `Industry` |
| `foundational` | `Foundational` |
| `local-seo` | `Local SEO` |

---

## Article Structures

Every article must follow one of these five structures. **Consecutive articles must use different structures.** Do not default to the same format every time.

### 1. The Deep Dive

Comprehensive guide with original research and expert analysis. Covers a topic thoroughly enough that the reader doesn't need to look elsewhere.

- **Word count:** 3,000-4,000 words
- **Best for:** Awareness and consideration stages. Broad topics like "workflow automation for small businesses."
- **Required elements:** Original data or insight, 3+ H2 sections, at least one ComparisonTable or StepByStep component, expert opinion sections
- **Structure:** Problem framing → Background/context → Core analysis (3-5 sections) → Expert take → Action steps → Conclusion

### 2. The Comparison

Head-to-head analysis of tools, approaches, or strategies. Takes a clear position — don't hedge with "it depends on your needs" as the only conclusion.

- **Word count:** 2,500-3,500 words
- **Best for:** Consideration stage. Tool comparisons, approach vs. approach.
- **Required elements:** ComparisonTable, clear winner declaration with reasoning, pricing breakdown, "who should use what" section
- **Structure:** Why this comparison matters → Evaluation criteria → Tool/approach breakdowns → Head-to-head comparison → Clear recommendation → How to decide

### 3. The Playbook

Step-by-step implementation guide with real-world details. The reader should be able to follow this and actually build the thing.

- **Word count:** 2,000-3,000 words
- **Best for:** Consideration and decision stages. How-to guides, implementation walkthroughs.
- **Required elements:** StepByStep component, specific tool names and settings, expected timeframes, common mistakes section
- **Structure:** What you'll build → Prerequisites → Step-by-step walkthrough → Common mistakes → Expected results → Next steps

### 4. The Contrarian

Challenges conventional wisdom or common advice. Presents an alternative perspective backed by experience and evidence.

- **Word count:** 1,500-2,500 words
- **Best for:** Consideration and decision stages. "Why X is wrong" or "What nobody tells you about Y."
- **Required elements:** Clear statement of the conventional wisdom being challenged, evidence for the contrarian position, at least one Callout with a counterargument, practical alternative
- **Structure:** The common advice → Why it's wrong (or incomplete) → What actually works → Evidence/proof → How to apply this

### 5. The Case Study Breakdown

Walks through a real client scenario from start to finish. Shows the thinking, the implementation, and the results.

- **Word count:** 1,500-2,500 words
- **Best for:** Decision stage. Proof that the approach works.
- **Required elements:** Real numbers (before/after), timeline, specific tools and configurations used, QuoteBlock from the client (if available), lessons learned
- **Structure:** The client's situation → The problem → What we built → Implementation details → Results (with numbers) → Lessons learned

---

## Word Count Ranges by Funnel Stage

These are ranges, not targets. Shorter is fine if the article is complete. Longer is fine if every word earns its place.

| Funnel Stage | Word Count | Rationale |
|-------------|-----------|-----------|
| **Awareness** | 1,500-2,500 | Educational. Cast a wide net. Don't overload beginners. |
| **Consideration** | 2,500-4,000 | High search intent. These readers want depth — give it to them. |
| **Decision** | 1,200-2,000 | Focused and action-oriented. Don't dilute the ask with filler. |

---

## Content Quality Standards

### Quality Gates (Pass/Fail)

Every article must pass ALL of these before publishing. These are not suggestions.

1. **Original insight requirement.** The article must contain at least one insight, observation, or recommendation that is not found in the top 10 Google results for the target keyword. This can be: a specific result from Accelerate's work, a contrarian take backed by experience, a unique framework, or a connection between ideas that other articles miss.

2. **Proof point requirement.** Every article must reference at least one specific result from Accelerate's work with real numbers. "We set up an AI receptionist for a plumbing company and they captured 23 additional after-hours calls in the first month" — not "AI receptionists can help you capture more calls." If you don't have a directly relevant case study, reference the closest one and explain the connection. See `src/content/proof-points.ts` for the full mapping of case studies to article categories, with ready-to-use proof points and metrics.

3. **Industry specificity requirement (for industry articles only).** Industry-specific articles must demonstrate real domain knowledge. Test: could you change the industry name and have the article still make sense? If yes, it fails. The article must reference industry-specific tools, workflows, regulations, seasonal patterns, or client expectations that only apply to that industry.

4. **Structural variety requirement.** Check the last 3 published articles. Your article must use a different structure from at least 2 of them. If the last 3 were all Playbooks, you cannot write a Playbook.

5. **No boilerplate paragraphs.** Read every paragraph and ask: "Does this say something specific, or could it appear in any article about any topic?" Delete or rewrite anything that could be copy-pasted between articles.

### Writing Voice

Follow the Accelerate voice:

- **Revenue-first**: Frame everything in terms of business outcomes — jobs booked, clients signed, revenue generated. Not abstract "efficiency."
- **Specific, not vague**: Use dollar amounts, percentages, timeframes. "Save 12 hours per week" not "save time."
- **AI as team member**: "Your AI receptionist answers every call" not "the software processes inbound calls."
- **No "leads"**: Use jobs, clients, consultations, appointments, inquiries, revenue.
- **Authoritative but approachable**: Write like an experienced operator explaining to a peer, not a marketer selling.
- **Expert voice**: Write as the person who builds these systems. Share what you've learned from doing the work — not what you've learned from reading about it.

### Content Differentiation Requirements

These separate good content from generic content:

**Proof points over claims.** Replace generic advice with specific results from Accelerate's work. Instead of "AI chatbots can increase conversion rates," write "We installed an AI chatbot for a personal injury firm that qualified 34% more consultations in 60 days — here's how we configured it."

**Contrarian sections.** Every consideration and decision stage article needs at least one "what most people get wrong" section. Identify the bad advice that's common in the space and explain why it fails. This builds more trust than any amount of success stories.

**Failure examples.** Include at least one "here's what doesn't work and why" per article. Readers trust writers who admit what fails, not just what succeeds. "We tried automated follow-up emails with no personalization — open rates were 8%. When we added the prospect's industry and specific pain point to the first line, open rates jumped to 31%."

**Specific tool configurations.** When recommending tools, include the specific settings, integrations, or configurations that make them work. "Use GoHighLevel's workflow builder to set a 5-minute delay after form submission, then trigger an SMS from a local number" — not "set up automated follow-ups in your CRM."

### Structure Requirements

Every article must have:

1. **A strong opening** (first 2-3 paragraphs): Start with a specific scenario, stat, or problem the reader recognizes. No throat-clearing. Hook them immediately.
2. **A StatHighlight early**: Data point within the first few scrolls that anchors credibility.
3. **Clear H2 sections**: These populate the Table of Contents sidebar. Make them scannable and descriptive.
4. **At least 2 MDX components**: Use StepByStep, ComparisonTable, Callout, etc. Plain text walls are not acceptable.
5. **1-2 CTACards**: Place at natural decision points (not just the end). Link to `/contact`, `/plan-builder`, or relevant service pages.
6. **Internal cross-links**: Link to other articles and service pages. Use relative paths: `[automating follow-up](/learn/automate-lead-follow-up)`.
7. **A clear conclusion**: Summarize the key takeaway and provide a next step.

### SEO Requirements

- **Title**: Include primary keyword naturally. 50-70 characters.
- **seoTitle**: Can differ from title — optimized for SERPs. Include year or brand if helpful.
- **seoDescription**: 150-160 characters. Include primary keyword. Write for click-through.
- **targetKeywords**: 2-4 keywords. Primary keyword first. These go into JSON-LD schema.
- **H2 headings**: Include secondary keywords where natural. Don't force it.
- **Internal linking**: Every article should link to 2-4 other articles or pages on the site.
- **Tags**: 3-6 relevant tags. Check existing tags first (`src/content/articles/`) to avoid near-duplicates (e.g., don't create both "AI chatbot" and "AI chatbots").

### Keyword Research Requirement

Before writing any article:

1. Search Google for the target keyword
2. Read the top 5-10 results
3. Identify what they all cover (the table stakes) and what they miss (the gaps)
4. Your article must cover the table stakes AND fill at least one gap
5. The gap you fill should be noted in the article planning (this is what makes the article worth publishing)

If every top result already says what you planned to say, rethink the article angle.

### What to Avoid

- Generic AI hype ("AI is revolutionizing everything!")
- Filler paragraphs that don't add value
- Overly promotional tone (the content itself builds trust — don't oversell)
- Walls of text without components or visual breaks
- Thin content (under 1,200 words)
- Duplicate topics — check existing articles first
- Identical openings across articles (no more "In today's competitive landscape...")
- Lists of benefits without evidence or specifics
- Hedging conclusions ("ultimately, the best choice depends on your needs") — take a position

---

## Editorial Review Checklist

Run this checklist before publishing. Every item must be answered honestly.

### The "Would I Send This?" Test

- [ ] **Does this teach something I couldn't learn from the first page of Google results?** If you search the target keyword and the top results say the same things, this article has no reason to exist.
- [ ] **Would I send this to a prospective client without embarrassment?** If it reads like generic content marketing, it fails. It should read like expert advice.
- [ ] **Is there at least one section where I'd say "I didn't know that"?** Even for a knowledgeable reader, the article should have a surprise or a new angle.
- [ ] **Does it sound like it was written by someone who does this work, or someone who writes about it?** The difference is specificity. Writers describe features. Operators describe configurations, results, and lessons.

### Quality Gate Checks

- [ ] Contains at least 1 original insight not found in top 10 Google results for the target keyword
- [ ] References at least 1 specific result from Accelerate's work with real numbers
- [ ] Industry articles demonstrate domain-specific knowledge (not transferable boilerplate)
- [ ] Uses a different structure from at least 2 of the last 3 published articles
- [ ] No boilerplate paragraphs — every paragraph says something specific

### Technical Checks

Run `npm run verify:articles` to automate all of these checks. The script validates every article in `src/content/articles/` and reports pass/fail per article with specific failures listed.

- [ ] Frontmatter has all required fields
- [ ] `category` and `pillar` are correctly paired
- [ ] `slug` matches the filename
- [ ] `date` is in `YYYY-MM-DD` format
- [ ] `tags` are 3-6 items, checked against existing tags for consistency
- [ ] Article uses at least 2 MDX components
- [ ] At least 1 CTACard is included
- [ ] Internal links to 2+ other articles or pages
- [ ] At least 1 reference to a case study (`/results/` link or case study name)
- [ ] No standalone "leads" language (use jobs, clients, appointments, etc.)
- [ ] `npm run verify:articles` — all articles pass
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Article renders correctly in local dev (`npm run dev`, visit `/learn/{slug}`)

---

## MDX Components

Import nothing — components are pre-registered. Just use them directly in your MDX content.

### StatHighlight

Large stat callout. Use near the top of the article to hook readers with data.

```mdx
<StatHighlight value="78%" label="of customers buy from the first company that responds" />
```

- `value`: The number/stat (string — include % or $ as needed)
- `label`: What the stat means

### Callout

Colored callout box for tips, warnings, or important notes.

```mdx
<Callout type="tip" title="The 80/20 Rule">
Let AI handle 80% of the drafting. Spend your effort on the 20% that makes it personal.
</Callout>
```

- `type`: `info` (blue), `warning` (amber), `tip` (gold), `important` (red)
- `title`: Optional heading

### StepByStep + Step

Numbered process walkthrough. Use for how-to sequences.

```mdx
<StepByStep>
  <Step number={1} title="Audit your current process">
    Document every manual step in your workflow...
  </Step>
  <Step number={2} title="Identify automation candidates">
    Look for tasks that are repetitive, rule-based, and time-consuming...
  </Step>
</StepByStep>
```

### ComparisonTable

Side-by-side comparison. Use for tool comparisons, before/after, feature matrices.

```mdx
<ComparisonTable
  headers={["Feature", "Tool A", "Tool B", "Tool C"]}
  rows={[
    ["Pricing", "$49/mo", "$97/mo", "$149/mo"],
    ["AI Features", "Basic", "Advanced", "Enterprise"],
    ["Best For", "Solopreneurs", "Small teams", "Agencies"],
  ]}
/>
```

### QuoteBlock

Testimonial or expert quote.

```mdx
<QuoteBlock
  quote="Since implementing the AI receptionist, we haven't missed a single after-hours call."
  author="Sarah Martinez"
  role="Owner, Martinez Plumbing"
/>
```

### CTACard

Inline call-to-action. Use 1-2 per article, placed at natural decision points.

```mdx
<CTACard
  title="Want us to build this for you?"
  description="We set up AI systems for businesses like yours every week."
  href="/contact"
  buttonText="Book a Free Consultation"
/>
```

Defaults: `href="/plan-builder"`, `buttonText="Get Started"`

CTA clicks are automatically tracked in Plausible (article slug, button text, destination).

### ToolRecommendation

Tool/product card with pricing info.

```mdx
<ToolRecommendation
  name="GoHighLevel"
  description="All-in-one CRM with built-in AI, SMS, email, and pipeline management."
  pricing="From $97/mo"
  bestFor="Service businesses wanting one platform for everything"
  link="https://gohighlevel.com"
/>
```

Outbound tool clicks are automatically tracked in Plausible.

### CodeBlock

Code snippets with syntax highlighting and copy button.

```mdx
<CodeBlock language="bash" title="Install the CLI">
npm install -g @accelerate/cli
</CodeBlock>
```

### VideoEmbed

Responsive video embed (YouTube/Vimeo).

```mdx
<VideoEmbed src="https://www.youtube.com/embed/VIDEO_ID" title="Demo walkthrough" />
```

---

## Analytics & Tracking

Every article automatically tracks:

- **Article Read** — fires on page load with slug, category, and funnel stage
- **Article Scroll 50%** — fires when reader scrolls halfway through the article
- **Article Scroll 100%** — fires when reader reaches the end
- **CTA Click** — fires on any CTACard click with article slug, button text, and destination
- **Outbound Tool Click** — fires on any ToolRecommendation link click with article slug and tool name

All events go to Plausible. Use the Plausible dashboard to see which articles actually get read (not just loaded), which CTAs convert, and which content drives business.

To debug events locally, enable Plausible debug mode by adding `?plausible_debug=true` to the URL (requires debug mode enabled in Plausible dashboard settings).

---

## Scheduling Articles

### To schedule new articles:

1. Pick topics that fill gaps in the current content calendar (see existing articles in `src/content/articles/`)
2. Choose categories/stages that balance the content mix
3. Set `date` fields spaced 2-3 days apart
4. Create the `.mdx` files with full frontmatter and content
5. Run the editorial checklist
6. Push to the repo
7. Articles appear automatically on their scheduled dates

### Current content mix (for reference):

| Category | Count target | Purpose |
|----------|-------------|---------|
| `foundational` | 15-20% | "What is X?" — attracts beginners, awareness stage |
| `lead-generation` | 15-20% | Client acquisition tactics — consideration/decision |
| `automation` | 15-20% | Workflow and process automation — awareness/consideration |
| `ai-tools` | 20-25% | Tool reviews and comparisons — high search intent |
| `industry` | 15-20% | Vertical-specific guides — targets niche searches |
| `local-seo` | 10-15% | Local search optimization — drives local traffic |

### Funnel stage balance:

- **Awareness** (40%): Educational, broad keyword targeting, top-of-funnel
- **Consideration** (45%): Comparisons, how-tos, mid-funnel — highest conversion potential
- **Decision** (15%): "Why us" / "how to choose" — bottom-of-funnel

---

## File Naming Convention

```
src/content/articles/{slug}.mdx
```

- Filename = slug (no `.mdx` in the slug itself)
- All lowercase, hyphens for word separation
- Keep slugs short but descriptive: `ai-for-accountants` not `how-artificial-intelligence-is-transforming-the-accounting-industry`
- The slug becomes the URL: `acceleratewith.us/learn/{slug}`

---

## Content Tooling

| Tool | Command / Path | Purpose |
|------|---------------|---------|
| Article verifier | `npm run verify:articles` | Automated pass/fail check for all articles (frontmatter, components, proof points, internal links, "leads" detection) |
| Proof points reference | `src/content/proof-points.ts` | Maps each case study (Farrell Roofing, SparkBlox, Montoya Capital) to relevant article categories with ready-to-use metrics and one-liner proof points |
| ArticleCTA component | `src/components/ArticleCTA.tsx` | Tracked page-level CTA — wraps Link+Button with Plausible `Page CTA Click` event |

Run `npm run verify:articles` before pushing any article. All 34 articles (published and scheduled) must pass.

---

## Architecture Notes

- **Date filtering**: `src/lib/mdx.ts` — `getAllArticles()` filters by `date <= today 23:59:59 UTC`
- **ISR**: All learn pages revalidate every 3600s (1 hour) via `export const revalidate = 3600`
- **RSS**: `src/app/learn/feed.xml/route.ts` — also has 1-hour cache
- **Sitemap**: `src/app/sitemap.ts` — regenerates on deploy, includes all published articles
- **SEO schemas**: `src/lib/seo.ts` — BlogPosting JSON-LD, breadcrumbs, WebSite schema
- **Analytics**: `src/lib/analytics.ts` — Plausible custom events via `trackEvent()`
- **Article tracking**: `src/components/ArticleTracker.tsx` — scroll depth and read tracking
- **Related articles**: Scored by shared category (+3), pillar (+2), tags (+1 each)
- **Tag pages**: Tags with <2 articles get `noindex` to avoid thin content penalties
- **MDX components**: `src/components/mdx/` — all registered in the slug page's `mdxComponents` object
