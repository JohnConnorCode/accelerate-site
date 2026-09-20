import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { WebsiteAudit, WebsiteAuditCategory, WebsiteAuditFinding } from "@/lib/ai-readiness";

const MAX_HTML_BYTES = 400_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8_000;

function emptyAudit(url: string, status: WebsiteAudit["status"], summary: string): WebsiteAudit {
  return {
    url,
    checkedAt: new Date().toISOString(),
    status,
    score: null,
    summary,
    categories: [],
    findings: [],
    note: "This is a surface audit of the public homepage. It does not run Lighthouse, crawl the site, or inspect private systems.",
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function attr(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1]?.trim() || "";
}

function textContent(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|quot|lt|gt);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function privateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 4) {
    const parts = normalized.split(".").map(Number);
    const [a = 0, b = 0] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

async function publicUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (
    !/^https?:$/.test(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    (parsed.port && !["80", "443"].includes(parsed.port))
  )
    return null;
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    privateAddress(hostname)
  )
    return null;
  try {
    const addresses = await lookup(hostname, { all: true });
    if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) return null;
  } catch {
    return null;
  }
  return parsed;
}

async function readHtml(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total <= MAX_HTML_BYTES) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_HTML_BYTES) return null;
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function category(
  key: WebsiteAuditCategory["key"],
  label: string,
  score: number,
  summary: string,
): WebsiteAuditCategory {
  return { key, label, score: clamp(score), summary };
}

