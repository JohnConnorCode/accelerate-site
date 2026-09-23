import assert from "node:assert/strict";
import { calculateReadiness, publicPreview, readinessQuestions } from "../src/lib/ai-readiness";
import { createAIReadinessPdf } from "../src/lib/ai-readiness-pdf";
import { summarizeAIReadinessEvents } from "../src/lib/ai-readiness-analytics";
import type { WebsiteAudit } from "../src/lib/ai-readiness";
import { normalizeAnalyticsPath } from "../src/lib/analytics";
import {
  auditWebsite,
  combinePageAudits,
  discoverInternalPages,
  privateAddress,
} from "../src/lib/ai-readiness-website";

const profile = {
  businessType: "professional services",
  teamSize: "2_to_5" as const,
  priority: "save_time" as const,
  bottleneck: "admin" as const,
};

const allStrong = Object.fromEntries(
  readinessQuestions.map((question) => [
    question.id,
    question.options[question.options.length - 1]!.value,
  ]),
);
const strongReport = calculateReadiness(allStrong, profile);
assert.equal(strongReport.score, 100);
assert.equal(strongReport.coverage, 100);
assert.equal(strongReport.recommendations[0]?.key, "admin");
assert.equal(strongReport.evidence.length, 3);
assert.equal(publicPreview(strongReport).evidence.length, 3);
assert.deepEqual(
  strongReport.actionPlan.map((step) => step.week),
  ["Days 1–30", "Days 31–60", "Days 61–90", "Ongoing"],
);
const eventSummary = summarizeAIReadinessEvents([
  { visitor_id: "visitor-a", event_name: "ai_readiness_began", properties: null },
  { visitor_id: "visitor-a", event_name: "ai_readiness_began", properties: null },
  {
    visitor_id: "visitor-a",
    event_name: "ai_readiness_step_viewed",
    properties: { step: "profile" },
  },
  {
    visitor_id: "visitor-a",
    event_name: "ai_readiness_step_viewed",
    properties: { step: "assessment", question_number: 1, answer: "ignored" },
  },
  {
    visitor_id: "visitor-b",
    event_name: "ai_readiness_step_viewed",
    properties: { step: "assessment", question_number: 1 },
  },
  { visitor_id: "visitor-b", event_name: "ai_readiness_pdf_downloaded", properties: null },
]);
assert.equal(eventSummary.starts, 1);
assert.deepEqual(eventSummary.stepViews, [
  { label: "profile", value: 1 },
  { label: "assessment", value: 2 },
]);
assert.deepEqual(eventSummary.questionViews, [{ label: "Question 1", value: 2 }]);
assert.equal(eventSummary.pdfDownloads, 1);
assert.equal(
  normalizeAnalyticsPath("/ai-readiness/report/long-private-report-token"),
  "/ai-readiness/report/[token]",
);
const pageAudit = (
  url: string,
  status: WebsiteAudit["status"],
  score: number | null,
  categoryScore: number,
): WebsiteAudit => ({
  url,
  finalUrl: url,
  checkedAt: "2026-09-23T00:00:00.000Z",
  status,
  score,
  summary: "Visible HTML surface signals.",
  categories: [
    { key: "seo", label: "Search foundations", score: categoryScore, summary: "Title signal." },
  ],
  findings: [
    {
      severity: "priority",
      category: "SEO",
      title: "Add a description",
      detail: "No description was found.",
      action: "Add a specific description.",
    },
  ],
  pages: [{ url, status, score }],
  note: "Bounded HTML review.",
});
const combinedSiteAudit = combinePageAudits(
  pageAudit("https://example.com/", "completed", 80, 80),
  [
    pageAudit("https://example.com/services", "completed", 40, 40),
    pageAudit("https://example.com/contact", "unreachable", null, 0),
  ],
);
assert.equal(combinedSiteAudit.score, 60);
assert.equal(combinedSiteAudit.categories[0]?.score, 60);
assert.equal(combinedSiteAudit.pages?.length, 3);
assert.match(combinedSiteAudit.findings[0]?.page || "", /\/.*, \/services/);
assert.match(combinedSiteAudit.findings[0]?.detail || "", /services/);
assert.match(combinedSiteAudit.note, /unavailable or blocked/);

const incomplete = {
  ...allStrong,
  process_visibility: "unknown",
  process_repeatability: "unknown",
  process_bottleneck: "unknown",
};
const incompleteReport = calculateReadiness(incomplete, profile);
assert.equal(incompleteReport.score, null);
assert.equal(
  incompleteReport.dimensionScores.find((dimension) => dimension.key === "process")?.score,
  null,
);
assert.equal(incompleteReport.coverage, 100, "unknown choices count as answered questions");
assert.equal(
  incompleteReport.dimensionScores.find((dimension) => dimension.key === "process")?.answered,
  3,
);
assert.equal(
  incompleteReport.dimensionScores.find((dimension) => dimension.key === "process")?.coverage,
  0,
  "unknown choices add answer coverage but no scoreable evidence",
);
const allUnknown = Object.fromEntries(
  readinessQuestions.map((question) => [question.id, "unknown"]),
);
const unknownReport = calculateReadiness(allUnknown, profile);
assert.equal(unknownReport.coverage, 100);
assert.equal(unknownReport.score, null);
assert.equal(unknownReport.scoreLabel, "More evidence needed");
assert.match(unknownReport.summary, /You answered 100%/);

const pdf = createAIReadinessPdf(strongReport);
assert.equal(pdf.subarray(0, 8).toString(), "%PDF-1.4");
assert.ok(pdf.includes(Buffer.from("AI READINESS ACTION PLAN")));
const websitePdf = createAIReadinessPdf({
  ...strongReport,
  websiteAudit: {
    url: "https://example.com",
    checkedAt: new Date().toISOString(),
    status: "completed",
    score: 80,
    summary: "The homepage scored 80/100 on visible foundations.",
    categories: [{ key: "seo", label: "Search foundations", score: 80, summary: "Title found." }],
    pages: [
      {
        url: "https://example.com/about",
        title: "About Example",
        status: "completed",
        statusCode: 200,
        score: 80,
      },
    ],
    findings: [],
    note: "Surface audit only.",
  },
});
assert.ok(websitePdf.includes(Buffer.from("Website snapshot")));
assert.ok(websitePdf.includes(Buffer.from("Evidence from your answers")));
assert.ok(websitePdf.includes(Buffer.from("Days 1-30")));

assert.deepEqual(
  discoverInternalPages(
    '<a href="/random">Random</a><a href="/about">About</a><a href="/services">Services</a><a href="/contact?utm_source=test">Contact</a><a href="https://other.example/page">External</a><a href="/brochure.pdf">PDF</a>',
    new URL("https://example.com/"),
  ).map((value) => new URL(value).pathname),
  ["/about", "/services", "/contact"],
);

console.log(
  "AI readiness scoring, unknown-answer handling, recommendation selection and PDF output passed.",
);

void auditWebsite("http://localhost")
  .then((audit) => {
    assert.equal(audit?.status, "blocked");
    console.log("Website audit SSRF guard passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

for (const address of [
  "127.0.0.1",
  "10.0.0.1",
  "169.254.169.254",
  "172.16.0.1",
  "192.168.0.1",
  "::ffff:7f00:1",
  "::ffff:a00:1",
  "::1",
  "fe90::1",
  "fc00::1",
  "2002:7f00:1::",
])
  assert.equal(privateAddress(address), true, address);
for (const address of ["example.com", "8.8.8.8", "2606:4700:4700::1111"])
  assert.equal(privateAddress(address), false, address);
