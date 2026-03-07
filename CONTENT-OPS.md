# Content Operations Playbook

## Checking Article Performance

1. Open Plausible dashboard
2. Go to **Pages** tab
3. Filter by `/learn/*` to see all article pages
4. Sort by visitors or unique visitors

### Key Metrics Per Article

| Metric | Where to Find | What It Means |
|--------|---------------|---------------|
| Page views | Plausible > Pages | Raw traffic |
| CTA Click rate | Goals > CTA Click (filter by page) | Content-to-action ratio |
| Plan Builder Started | Goals (filter by page prop) | High-intent conversion |
| Time on Page | Goals > Time on Page (filter by page) | Reader engagement |
| Scroll Depth | Goals > Scroll Depth (filter by page) | How far readers scroll |

## Content-to-Conversion Attribution

To see which articles drive plan builds:
1. Go to Plausible > Goals > `Plan Generated`
2. Click the goal to expand
3. Look at **Properties > page** to see the referring page
4. Cross-reference with **Entry Page** to see which articles are entry points

## CTA Placement Rules

Every article should have:
- **Mid-article CTA** (`<CTACard>`) at approximately 40% scroll depth
- **End-of-article CTA** (`<CTACard>`) after the conclusion
- CTAs should match the article's funnel stage:
  - Awareness: Link to another article or the learning hub
  - Consideration: Link to ROI calculator or website grader
  - Decision: Link to plan builder or contact page

## Monthly Review Process

### Top 5 Performing Articles
1. Sort articles by page views in Plausible
2. Check which ones drive the most conversions
3. Update with fresh data, new internal links, or expanded sections
4. Consider creating follow-up content on similar topics

### Bottom 5 to Optimize
1. Sort articles by page views (ascending)
2. Check if SEO titles and descriptions are compelling
3. Verify target keywords match search intent
4. Add internal links from higher-traffic pages
5. Consider updating the publish date if content is refreshed

## SEO Checklist Per Article

Before publishing any article:

- [ ] `seoTitle` is under 60 characters and includes primary keyword
- [ ] `seoDescription` is 150-160 characters and includes a call to action
- [ ] `targetKeywords` array has 2-5 relevant keywords
- [ ] At least 2 internal links to other articles or pages
- [ ] At least 1 external link to an authoritative source
- [ ] `excerpt` is compelling and under 200 characters
- [ ] Hero section has a clear value proposition
- [ ] CTACard placed at ~40% scroll and end of article
- [ ] `category` and `pillar` are correctly set
- [ ] `funnelStage` matches the content intent

## Scheduling Workflow

1. Create the MDX file in `src/content/articles/`
2. Set the `date` field to the desired publish date (YYYY-MM-DD)
3. The article will automatically appear when the date arrives (ISR, 1-hour revalidate)
4. No cron job needed — just set the date and forget it
5. To preview a scheduled article locally, it will show up in dev mode regardless of date

## UTM Tracking for Content Promotion

When sharing articles on social media or email:
- Always append UTM parameters to the URL
- Format: `?utm_source=SOURCE&utm_medium=MEDIUM&utm_campaign=CAMPAIGN`
- Examples:
  - Newsletter: `?utm_source=newsletter&utm_medium=email&utm_campaign=weekly-digest`
  - LinkedIn: `?utm_source=linkedin&utm_medium=social&utm_campaign=article-share`
  - Google Ads: `?utm_source=google&utm_medium=cpc&utm_campaign=learn-content`

These UTMs are captured automatically and attached to any conversion the visitor makes.
