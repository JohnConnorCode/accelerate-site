import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/context";
import {
  analyzeContactImport,
  buildContactImportAiContext,
  contactImportSchemaUnavailable,
  detectContactImportSourceType,
  parseContactImportSource,
  saveContactImportReview,
  validateContactImportAiEnvelope,
  validateContactImportFields,
} from "../src/lib/revenue-os/contact-imports";

assert.equal(
  contactImportSchemaUnavailable(
    Object.assign(new Error("Could not find the function public.save_contact_import_review"), {
      code: "PGRST202",
    }),
  ),
  true,
);

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
assert.deepEqual(parseContactImportSource("  Jane Doe  \r\nSam Lee\t", "text"), [
  { text: "  Jane Doe  " },
  { text: "Sam Lee\t" },
]);
const page = readFileSync(
  new URL("../src/app/admin/contact-imports/page.tsx", import.meta.url),
  "utf8",
);
const pastedExample = page.match(/const EMPTY_SAMPLE = `([^`]+)`;/)?.[1]?.replaceAll("\\n", "\n");
assert.ok(pastedExample);
assert.equal(detectContactImportSourceType(pastedExample), "text");
assert.equal(parseContactImportSource(pastedExample, "text").length, 3);
assert.equal(
  detectContactImportSourceType("Jane,jane@example.test\nSam,sam@example.test", "contacts.txt"),
  "text",
);
assert.deepEqual(
  parseContactImportSource(
    '[{"phone":9007199254740993,"ratio":0.12345678901234567890,"code":1e400}]',
    "json",
  ),
  [{ phone: "9007199254740993", ratio: "0.12345678901234567890", code: "1e400" }],
);
assert.deepEqual(
  parseContactImportSource(
    JSON.stringify([{ name: "José 王", notes: "\tfirst\nsecond", empty: null }]),
    "json",
  ),
  [{ name: "José 王", notes: "\tfirst\nsecond", empty: "" }],
);
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
  ['[{"name":"Jane","name":"Janet"}]', "json", /repeats field name/i],
  ['[{"name":"Jane","n\\u0061me":"Janet"}]', "json", /repeats field name/i],
  [JSON.stringify([{ name: "Jane", Name: "Janet" }]), "json", /repeats field Name/i],
  [JSON.stringify([{ name: "Jane\u0000 Doe" }]), "json", /control characters/i],
  [JSON.stringify([{ ["name\u0001"]: "Jane" }]), "json", /control characters/i],
  ['{"contacts":[{"name":"Jane"}],"ignored":"value"}', "json", /top-level fields/i],
  [JSON.stringify([{ name: "Jane", notes: "x".repeat(2001) }]), "json", /exceeds 2000/i],
  ["[{broken", "json", /invalid JSON/i],
  ["Jane\u0000 Doe", "text", /control characters/i],
  ["J".repeat(2001), "text", /exceeds 2000/i],
  ["x".repeat(250001), "text", /250,000/i],
  [JSON.stringify([{ ["k".repeat(101)]: "Jane" }]), "json", /oversized field name/i],
  [`${"k".repeat(101)}\nJane`, "csv", /oversized header/i],
] as const) {
  assert.throws(() => parseContactImportSource(source, type), message);
}
for (const type of ["csv", "tsv", "json", "text"] as const) {
  const delimiter = type === "tsv" ? "\t" : ",";
  const source =
    type === "json"
      ? JSON.stringify(Array(500).fill({ name: "Jane" }))
      : type === "text"
        ? Array(500).fill("Jane").join("\n")
        : `name${delimiter}notes\n${Array(500)
            .fill(`Jane${delimiter}${"x".repeat(10)}`)
            .join("\n")}`;
  assert.equal(parseContactImportSource(source, type).length, 500);
  const overflow =
    type === "json"
      ? JSON.stringify(Array(501).fill({ name: "Jane" }))
      : `${source}\n${type === "text" ? "Jane" : `Jane${delimiter}notes`}`;
  assert.throws(() => parseContactImportSource(overflow, type), /more than 500 rows/i);
}
assert.equal(parseContactImportSource("x".repeat(2000), "text")[0]?.text?.length, 2000);
assert.equal(
  parseContactImportSource(JSON.stringify([{ ["k".repeat(100)]: "x".repeat(2000) }]), "json")
    .length,
  1,
);
assert.equal(
  validateContactImportFields({ fullName: "x".repeat(140), email: "jane@example.test" }).data
    .fullName.length,
  140,
);
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
assert.throws(
  () =>
    validateContactImportFields({
      fullName: "Jane",
      email: { lost: "jane@example.test" },
      phone: "555-0134",
    }),
  /email must be text/i,
);
assert.throws(
  () => validateContactImportFields({ fullName: "Jane\u0000", email: "jane@example.test" }),
  /control characters/i,
);
assert.equal(
  buildContactImportAiContext({ rawRows: [{ name: "Jane" }], instructions: "x".repeat(1000) })
    .guidance?.length,
  1000,
);
assert.throws(
  () =>
    buildContactImportAiContext({ rawRows: [{ name: "Jane" }], instructions: "x".repeat(1001) }),
  /guidance exceeds 1000/i,
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
    // PostgreSQL supplies this default; the memory fixture has no schema defaults.
    batch.updated_at = "2026-09-29T12:00:00.000Z";
    memory.rows("contact_import_batches").find((row) => row.id === batch.id)!.updated_at =
      batch.updated_at;
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
        expectedRevision: batch.updated_at,
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
    await assert.rejects(
      saveContactImportReview(database, {
        batchId: batch.id,
        expectedRevision: batch.updated_at,
        actorEmail: input.actorEmail,
        rows: batch.rows.map((row, index) => ({
          id: row.id,
          included: row.included,
          action: index === 2 ? ("invalid" as never) : row.action,
          data: index === 0 ? { ...row.reviewed_data, notes: "changed" } : row.reviewed_data,
        })),
      }),
      /Invalid import action/,
    );
    assert.equal(
      JSON.stringify(memory.rows("contact_import_rows")),
      before,
      "Invalid later action leaves all review rows untouched",
    );

    let failSave = false;
    memory.rpc("save_contact_import_review", (args) => {
      if (failSave)
        return { error: { code: "XX000", message: "controlled review commit failure" } };
      assert.equal(args.p_expected_updated_at, batch.updated_at);
      const prepared = args.p_rows as Array<Record<string, unknown>>;
      for (const row of prepared) {
        assert.equal("raw_data" in row, false);
        assert.equal("imported_contact_id" in row, false);
      }
      for (const row of prepared) {
        const stored = memory.rows("contact_import_rows").find((value) => value.id === row.id)!;
        Object.assign(stored, row, {
          // Model PostgreSQL's JSON key order changing across the RPC boundary.
          reviewed_data: Object.fromEntries(Object.entries(row.reviewed_data as object).reverse()),
        });
      }
      Object.assign(
        memory.rows("contact_import_batches").find((value) => value.id === batch.id)!,
        {
          status: "ready",
          approval_digest: null,
          approved_by: null,
          approved_at: null,
          review_digest: args.p_review_digest,
          summary: args.p_summary,
          updated_at: new Date(Date.parse(batch.updated_at) + 1000).toISOString(),
        },
      );
      return args.p_batch_id;
    });
    const review = {
      batchId: batch.id,
      expectedRevision: batch.updated_at,
      actorEmail: input.actorEmail,
      rows: batch.rows.map((row) => ({
        id: row.id,
        included: row.included,
        action: row.action,
        data: row.reviewed_data,
      })),
    };
    const snapshot = JSON.stringify(memory.tables);
    failSave = true;
    await assert.rejects(
      saveContactImportReview(database, review),
      /controlled review commit failure/,
    );
    assert.equal(
      JSON.stringify(memory.tables),
      snapshot,
      "failed commit leaves source and approval intact",
    );
    failSave = false;
    const committed = await saveContactImportReview(database, review);
    assert.ok(committed?.review_digest);
    assert.equal(committed.approval_digest, null);
    await assert.rejects(saveContactImportReview(database, review), /review changed/);
    const { approveContactImport } = await import("../src/lib/revenue-os/contact-imports");
    const approved = await approveContactImport(database, {
      batchId: batch.id,
      actorEmail: input.actorEmail,
      expectedDigest: committed.review_digest,
    });
    assert.equal(approved?.status, "approved", "review digest survives database JSON key ordering");

    modelContacts = [];
    const omitted = await analyzeContactImport(database, input);
    assert.equal(omitted?.rows?.length, 3);
    assert.ok(omitted?.rows?.every((row) => !row.included && row.status === "needs_review"));
    assert.deepEqual(
      omitted?.rows?.map((row) => row.raw_data.email),
      ["jane@example.test", "missing@example.test", "sam@example.test"],
    );

    modelContacts = [
      aiContact(0, "Jane Doe", "jane@example.test"),
      aiContact(0, "Jane Doe", "jane@example.test"),
    ];
    await assert.rejects(analyzeContactImport(database, input), /more than once/i);
    assert.equal(
      memory.rows("contact_import_rows").length,
      6,
      "Duplicate model references create no review rows",
    );
    assert.deepEqual(memory.rows("contacts"), []);
  } finally {
    globalThis.fetch = realFetch;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
  }
  console.log(
    "Contact import source integrity and analysis-service fixture passed without canonical writes or external provider calls.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
