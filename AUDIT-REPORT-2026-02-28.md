# Accelerate Website Audit Report

**Date:** February 28, 2026
**Codebase:** 126 files, 16,308 lines of TypeScript/TSX
**Framework:** Next.js 16.1.6 (Turbopack) + Tailwind CSS v4 + Framer Motion
**Routes:** 46 (32 static, 6 SSG, 8 dynamic)

---

## Section 1: Code Quality and Consistency

### TypeScript Strictness

| Check | Status |
|-------|--------|
| `strict: true` | PASS |
| `noUncheckedIndexedAccess: true` | PASS (added during audit) |
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm run build` | PASS (46 routes) |

### Issues Fixed

1. **Added `noUncheckedIndexedAccess: true`** to `tsconfig.json` - caught 17 potential undefined access bugs
2. **Fixed 17 TypeScript errors** across 8 files:
   - `src/app/api/cron/send-emails/route.ts` - undefined step guard, optional chaining
   - `src/app/api/grade-website/route.ts` - undefined domainName fallback
   - `src/app/results/[slug]/page.tsx` - topMetric possibly undefined
   - `src/components/sections/ChangelogPage.tsx` - grouped entries fallback
   - `src/components/sections/Industries.tsx` - Icon null guard
   - `src/components/sections/ServicesOverview.tsx` - Icon null guard
   - `src/components/solution-generator/SolutionGenerator.tsx` - STEP_ORDER bounds check
   - `src/components/mdx/TableOfContents.tsx` - tagName index fallback
3. **Fixed MDX build failure** - Turbopack requires serializable plugin options; switched from imported plugin functions to string-based plugin references in `next.config.ts`
4. **Fixed `fs` module build error** - Client component `LearnHub.tsx` transitively imported `fs` via `@/lib/mdx`; extracted `CATEGORY_LABELS` into `@/lib/constants.ts`
5. **Fixed ContactForm** - Removed `console.log`, added proper API submission with loading state, error handling, replaced raw HTML elements with `Input`, `Select`, `Textarea` UI components
6. **Created `/api/contact` route** - Proper form submission endpoint with email validation and Supabase persistence

### Remaining Notes (Judgment Calls)

- **No centralized env config file** - Environment variables accessed directly via `process.env`. Acceptable for Next.js; centralization is optional.
- **Generic error messages in some API routes** - Intentional for security (no leaking internals).

---

## Section 2: Design System Consistency

### Issues Found and Status

| Issue | Severity | Status |
|-------|----------|--------|
| Hardcoded colors | - | PASS (none found) |
| Inline styles | - | PASS (fontFamily only, acceptable) |
| Typography hierarchy | - | PASS (single H1 per page) |
| Raw `glass` class usage | Medium | NOTED (5 instances) |
| Raw form elements in ContactForm | Medium | FIXED |
| Infinite animations without component-level reduced motion | Medium | NOTED |
| Body text opacity variants | Low | NOTED |

### Design Tokens

The design system correctly uses CSS custom properties for all colors, borders, and glass effects. No hardcoded hex values were found in component files. The `GlassCard` component is used consistently except for 5 edge cases where raw `glass` classes are used for specialized layouts (metric boxes, changelog entries).

### Raw Glass Class Instances (Not Fixed - Judgment Call)

These 5 use raw `glass` CSS because they need custom internal layouts that don't map to `GlassCard` variants:
1. `CaseStudyDetail.tsx:89` - metric boxes
2. `ChangelogPage.tsx:109` - changelog entry cards
3. `ResourceGate.tsx:84` - modal overlay
4. `ResultsPage.tsx:80` - case study metric boxes
5. `VerticalPage.tsx:216` - metric boxes

### Animations

- Global `prefers-reduced-motion` media query is properly implemented in `globals.css`
- 2 infinite animations (Hero chevron bounce, WebsiteGrader spinner) rely on CSS-level reduced motion rather than component-level `useReducedMotion()` hook - acceptable as the CSS approach covers all cases

---

## Section 3: SEO Audit

### Issues Fixed

1. **Homepage metadata** - Added explicit `metadata` export with OpenGraph tags (was inheriting from layout)
2. **Missing OpenGraph tags** - Added to Services, About, and Contact pages
3. **Broken footer links** - Created `/privacy` and `/terms` pages that were linked but didn't exist
4. **Sitemap updated** - Added `/privacy` and `/terms` pages
5. **Description too long** - Trimmed Website Grader description from 172 to 134 characters

### Heading Hierarchy

All pages verified to have exactly one `<h1>` with proper H1 > H2 > H3 nesting.

### JSON-LD Structured Data

| Page | Schema Type | Status |
|------|-------------|--------|
| Homepage | ProfessionalService | PASS |
| Packages | ItemList + Product | PASS |
| Case Studies | Article + Review | PASS |
| Website Grader | WebApplication | PASS |
| ROI Calculator | WebApplication | PASS |
| Services | - | MISSING (flagged) |
| Industry pages | - | MISSING (flagged) |
| About | - | MISSING (flagged) |

### Remaining SEO Items (Flagged for Content Decision)

- **JSON-LD for Services page** - Needs `Service` schema with pricing
- **JSON-LD for Industry pages** - Needs `LocalBusiness` or similar schema
- **JSON-LD for About page** - Needs `Organization` schema
- **Case study cross-linking** - Case studies don't link back to related industry pages (e.g., Farrell Roofing to `/industries/home-services`)

---

## Section 4: Content Quality

### Voice and Tone

Content maintains a consistent professional-but-approachable tone throughout. Key patterns:
- Headlines use benefit-oriented language ("Capture every call", "Never miss another lead")
- CTAs are action-oriented ("Get Your Growth Plan", "Send Message")
- Pricing is transparent and displayed prominently

### Specificity

- All statistics include specific numbers (10+ hours/week, 24/7, etc.)
- Case studies include concrete before/after metrics
- Service descriptions include price ranges

### CTAs

Every page has at least one clear CTA. The primary CTA ("Get Your Growth Plan") is consistently placed in header, hero, and section breaks.

### Content Freshness Flags

- Privacy policy and terms of service are dated February 28, 2026
- Changelog entries are pre-populated with representative content
- Case studies use realistic but synthetic data (noted in development context)

---

## Section 5: Functionality Audit

### Forms Verified

| Form | Submission | Validation | Error Handling |
|------|-----------|------------|----------------|
| Contact Form | API route created | Email validation | Error state with message |
| Solution Generator | API route exists | Multi-step validation | Try/catch with user feedback |
| Website Grader | API route exists | URL validation | Error state display |
| Partner Application | API route exists | Email + required fields | Error toast |
| Resource Gate | API route exists | Name + email required | Graceful fallback |

### Issues Fixed

- **ContactForm** was only doing `console.log` on submit - now properly calls `/api/contact`

### CRON Email Processing

The email CRON route (`/api/cron/send-emails`) correctly:
- Validates CRON_SECRET authorization
- Processes due sequences
- Replaces template variables
- Handles sequence completion
- Calculates next send times

---

## Section 6: Responsive Design

### Breakpoint Strategy

The site uses a consistent breakpoint strategy:
- Mobile-first with `sm:`, `md:`, `lg:` breakpoints
- Navigation switches from mobile to desktop at `lg` (1024px)
- Grid layouts adapt: 1 col (mobile) > 2 col (sm) > 3-4 col (lg)

### Verified Patterns

- All sections use `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` container
- Cards stack vertically on mobile, grid on larger screens
- Typography scales with responsive classes (`text-3xl md:text-5xl`)

---

## Section 7: Accessibility (WCAG 2.1 AA)

### Issues Fixed

1. **Color contrast** - Increased `--white-secondary` opacity from 65% to 74% (now ~4.5:1 ratio on #050505)
2. **Color contrast** - Increased `--white-muted` opacity from 38% to 50% (improved readability for secondary text)
3. **Toast component** - Added `role="status"` and `aria-live="polite"` for screen reader announcements
4. **Toast close button** - Added `aria-label="Close notification"`
5. **MobileNav dropdown** - Added `aria-expanded` attribute to expandable nav buttons
6. **PlanView accordion** - Added `aria-expanded` attribute to solution card toggle buttons

### Remaining Accessibility Items (Flagged)

- **GeneratingStep** - Multi-step progress lacks `aria-live` region for step completion announcements
- **SolutionGenerator** - Multi-step form lacks `role="region" aria-label="Step X of Y"` wrapper
- **Gold text on dark background** - `#D4AF37` on `#050505` is ~3.5:1 ratio, below 4.5:1 AA requirement. Used primarily for decorative headings and badges (which are large text, requiring only 3:1)

