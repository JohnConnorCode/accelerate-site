import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/context";
import {
  analyzeContactImport,
  buildContactImportAiContext,
  parseContactImportSource,
  saveContactImportReview,
  validateContactImportAiEnvelope,
  validateContactImportFields,
} from "../src/lib/revenue-os/contact-imports";

const csv = parseContactImportSource(
  '\uFEFFname,email,notes,empty\r\n"Jane ""JJ"" Doe",jane@example.test,"first line\r\nsecond line",\r\n',
  "csv",
);
assert.deepEqual(csv, [
  {
    name: 'Jane "JJ" Doe',
    email: "jane@example.test",
    notes: "first line\r\nsecond line",
    empty: "",
  },
]);
assert.deepEqual(parseContactImportSource("name\temail\r\nJane\tjane@example.test", "tsv"), [
  { name: "Jane", email: "jane@example.test" },
]);
for (const [source, type, message] of [
  ["name,name\nJane,Doe", "csv", /headers repeat/i],
  ['name,email\n"Jane,jane@example.test', "csv", /unclosed quote/i],
  ['name,email\nJa"ne,jane@example.test', "csv", /unexpected quote/i],
  ['name,email\n"Jane"x,jane@example.test', "csv", /after a quote/i],
  ["name,email\nJane", "csv", /expected 2/i],
  ["name,email\nJane,jane@example.test,extra", "csv", /expected 2/i],
  ["name,email\nJane,jane@example.test\n\nSam,sam@example.test", "csv", /row 3 is empty/i],
  [`name,email\n${"J".repeat(2001)},jane@example.test`, "csv", /exceeds 2000/i],
  [JSON.stringify([{ name: "Jane", tags: ["lead"] }]), "json", /nested data/i],
  [JSON.stringify([{ name: "Jane", notes: "x".repeat(2001) }]), "json", /exceeds 2000/i],
  ["[{broken", "json", /invalid JSON/i],
  ["Jane\u0000 Doe", "text", /control characters/i],
  ["J".repeat(2001), "text", /exceeds 2000/i],
] as const) {
  assert.throws(() => parseContactImportSource(source, type), message);
}
assert.throws(
  () =>
    parseContactImportSource(
      `${Array.from({ length: 41 }, (_, i) => `c${i}`).join(",")}\n${Array(41).fill("x").join(",")}`,
      "csv",
    ),
  /more than 40 columns/i,
);
assert.throws(
  () => parseContactImportSource(JSON.stringify(Array(501).fill({ name: "Jane" })), "json"),
  /more than 500 rows/i,
);
assert.throws(
  () => buildContactImportAiContext({ rawRows: Array(500).fill({ text: "x".repeat(400) }) }),
  /AI context budget/i,
);
assert.throws(
  () => validateContactImportFields({ fullName: "x".repeat(141), email: "jane@example.test" }),
  /fullName exceeds 140/i,
);

const aiContact = (sourceIndex: number, fullName: string, email: string) => ({
  sourceIndex,
  fullName,
  email,
  phone: null,
  companyName: null,
  role: null,
  website: null,
  industry: null,
  source: null,
  notes: null,
  confidence: "high",
  warnings: [],
});
assert.throws(
  () =>
    validateContactImportAiEnvelope(
      {
        contacts: [
          aiContact(0, "Jane", "jane@example.test"),
          aiContact(0, "Jane", "jane@example.test"),
        ],
      },
      new Set([0, 1]),
    ),
  /more than once/i,
);
assert.throws(
  () =>
    validateContactImportAiEnvelope(
      { contacts: [aiContact(2, "Jane", "jane@example.test")] },
      new Set([0, 1]),
    ),
  /unavailable source row/i,
);

