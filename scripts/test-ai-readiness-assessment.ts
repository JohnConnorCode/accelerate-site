import assert from "node:assert/strict";
import { calculateReadiness, readinessQuestions } from "../src/lib/ai-readiness";
import { createAIReadinessPdf } from "../src/lib/ai-readiness-pdf";
import { auditWebsite, privateAddress } from "../src/lib/ai-readiness-website";

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
assert.ok(incompleteReport.coverage < 100);

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
    findings: [],
    note: "Surface audit only.",
  },
});
assert.ok(websitePdf.includes(Buffer.from("Website snapshot")));

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