function analyze(
  url: string,
  finalUrl: string,
  statusCode: number,
  html: string,
  headers: Headers,
): WebsiteAudit {
  const title =
    html
      .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/\s+/g, " ")
      .trim() || "";
  const description =
    html
      .match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)?.[1]
      ?.trim() || "";
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || "";
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const images = html.match(/<img\b[^>]*>/gi) || [];
  const imagesWithAlt = images.filter((image) => attr(image, "alt")).length;
  const inputs = html.match(/<(?:input|textarea|select)\b[^>]*>/gi) || [];
  const labels = html.match(/<label\b/gi) || [];
  const scripts = html.match(/<script\b/gi) || [];
  const stylesheets = html.match(/<link[^>]+rel=["'][^"']*stylesheet/gi) || [];
  const textLength = textContent(html).length;
  const hasViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);
  const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html);
  const hasOpenGraph = /<meta[^>]+property=["']og:/i.test(html);
  const hasStructuredData = /application\/ld\+json/i.test(html);
  const hasCta =
    /\b(?:get started|book|contact|schedule|request|learn more|buy|shop|call us|free consultation)\b/i.test(
      textContent(html),
    );
  const hasContact = /(?:mailto:|tel:|\bcontact\b|\bget in touch\b)/i.test(html);
  const hasPolicies = /\b(?:privacy|terms|cookie policy)\b/i.test(textContent(html));
  const https = new URL(finalUrl).protocol === "https:";
  const securityHeaders =
    Number(Boolean(headers.get("strict-transport-security"))) +
    Number(Boolean(headers.get("content-security-policy"))) +
    Number(Boolean(headers.get("x-content-type-options")));
  const altCoverage = images.length ? imagesWithAlt / images.length : 1;
  const labelCoverage = inputs.length ? Math.min(1, labels.length / inputs.length) : 1;
  const imageSummary = images.length
    ? `${imagesWithAlt}/${images.length} images have alt text`
    : "No images found";
  const inputSummary = inputs.length
    ? `${labels.length}/${inputs.length} form controls have nearby labels`
    : "No form controls found";

  const categories = [
    category(
      "performance",
      "Performance signals",
      100 -
        (html.length > 160_000 ? 30 : html.length > 90_000 ? 15 : 0) -
        (scripts.length > 16 ? 25 : scripts.length > 10 ? 12 : 0) -
        (stylesheets.length > 8 ? 15 : 0),
      `${Math.round(html.length / 1024)} KB HTML, ${scripts.length} scripts, ${stylesheets.length} stylesheets.`,
    ),
    category(
      "seo",
      "Search foundations",
      Number(Boolean(title)) * 20 +
        Number(title.length >= 10 && title.length <= 60) * 10 +
        Number(Boolean(description)) * 15 +
        Number(description.length >= 80) * 5 +
        Number(h1Count === 1) * 15 +
        Number(hasCanonical) * 10 +
        Number(hasOpenGraph) * 10 +
        Number(hasStructuredData) * 5 +
        Number(textLength > 500) * 10,
      `${title ? "Title found" : "No title found"}; ${description ? "description found" : "no description"}; ${h1Count} H1 headings.`,
    ),
    category(
      "mobile",
      "Mobile foundation",
      Number(hasViewport) * 70 + Number(/max-width|flex|grid|@media/i.test(html)) * 30,
      hasViewport
        ? "Viewport is declared; responsive patterns are present in the page markup."
        : "No viewport declaration was found in the homepage HTML.",
    ),
    category(
      "accessibility",
      "Accessibility signals",
      Number(Boolean(attr(htmlTag, "lang"))) * 20 +
        Number(h1Count === 1) * 15 +
        Math.round(altCoverage * 35) +
        Math.round(labelCoverage * 20) +
        Number(/<button\b[^>]*>[^<]+<\/button>/i.test(html)) * 10,
      `${imageSummary}; ${inputSummary}.`,
    ),
    category(
      "conversion",
      "Conversion clarity",
      Number(hasCta) * 35 +
        Number(hasContact) * 20 +
        Number(inputs.length > 0) * 20 +
        Number(/<a\b/gi.test(html)) * 15 +
        Number(textLength > 700) * 10,
      hasCta
        ? "A primary action is visible in the homepage copy."
        : "No clear primary action was detected in the homepage copy.",
    ),
    category(
      "trust",
      "Trust and security",
      Number(https) * 35 +
        Number(hasPolicies) * 20 +
        Number(hasContact) * 20 +
        securityHeaders * 8 +
        Number(/testimonial|case stud|client|reviews?/i.test(textContent(html))) * 10,
      `${https ? "HTTPS" : "HTTP only"}; ${hasPolicies ? "policy links" : "no policy language"}; ${securityHeaders}/3 basic security headers detected.`,
    ),
  ];
  const findings: WebsiteAuditFinding[] = [];
  const add = (finding: WebsiteAuditFinding) => findings.push(finding);
  if (!https)
    add({
      severity: "priority",
      category: "Trust",
      title: "Move the public site to HTTPS",
      detail:
        "The homepage was fetched over HTTP, which weakens visitor trust and browser security.",
      action:
        "Redirect every public URL to HTTPS and verify certificates before improving conversion flows.",
    });
  if (!title || title.length < 10)
    add({
      severity: "priority",
      category: "SEO",
      title: "Give the homepage a specific title",
      detail:
        "Search engines and shared links need a clear page title that says what the business does and where it operates.",
      action:
        "Write one concise title with the service, audience, and location when location matters.",
    });
  if (!description || description.length < 80)
    add({
      severity: "improvement",
      category: "SEO",
      title: "Add a useful meta description",
      detail: "The homepage does not expose a strong search-result summary in its HTML.",
      action:
        "Add a plain-language description that sets an accurate expectation for the next step.",
    });
  if (!hasViewport)
    add({
      severity: "priority",
      category: "Mobile",
      title: "Add a mobile viewport",
      detail:
        "Without a viewport declaration, mobile browsers may render the page at a desktop layout width.",
      action:
        "Add a responsive viewport declaration and test the primary path on a real phone width.",
    });
  if (images.length && altCoverage < 0.8)
    add({
      severity: "improvement",
      category: "Accessibility",
      title: "Describe informative images",
      detail: `${images.length - imagesWithAlt} of ${images.length} detected images are missing alt text.`,
      action: "Add concise alt text to informative images and mark decorative images explicitly.",
    });
  if (h1Count !== 1)
    add({
      severity: "improvement",
      category: "SEO",
      title: `Use one clear H1 (found ${h1Count})`,
      detail:
        "A single descriptive H1 gives people and assistive technology a reliable page starting point.",
      action: "Make the primary page promise one H1 and use lower headings for sections.",
    });
  if (!hasCta || !hasContact)
    add({
      severity: "priority",
      category: "Conversion",
      title: "Make the next step unmistakable",
      detail:
        "The homepage does not expose both a clear action and an obvious way to contact the business.",
      action:
        "Choose one primary action and repeat it near the promise, proof, and end of the page.",
    });
  if (scripts.length > 16 || html.length > 160_000)
    add({
      severity: "improvement",
      category: "Performance",
      title: "Trim the initial page payload",
      detail: `The homepage contains ${Math.round(html.length / 1024)} KB of HTML and ${scripts.length} script tags before deeper performance testing.`,
      action:
        "Remove unused scripts, defer nonessential embeds, and measure the critical path with Lighthouse.",
    });
  if (hasPolicies && https && h1Count === 1 && hasViewport && hasCta)
    add({
      severity: "strength",
      category: "Foundation",
      title: "The homepage has a usable baseline",
      detail:
        "HTTPS, a mobile viewport, a single H1, policy language, and a visible action were detected.",
      action: "Preserve these foundations while improving the lowest-scoring category.",
    });
  findings.sort(
    (a, b) =>
      ({ priority: 0, improvement: 1, strength: 2 })[a.severity] -
      { priority: 0, improvement: 1, strength: 2 }[b.severity],
  );
  const score = clamp(categories.reduce((sum, item) => sum + item.score, 0) / categories.length);
  return {
    url,
    finalUrl,
    checkedAt: new Date().toISOString(),
    status: "completed",
    statusCode,
    score,
    summary: `The homepage scored ${score}/100 on visible foundations. ${findings.filter((finding) => finding.severity === "priority").length} priority issue${findings.filter((finding) => finding.severity === "priority").length === 1 ? "" : "s"} deserve attention before adding more automation.`,
    categories,
    findings: findings.slice(0, 8),
    note: "This is a surface audit of the public homepage. It uses HTML and response signals; it is not a Lighthouse performance test or a full site crawl.",
  };
}

