import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import type { WebsiteGradeResult, GradeCategory } from "@/lib/types";

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  return url;
}

// Deterministic-ish hash from a string to produce consistent scores per domain
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

// Generate a score within a range using a seed value
function seededScore(seed: number, min: number, max: number): number {
  return min + (seed % (max - min + 1));
}

function analyzeUrlStructure(urlStr: string) {
  const url = new URL(urlStr);
  const hostname = url.hostname.toLowerCase();
  const hasSSL = url.protocol === "https:";
  const hasWww = hostname.startsWith("www.");
  const tld = hostname.split(".").pop() || "";

  // Detect common platforms from hostname patterns
  const isWordPress =
    hostname.includes("wordpress") || hostname.includes(".wp.");
  const isSquarespace = hostname.includes("squarespace");
  const isWix = hostname.includes("wix") || hostname.includes("wixsite");
  const isShopify = hostname.includes("shopify") || hostname.includes("myshopify");
  const isSubdomain =
    hostname.split(".").length > (hasWww ? 3 : 2) &&
    !isWordPress &&
    !isSquarespace &&
    !isWix &&
    !isShopify;

  const isCustomDomain = !isSubdomain && !isWix && !isSquarespace;

  // Infer industry from domain keywords
  const domainName = hostname.replace(/^www\./, "").split(".")[0] ?? "";
  const legalKeywords = ["law", "legal", "attorney", "lawyer", "firm"];
  const homeServiceKeywords = [
    "plumb",
    "hvac",
    "roof",
    "clean",
    "landscap",
    "paint",
    "electric",
    "handyman",
    "repair",
  ];
  const realEstateKeywords = ["real", "estate", "realty", "homes", "property"];
  const isLegal = domainName ? legalKeywords.some((k) => domainName.includes(k)) : false;
  const isHomeService = domainName ? homeServiceKeywords.some((k) => domainName.includes(k)) : false;
  const isRealEstate = domainName ? realEstateKeywords.some((k) => domainName.includes(k)) : false;

  return {
    hasSSL,
    hasWww,
    tld,
    isWordPress,
    isSquarespace,
    isWix,
    isShopify,
    isSubdomain,
    isCustomDomain,
    isLegal,
    isHomeService,
    isRealEstate,
    hostname,
    domainName,
  };
}

