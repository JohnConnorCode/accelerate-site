import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  extractDocument as sourceExtractDocument,
  DOCUMENT_MAX_BYTES,
} from "../src/lib/revenue-os/document-extraction";
// Exercise the actual server bundle too: source tests cannot detect bundler path rewrites.
function compiledExtractor(): typeof sourceExtractDocument {
  const require = createRequire(resolve("package.json"));
  require(resolve(".next/server/app/api/admin/knowledge/documents/route.js"));
  const runtime = require(resolve(".next/server/webpack-runtime.js"));
  let parser: string | undefined;
  for (const file of readdirSync(".next/server/chunks").filter((file) => file.endsWith(".js"))) {
    const chunk = require(resolve(".next/server/chunks", file));
    if (!chunk.modules) continue;
    runtime.C(chunk);
    for (const [id, factory] of Object.entries(chunk.modules)) {
      if (String(factory).includes("Use PDF, DOCX, plain text or Markdown")) parser = id;
    }
  }
  assert.ok(parser, "Document parser must exist in the server bundle");
  const extract = Object.values(runtime(parser)).find(
    (value) => typeof value === "function" && String(value).includes("Upload a nonempty document"),
  );
  assert.equal(typeof extract, "function");
  return extract as typeof sourceExtractDocument;
}
const extractDocument = process.argv.includes("--compiled")
  ? compiledExtractor()
  : sourceExtractDocument;
function pdf(content: string) {
  const stream = `BT /F1 12 Tf 50 700 Td (${content}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let text = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(text.length);
    text += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = text.length;
  text += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(text);
}
(async () => {
  const parsed = await extractDocument(
    pdf("Consultations last thirty minutes."),
    "application/pdf",
  );
  assert.match(parsed.text, /Consultations last thirty minutes/);
  assert.equal(parsed.locations[0]?.label, "Page 1");
  const word = await extractDocument(
    readFileSync("scripts/fixtures/knowledge/reference.docx"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.match(word.text, /Consultations last thirty minutes/);
  const markdown = await extractDocument(
    new TextEncoder().encode("# Policy\nAsk before sending."),
    "text/markdown",
  );
  assert.match(markdown.text, /Ask before sending/);
  await assert.rejects(() => extractDocument(pdf(""), "application/pdf"), /OCR/);
  await assert.rejects(
    () => extractDocument(new Uint8Array(DOCUMENT_MAX_BYTES + 1), "text/plain"),
    /4 MB/,
  );
  await assert.rejects(() => extractDocument(new Uint8Array([0xff]), "text/plain"), /encoded data/);
  await assert.rejects(
    () => extractDocument(pdf("hello"), "application/pdf", AbortSignal.abort()),
    /abort/i,
  );
  await assert.rejects(
    () => extractDocument(new Uint8Array([1, 2, 3]), "application/pdf"),
    /Invalid PDF/,
  );
  console.log(
    "Document extraction: PDF, DOCX, Markdown, page provenance, scanned/invalid PDF, encoding, size and cancellation passed.",
  );
})();