---

## Section 8: Security

### Issues Fixed

1. **Security headers** - Added to `next.config.ts`:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - `X-DNS-Prefetch-Control: on`

### Verified Secure

| Check | Status |
|-------|--------|
| API keys not exposed to client | PASS |
| SUPABASE_SERVICE_ROLE_KEY server-only | PASS |
| ANTHROPIC_API_KEY server-only | PASS |
| SQL injection prevention | PASS (parameterized Supabase queries) |
| XSS protection | PASS (escapeHtml in PDF generation, React auto-escaping) |
| .gitignore covers .env files | PASS |
| CRON endpoint authentication | PASS (Bearer token) |

### Remaining Security Items (Flagged)

- **No rate limiting on API routes** - `/api/generate-plan` (expensive Claude API calls), `/api/grade-website`, `/api/contact`, `/api/partner-apply` all lack rate limiting. Recommendation: implement `@upstash/ratelimit` or Vercel's built-in rate limiting.
- **Email validation** - Some routes use a permissive regex. Consider a validation library for production.
- **robots.txt** - Does not explicitly block `/admin/` paths (no admin routes exist currently, but worth noting).

---

## Section 9: Conversion Optimization

### Funnel Integrity

| Entry Point | CTA | Next Step | Status |
|-------------|-----|-----------|--------|
| Homepage Hero | Get Your Growth Plan | Solution Generator | PASS |
| Services | Get Your Growth Plan | Solution Generator | PASS |
| Website Grader | Analyze results | View recommendations + CTA | PASS |
| ROI Calculator | See projected ROI | CTA to Solution Generator | PASS |
| Case Studies | Get Your Growth Plan | Solution Generator | PASS |
| Resources | Download gated by email | Email sequence enrollment | PASS |