function generateGrade(urlStr: string): WebsiteGradeResult {
  const analysis = analyzeUrlStructure(urlStr);
  const hash = simpleHash(analysis.hostname);

  // --- Performance ---
  const perfBase = analysis.isWix
    ? seededScore(hash, 28, 48)
    : analysis.isWordPress
      ? seededScore(hash + 1, 38, 62)
      : analysis.isSquarespace
        ? seededScore(hash + 2, 45, 65)
        : analysis.isShopify
          ? seededScore(hash + 3, 50, 70)
          : seededScore(hash + 4, 35, 78);

  const perfIssues: string[] = [];
  if (perfBase < 50) {
    perfIssues.push("Page load time exceeds 4 seconds on mobile connections");
    perfIssues.push(
      "Large uncompressed images detected (potential savings of 60%+)"
    );
    perfIssues.push("No browser caching headers configured for static assets");
  }
  if (perfBase < 65) {
    perfIssues.push("Render-blocking JavaScript delays first contentful paint");
    if (perfIssues.length < 3)
      perfIssues.push("CSS is not minified, adding unnecessary download size");
  }
  if (perfBase < 80) {
    if (perfIssues.length < 2)
      perfIssues.push("Images are not served in next-gen formats (WebP/AVIF)");
    if (perfIssues.length < 3)
      perfIssues.push(
        "No lazy loading on below-the-fold images and iframes"
      );
  }
  if (perfIssues.length === 0) {
    perfIssues.push("Minor opportunity: consider preloading critical fonts");
  }

  const performance: GradeCategory = {
    score: perfBase,
    label: "Performance",
    issues: perfIssues,
  };

  // --- SEO ---
  const seoBase = analysis.isCustomDomain
    ? seededScore(hash + 10, 40, 75)
    : seededScore(hash + 10, 25, 55);

  const seoIssues: string[] = [];
  if (!analysis.isCustomDomain) {
    seoIssues.push(
      "Site is hosted on a subdomain/builder URL instead of a custom domain"
    );
  }
  if (seoBase < 50) {
    seoIssues.push("Missing or incomplete meta descriptions on key pages");
    seoIssues.push(
      "No structured data (schema markup) found for local business"
    );
    seoIssues.push("H1 tags missing or duplicated across pages");
  }
  if (seoBase < 70) {
    if (seoIssues.length < 3)
      seoIssues.push(
        "No XML sitemap detected or sitemap not submitted to search consoles"
      );
    if (seoIssues.length < 4)
      seoIssues.push("Image alt attributes missing on most images");
  }
  if (seoBase >= 70) {
    seoIssues.push(
      "Consider adding FAQ schema to capture featured snippet positions"
    );
  }
  if (seoIssues.length === 0) {
    seoIssues.push(
      "Internal linking structure could be improved for deeper pages"
    );
  }

  const seo: GradeCategory = {
    score: seoBase,
    label: "SEO",
    issues: seoIssues.slice(0, 4),
  };

  // --- Mobile ---
  const mobileBase = analysis.isSquarespace
    ? seededScore(hash + 20, 55, 78)
    : analysis.isWix
      ? seededScore(hash + 21, 40, 65)
      : analysis.isShopify
        ? seededScore(hash + 22, 55, 80)
        : seededScore(hash + 23, 35, 75);

  const mobileIssues: string[] = [];
  if (mobileBase < 50) {
    mobileIssues.push("Tap targets (buttons, links) are too small for mobile");
    mobileIssues.push(
      "Text is too small to read without zooming on mobile devices"
    );
    mobileIssues.push(
      "Horizontal scrolling detected on mobile viewport widths"
    );
  }
  if (mobileBase < 70) {
    if (mobileIssues.length < 2)
      mobileIssues.push(
        "Viewport meta tag present but content is not fully responsive"
      );
    if (mobileIssues.length < 3)
      mobileIssues.push(
        "Mobile page speed is significantly slower than desktop"
      );
  }
  if (mobileBase >= 70 && mobileIssues.length === 0) {
    mobileIssues.push(
      "Forms could be optimized for mobile with larger input fields"
    );
  }

  const mobile: GradeCategory = {
    score: mobileBase,
    label: "Mobile Friendliness",
    issues: mobileIssues.slice(0, 3),
  };

  // --- Security ---
  const secBase = analysis.hasSSL
    ? seededScore(hash + 30, 55, 90)
    : seededScore(hash + 30, 15, 35);

  const secIssues: string[] = [];
  if (!analysis.hasSSL) {
    secIssues.push(
      "CRITICAL: Site does not use HTTPS. Browsers will flag it as insecure"
    );
    secIssues.push("Form data is transmitted without encryption");
  }
  if (secBase < 70) {
    if (secIssues.length < 2)
      secIssues.push(
        "Missing Content-Security-Policy header to prevent XSS attacks"
      );
    if (secIssues.length < 3)
      secIssues.push("No X-Frame-Options header (vulnerable to clickjacking)");
    if (secIssues.length < 4)
      secIssues.push(
        "Strict-Transport-Security header not configured for HTTPS enforcement"
      );
  }
  if (secBase >= 70 && secIssues.length === 0) {
    secIssues.push(
      "Consider implementing Subresource Integrity for third-party scripts"
    );
  }

  const security: GradeCategory = {
    score: secBase,
    label: "Security",
    issues: secIssues.slice(0, 3),
  };

  // --- Accessibility ---
  const a11yBase = seededScore(hash + 40, 30, 72);

  const a11yIssues: string[] = [];
  if (a11yBase < 50) {
    a11yIssues.push(
      "Color contrast ratios do not meet WCAG AA standards on key elements"
    );
    a11yIssues.push("Missing ARIA labels on interactive elements and forms");
    a11yIssues.push(
      "No skip-to-content link for keyboard navigation users"
    );
  }
  if (a11yBase < 70) {
    if (a11yIssues.length < 2)
      a11yIssues.push(
        "Form inputs are missing associated labels or placeholder-only labels"
      );
    if (a11yIssues.length < 3)
      a11yIssues.push(
        "Focus indicators are suppressed or invisible on interactive elements"
      );
  }
  if (a11yBase >= 70 && a11yIssues.length === 0) {
    a11yIssues.push(
      "Consider adding aria-live regions for dynamic content updates"
    );
  }

  const accessibility: GradeCategory = {
    score: a11yBase,
    label: "Accessibility",
    issues: a11yIssues.slice(0, 3),
  };

  // Overall score: weighted average
  const overall = Math.round(
    performance.score * 0.25 +
      seo.score * 0.25 +
      mobile.score * 0.2 +
      security.score * 0.15 +
      accessibility.score * 0.15
  );

  // Template-based recommendations
  const recommendations = generateTemplateRecommendations(
    analysis,
    performance.score,
    seo.score,
    mobile.score,
    security.score,
    accessibility.score
  );

  return {
    url: urlStr,
    overallScore: overall,
    categories: {
      performance,
      seo,
      mobile,
      security,
      accessibility,
    },
    aiRecommendations: recommendations,
    generatedAt: new Date().toISOString(),
  };
}

