#!/usr/bin/env tsx
/**
 * No em dash is a hard house rule, and the chat prompt asking nicely is not a
 * guarantee. One reached production reading "no catch, no sales pitch—just a
 * clear plan you keep", which is the clearest possible tell that nobody wrote
 * the sentence.
 *
 * Enforcing it on a byte stream is only correct if a multi-byte character split
 * across a chunk boundary is handled: an em dash is three bytes in UTF-8, so a
 * naive per-chunk replace misses any dash that straddles two chunks. Most of
 * this file is that case, deliberately, because it is the one that would
 * otherwise pass a casual test and fail in production.
 */
import assert from "node:assert/strict";
import { applyHouseStyle, enforceHouseStyle } from "../src/lib/chat/sanitize";

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) { controller.close(); return; }
      controller.enqueue(chunks[index++]!);
    },
  });
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let out = "";
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

/** Feed a string through the sanitiser split into chunks of `size` bytes. */
async function throughStream(text: string, size: number): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.slice(offset, offset + size));
  }
  return drain(enforceHouseStyle(streamOf(chunks)));
}

async function main() {
  // ---- The pure rewrite ---------------------------------------------------

  assert.equal(applyHouseStyle("no catch, no sales pitch—just a clear plan"), "no catch, no sales pitch, just a clear plan", "the exact sentence observed in production must be fixed");
  assert.equal(applyHouseStyle("a — b"), "a, b", "a spaced em dash must not leave a double space behind");
  assert.equal(applyHouseStyle("a – b"), "a, b", "a spaced en dash used as a clause break gets the same treatment");
  assert.equal(applyHouseStyle("Plain text with no dashes."), "Plain text with no dashes.", "text without dashes must pass through byte for byte");

  // A hyphen is not an em dash. Over-eager replacement would mangle real words
  // and real URLs, which is worse than the problem being fixed.
  assert.equal(applyHouseStyle("follow-up"), "follow-up", "a hyphenated word must survive");
  assert.equal(applyHouseStyle("https://calendly.com/john-acceleratewith/30min"), "https://calendly.com/john-acceleratewith/30min", "a URL with hyphens must survive intact");
  assert.equal(applyHouseStyle("2026-08-20"), "2026-08-20", "a date must survive");
  assert.equal(applyHouseStyle("Range: 5-10 hours"), "Range: 5-10 hours", "a numeric range must survive");

  // ---- The stream, at every chunk size -----------------------------------

  const cases = [
    ["no catch, no sales pitch—just a clear plan you keep", "no catch, no sales pitch, just a clear plan you keep"],
    ["We map the business — then we build.", "We map the business, then we build."],
    ["Book here: https://acceleratewith.us/contact", "Book here: https://acceleratewith.us/contact"],
    ["Every follow-up sent, every job booked.", "Every follow-up sent, every job booked."],
    ["—leading dash", ", leading dash"],
  ] as const;

  for (const [input, expected] of cases) {
    // Size 1 forces the em dash to be split across three separate chunks, one
    // byte each. If the decoder were created per chunk this would emit replacement
    // characters instead of the dash, and the rewrite would silently miss.
    for (const size of [1, 2, 3, 5, 17, 4096]) {
      const actual = await throughStream(input, size);
      assert.equal(actual, expected, `chunk size ${size}: ${JSON.stringify(input)}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`);
    }
  }

  // ---- Nothing is dropped -------------------------------------------------

  // The sanitiser holds one character back to decide about a trailing dash, so
  // the final character must still arrive when the stream closes.
  for (const ending of ["end.", "end", "e", ""]) {
    const text = `A reply that ends with ${ending}`;
    assert.equal(await throughStream(text, 3), text, `the last character must not be swallowed: ${JSON.stringify(text)}`);
  }

  // Multi-byte characters that are not dashes must survive being split.
  const unicode = "Café résumé ✓ 日本語";
  for (const size of [1, 2, 3, 7]) {
    assert.equal(await throughStream(unicode, size), unicode, `chunk size ${size}: multi-byte text must survive the transform intact`);
  }

  // ---- The site's own copy is already clean -------------------------------

  // The rule applies to written copy too, not only to model output.
  const { readFileSync } = await import("node:fs");
  const prompt = readFileSync("src/lib/chat/system-prompt.ts", "utf8");
  const promptBody = prompt.slice(prompt.indexOf("SYSTEM_PROMPT"));
  const offenders = [...promptBody.matchAll(/.{0,40}—.{0,40}/g)]
    .map((match) => match[0])
    // The rule itself has to quote the character it bans.
    .filter((context) => !context.includes("NEVER use an em dash") && !context.includes("sales pitch—just"));
  assert.deepEqual(offenders, [], `the chat system prompt itself must not contain an em dash: ${offenders.join(" | ")}`);
  assert.match(promptBody, /NEVER use an em dash/, "the prompt must still carry the instruction; the stream filter is a backstop, not a replacement");

  console.log(JSON.stringify({
    checks: ["rewrite-semantics", "hyphens-and-urls-survive", "split-across-chunks", "nothing-dropped", "unicode-intact", "prompt-carries-the-rule"],
    chunkSizesExercised: [1, 2, 3, 5, 17, 4096],
    result: "passed",
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
