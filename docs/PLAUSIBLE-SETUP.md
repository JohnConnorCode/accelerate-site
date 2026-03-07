# Plausible Dashboard Setup Guide

## Prerequisites

- Plausible account with `acceleratewith.us` site configured
- Admin access to Plausible dashboard

## Step 1: Create Goals

Go to **Settings > Goals** in Plausible and add each of these custom event goals:

### Conversion Goals (14 total)

| # | Goal Name | Description |
|---|-----------|-------------|
| 1 | `Plan Builder Started` | User begins the plan builder flow |
| 2 | `Plan Builder Step` | User advances through a step |
| 3 | `Plan Generated` | AI plan fully generated (high-value) |
| 4 | `Contact Form Submitted` | Contact form completed |
| 5 | `Website Graded` | Website grader analysis run |
| 6 | `Website Grade Email Captured` | Email captured after grading |
| 7 | `Resource Downloaded` | Lead magnet downloaded |
| 8 | `Newsletter Subscribed` | Newsletter signup |
| 9 | `ROI Calculated` | ROI calculator used |
| 10 | `ROI Email Captured` | Email captured from ROI calculator |
| 11 | `Partner Applied` | Partner application submitted |
| 12 | `Chat Lead Captured` | Chat widget lead captured |
| 13 | `Package Selected` | User clicks a package CTA |
| 14 | `CTA Click` | Generic CTA button click |

### Engagement Goals (2 total)

| # | Goal Name | Description |
|---|-----------|-------------|
| 15 | `Scroll Depth` | Tracks 25/50/75/100% scroll (prop: `depth`) |
| 16 | `Time on Page` | Tracks 15/30/60s engagement (prop: `seconds`) |

## Step 2: Create Funnels

Go to **Settings > Funnels** and create:

### Plan Builder Funnel
1. `Plan Builder Started`
2. `Plan Builder Step`
3. `Plan Generated`

### Website Grader Funnel
1. `Website Graded`
2. `Website Grade Email Captured`

### ROI Calculator Funnel
1. `ROI Calculated`
2. `ROI Email Captured`

## Step 3: Revenue Goals

Tag these goals for revenue tracking:
- `Plan Generated`
- `Package Selected`

## Step 4: Custom Properties

All conversion events automatically include these custom properties:
- `page` — the page where the conversion happened
- `utm_source` — marketing source (e.g., google, facebook, email)
- `utm_medium` — marketing medium (e.g., cpc, social, newsletter)

Use **Filter > Properties** in the Plausible dashboard to analyze conversions by source.

## Step 5: API Key

1. Go to **Settings > Visibility > API Keys**
2. Create a new API key with read-only access
3. Add to Vercel env vars as `PLAUSIBLE_API_KEY`
4. Add to `.env.local` for local dev

## Verification

After setup:
1. Visit the site and trigger a conversion (e.g., use the ROI calculator)
2. Check Plausible Goals dashboard within a few minutes
3. Verify the event shows up with correct properties
4. Check admin dashboard (`/admin`) — PlausibleWidget should show data