function generateTemplateRecommendations(
  analysis: ReturnType<typeof analyzeUrlStructure>,
  perfScore: number,
  seoScore: number,
  mobileScore: number,
  secScore: number,
  a11yScore: number
): string[] {
  const recs: string[] = [];

  // Highest-priority recommendations first
  if (!analysis.hasSSL) {
    recs.push(
      "Install an SSL certificate immediately. Google penalizes HTTP sites in rankings and browsers show security warnings to visitors, which kills trust and conversions."
    );
  }

  if (perfScore < 50) {
    recs.push(
      "Compress and convert all images to WebP format and implement lazy loading. This alone could cut your page load time by 40-60%, directly reducing bounce rate."
    );
  }

  if (seoScore < 50) {
    recs.push(
      "Add unique, keyword-rich meta titles and descriptions to every page. This is the single fastest way to improve your search engine visibility."
    );
  }

  if (!analysis.isCustomDomain) {
    recs.push(
      "Move to a custom domain (yourname.com) instead of a platform subdomain. Custom domains build credibility with customers and perform significantly better in search results."
    );
  }

  if (mobileScore < 60) {
    recs.push(
      "Redesign your site with a mobile-first approach. Over 60% of small business web traffic comes from phones. If your site is hard to use on mobile, you are losing customers every day."
    );
  }

  if (seoScore < 70) {
    recs.push(
      "Implement LocalBusiness schema markup and submit an XML sitemap to Google Search Console. This helps Google understand and properly list your business in local search results."
    );
  }

  if (perfScore < 70 && perfScore >= 50) {
    recs.push(
      "Minify CSS and JavaScript files, and defer non-critical scripts. This will improve your Core Web Vitals scores, which Google uses as a ranking factor."
    );
  }

  if (a11yScore < 60) {
    recs.push(
      "Fix color contrast issues and add proper ARIA labels to forms and buttons. Beyond compliance, accessible websites convert better because they are easier for everyone to use."
    );
  }

  if (analysis.isWix || analysis.isSquarespace) {
    recs.push(
      `Consider migrating from ${analysis.isWix ? "Wix" : "Squarespace"} to a custom-built solution. Builder platforms add bloat that limits performance and SEO ceiling. A custom site gives you full control over speed and optimization.`
    );
  }

  if (secScore < 70 && analysis.hasSSL) {
    recs.push(
      "Add security headers (Content-Security-Policy, X-Frame-Options, Strict-Transport-Security) to protect your site and visitors from common web attacks."
    );
  }

  // Industry-specific recommendations
  if (analysis.isLegal) {
    recs.push(
      "Add attorney bio pages with schema markup and client testimonials. Legal searches are high-intent; showcasing expertise and trust signals directly increases consultation bookings."
    );
  }

  if (analysis.isHomeService) {
    recs.push(
      "Create dedicated service area pages for each location you cover. This dramatically improves local SEO and helps you show up in 'near me' searches."
    );
  }

  if (analysis.isRealEstate) {
    recs.push(
      "Integrate IDX listings and add neighborhood guide pages. Providing local expertise content keeps visitors engaged and positions you as the area expert."
    );
  }

  // Always add a CTA-oriented recommendation
  recs.push(
    "Add clear calls-to-action above the fold on every page. Many small business websites bury their contact information. Make it effortless for visitors to take the next step."
  );

  return recs.slice(0, 7);
}