export async function auditWebsite(rawUrl?: string): Promise<WebsiteAudit | null> {
  const url = rawUrl?.trim();
  if (!url) return null;
  const initialUrl = await publicUrl(url);
  if (!initialUrl)
    return emptyAudit(
      url,
      "blocked",
      "This URL could not be checked safely. Use a public http:// or https:// homepage URL.",
    );
  let current: URL = initialUrl;
  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "AI-Readiness-Audit/1.0",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        const next = location ? await publicUrl(new URL(location, current).href) : null;
        if (!next || redirect === MAX_REDIRECTS)
          return emptyAudit(
            url,
            "unreachable",
            "The homepage redirects too many times or to a URL we could not check safely.",
          );
        current = next;
        continue;
      }
      if (!response.ok)
        return {
          ...emptyAudit(url, "unreachable", `The homepage returned HTTP ${response.status}.`),
          finalUrl: current.href,
          statusCode: response.status,
        };
      const contentType = response.headers.get("content-type") || "";
      if (contentType && !/html|xhtml/i.test(contentType))
        return {
          ...emptyAudit(url, "unreachable", "The URL did not return an HTML homepage."),
          finalUrl: current.href,
          statusCode: response.status,
        };
      const html = await readHtml(response);
      if (html === null)
        return {
          ...emptyAudit(url, "too_large", "The homepage was too large for a quick surface audit."),
          finalUrl: current.href,
          statusCode: response.status,
        };
      return analyze(url, current.href, response.status, html, response.headers);
    }
  } catch {
    return {
      ...emptyAudit(
        url,
        "unreachable",
        "The homepage could not be reached within the audit time limit.",
      ),
      finalUrl: current.href,
    };
  }
  return emptyAudit(url, "unreachable", "The homepage could not be checked.");
}