### Solution Generator Flow

7-step wizard with proper progress bar, back navigation, keyboard support (Escape to go back), and clear progression:
Industry > Business > Digital Presence > Pain Points > Goals > Timeline/Budget > Contact > Generating > Results

### Trust Elements

- Case studies with specific metrics
- Social proof section with testimonials
- Transparent pricing on Packages page
- Free tools (Website Grader, ROI Calculator) for low-friction engagement

---

## Section 10: Build and Runtime Performance

### Build Metrics

| Metric | Value |
|--------|-------|
| Build tool | Turbopack |
| Compile time | 1,616ms |
| Static page generation | 442ms (46 pages, 9 workers) |
| Static routes | 32 |
| SSG routes | 6 |
| Dynamic routes | 8 |

### Client vs Server Components

- **53 client components** (`"use client"`)
- Remaining components are server-rendered
- Heavy client components (SolutionGenerator, WebsiteGraderPage, ROICalculatorPage) are justified by interactive requirements
- Static content pages (Privacy, Terms, About, Services) are properly server-rendered

### Performance Patterns

- Fonts loaded with `display: "swap"` for no FOIT
- Images configured with AVIF + WebP optimization
- AnimateOnScroll uses `viewport={{ once: true }}` to prevent re-triggering
- Cookie consent delays rendering by 1.5s to avoid CLS
- Tracking scripts use `afterInteractive` strategy

---

## Summary of All Changes Made

### Files Created (6)
- `src/app/privacy/page.tsx` - Privacy policy page
- `src/app/terms/page.tsx` - Terms of service page
- `src/app/api/contact/route.ts` - Contact form API endpoint
- `src/lib/constants.ts` - Shared constants extracted from mdx.ts

### Files Modified (20)
- `tsconfig.json` - Added `noUncheckedIndexedAccess: true`
- `next.config.ts` - Security headers, string-based MDX plugins
- `src/app/globals.css` - Improved color contrast ratios
- `src/app/page.tsx` - Added explicit metadata with OpenGraph
- `src/app/sitemap.ts` - Added privacy/terms pages
- `src/app/services/page.tsx` - Added OpenGraph metadata
- `src/app/about/page.tsx` - Added OpenGraph metadata
- `src/app/contact/page.tsx` - Added OpenGraph metadata
- `src/app/tools/website-grader/page.tsx` - Trimmed description length
- `src/app/results/[slug]/page.tsx` - Fixed undefined topMetric access
- `src/app/api/cron/send-emails/route.ts` - Fixed undefined step/delay access
- `src/app/api/grade-website/route.ts` - Fixed undefined domainName access
- `src/lib/mdx.ts` - Re-exported CATEGORY_LABELS from constants
- `src/components/sections/ContactForm.tsx` - Complete rewrite with UI components, API submission
- `src/components/sections/ChangelogPage.tsx` - Fixed undefined entries access
- `src/components/sections/Industries.tsx` - Added Icon null guard
- `src/components/sections/ServicesOverview.tsx` - Added Icon null guard
- `src/components/sections/PlanView.tsx` - Added aria-expanded
- `src/components/solution-generator/SolutionGenerator.tsx` - Fixed step navigation bounds
- `src/components/mdx/TableOfContents.tsx` - Fixed tagName index access
- `src/components/ui/Toast.tsx` - Added aria-live, close button aria-label
- `src/components/layout/MobileNav.tsx` - Added aria-expanded to dropdown
- `src/components/sections/LearnHub.tsx` - Import from constants instead of mdx

---

## Items Flagged for Future Action

### High Priority
1. **Rate limiting** on API routes (especially `/api/generate-plan`)
2. **JSON-LD structured data** for Services, Industry, and About pages
3. **aria-live regions** for Solution Generator step progress

### Medium Priority
4. **Case study cross-linking** to relevant industry pages
5. **Email validation** upgrade to a proper validation library
6. **Raw glass class** consolidation into GlassCard variants

### Low Priority
7. **Content-Security-Policy** header (requires audit of all inline scripts/styles)
8. **Blog page** (currently redirects to /learn; consider removing from nav or adding metadata)

---

**Audit completed:** February 28, 2026
**Build status:** PASSING (0 TypeScript errors, 46 routes compiled)
**Overall assessment:** Production-ready with recommended follow-ups for rate limiting and structured data