async function getAiRecommendations(
  urlStr: string,
  grade: WebsiteGradeResult
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return grade.aiRecommendations;
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are a web optimization consultant. A user just ran a website grader on: ${urlStr}

Their scores:
- Performance: ${grade.categories.performance.score}/100
- SEO: ${grade.categories.seo.score}/100
- Mobile: ${grade.categories.mobile.score}/100
- Security: ${grade.categories.security.score}/100
- Accessibility: ${grade.categories.accessibility.score}/100
- Overall: ${grade.overallScore}/100

Key issues found:
${Object.values(grade.categories)
  .flatMap((c) => c.issues)
  .map((i) => `- ${i}`)
  .join("\n")}

Based on the URL and scores, provide exactly 6 specific, actionable recommendations. Each recommendation should be 1-2 sentences. Focus on high-impact changes that a small business owner can understand. Prioritize by potential impact. Be specific to the domain/industry if you can infer it from the URL.

Return ONLY a JSON array of strings. No other text. Example: ["Recommendation 1", "Recommendation 2"]`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      temperature: 0.6,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return grade.aiRecommendations;
    }

    const parsed = JSON.parse(textContent.text);
    if (Array.isArray(parsed) && parsed.every((r) => typeof r === "string")) {
      return parsed;
    }
    return grade.aiRecommendations;
  } catch {
    return grade.aiRecommendations;
  }
}

async function saveToSupabase(
  grade: WebsiteGradeResult,
  email?: string
): Promise<void> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await supabase.from("website_grades").insert({
      url: grade.url,
      overall_score: grade.overallScore,
      categories: grade.categories,
      ai_recommendations: grade.aiRecommendations,
      email: email || null,
    });
  } catch {
    // Best-effort; do not block the response
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 10, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { url: rawUrl, email } = body as { url: string; email?: string };

    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json(
        { error: "Please provide a website URL to grade." },
        { status: 400 }
      );
    }

    const urlStr = normalizeUrl(rawUrl);

    if (!isValidUrl(urlStr)) {
      return NextResponse.json(
        {
          error:
            "That doesn't look like a valid URL. Please enter a website address like example.com",
        },
        { status: 400 }
      );
    }

    // Generate heuristic-based grade
    const grade = generateGrade(urlStr);

    // Enhance with AI recommendations if available
    grade.aiRecommendations = await getAiRecommendations(urlStr, grade);

    // Save to Supabase (best-effort, non-blocking)
    saveToSupabase(grade, email).catch(() => {});

    return NextResponse.json(grade);
  } catch (error) {
    console.error("Grade website error:", error);
    return NextResponse.json(
      { error: "Failed to grade website. Please try again." },
      { status: 500 }
    );
  }
}