const realFetch = globalThis.fetch;
const oldKey = process.env.OPENROUTER_API_KEY;
process.env.OPENROUTER_API_KEY = "sk-or-v1-test-key-not-real";
let providerCalls = 0;
let modelContacts = [
  aiContact(2, "Sam Lee", "sam@example.test"),
  aiContact(0, "Jane Doe", "jane@example.test"),
];
globalThis.fetch = (async (url: string | URL | Request) => {
  assert.match(String(url), /openrouter\.ai/);
  providerCalls++;
  return Response.json({
    id: `fixture-${providerCalls}`,
    model: "fixture/contact-extract",
    choices: [
      {
        finish_reason: "stop",
        message: { role: "assistant", content: JSON.stringify({ contacts: modelContacts }) },
      },
    ],
    usage: { total_tokens: 20 },
  });
}) as typeof fetch;

async function main() {
  const memory = new MemorySupabase({ tenants: [{ id: ACCELERATE_TENANT_ID, status: "active" }] });
  const database = bindTenantDatabase(memory.client, ACCELERATE_TENANT_ID, true) as SupabaseClient;
  const sourceText =
    "fullName,email\nJane Doe,jane@example.test\nMissing Person,missing@example.test\nSam Lee,sam@example.test";
  const input = { sourceText, filename: "contacts.csv", actorEmail: "owner@example.test" };
  try {
    await assert.rejects(
      analyzeContactImport(database, { ...input, sourceText: "name,name\nJane,Doe" }),
      /headers repeat/i,
    );
    await assert.rejects(
      analyzeContactImport(database, {
        ...input,
        sourceText: Array(500).fill("x".repeat(400)).join("\n"),
        filename: "contacts.txt",
      }),
      /AI context budget/i,
    );
    assert.equal(
      memory.rows("contact_import_batches").length,
      0,
      "Invalid source fails before batch write",
    );
    assert.equal(providerCalls, 0, "Invalid source fails before model cost");

    const batch = await analyzeContactImport(database, input);
    assert.ok(batch?.rows);
    assert.equal(providerCalls, 1);
    assert.equal(batch.source_row_count, 3);
    assert.equal(batch.proposed_row_count, 3);
    assert.deepEqual(
      batch.rows.map((row) => row.row_index),
      [0, 1, 2],
    );
    assert.deepEqual(
      batch.rows.map((row) => row.raw_data.email),
      ["jane@example.test", "missing@example.test", "sam@example.test"],
    );
    assert.equal(batch.rows[0]?.proposed_data.fullName, "Jane Doe");
    assert.equal(batch.rows[2]?.proposed_data.fullName, "Sam Lee");
    assert.equal(batch.rows[1]?.status, "needs_review");
    assert.equal(batch.rows[1]?.included, false);
    assert.match(batch.rows[1]?.warnings.join(" ") ?? "", /did not return a contact/i);
    assert.deepEqual(memory.rows("contacts"), [], "Analysis never writes canonical contacts");
    assert.deepEqual(memory.rows("messages"), [], "Analysis sends nothing");

    const before = JSON.stringify(memory.rows("contact_import_rows"));
    await assert.rejects(
      saveContactImportReview(database, {
        batchId: batch.id,
        actorEmail: input.actorEmail,
        rows: batch.rows.map((row, index) => ({
          id: row.id,
          included: row.included,
          action: row.action,
          data:
            index === 2 ? { ...row.reviewed_data, fullName: "x".repeat(141) } : row.reviewed_data,
        })),
      }),
      /fullName exceeds 140/i,
    );
    assert.equal(
      JSON.stringify(memory.rows("contact_import_rows")),
      before,
      "Oversized edit leaves every saved row untouched",
    );

    modelContacts = [
      aiContact(0, "Jane Doe", "jane@example.test"),
      aiContact(0, "Jane Doe", "jane@example.test"),
    ];
    await assert.rejects(analyzeContactImport(database, input), /more than once/i);
    assert.equal(
      memory.rows("contact_import_rows").length,
      3,
      "Duplicate model references create no review rows",
    );
    assert.deepEqual(memory.rows("contacts"), []);
  } finally {
    globalThis.fetch = realFetch;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
  }
  console.log(
    "Contact import source integrity and analysis-service fixture passed without canonical writes or provider calls.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
