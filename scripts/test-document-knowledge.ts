import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { encryptSecret } from "../src/lib/revenue-os/encryption";
import { searchDocumentKnowledge } from "../src/lib/revenue-os/document-knowledge";
async function main() {
  const savedKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    savedFetch = globalThis.fetch;
  try {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const mem = new MemorySupabase({
      tenants: [{ id: "fixture", status: "active" }],
      integration_connections: [
        {
          tenant_id: "fixture",
          provider: "google",
          status: "connected",
          encrypted_refresh_token: encryptSecret("fixture-refresh"),
          encrypted_access_token: encryptSecret("fixture-token"),
          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          settings: { drive_folder_ids: ["selected"] },
        },
      ],
    });
    const db = bindTenantDatabase(mem.client as never, "fixture", true);
    mem.rpc("search_document_knowledge", () => [
      {
        id: "doc",
        kind: "drive",
        title: "Appointment policy",
        content: "Ask about timing",
        revision: "hash",
        externalId: "file",
        folderId: "selected",
        providerRevision: "2",
      },
    ]);
    let mode = "current";
    globalThis.fetch = async (input) => {
      assert(String(input).startsWith("https://www.googleapis.com/drive/v3/files/file?"));
      return mode === "revoked"
        ? Response.json({}, { status: 403 })
        : Response.json({
            version: mode === "stale" ? "3" : "2",
            trashed: false,
            parents: ["selected"],
            capabilities: { canDownload: true },
          });
    };
    assert.equal((await searchDocumentKnowledge(db, "appointment", 5)).chunks.length, 1);
    for (const failure of ["stale", "revoked"]) {
      mode = failure;
      const result = await searchDocumentKnowledge(db, "appointment", 5);
      assert.equal(result.chunks.length, 0);
      assert(result.missing.length);
    }
    mode = "current";
    mem.rows("integration_connections")[0]!.settings = { drive_folder_ids: [] };
    assert.equal((await searchDocumentKnowledge(db, "appointment", 5)).chunks.length, 0);
    mem.rows("integration_connections")[0]!.status = "disconnected";
    assert.equal((await searchDocumentKnowledge(db, "appointment", 5)).chunks.length, 0);
    console.log(
      "Document retrieval: current access, revoked access, changed revision, removed folder and disconnected provider passed without external calls.",
    );
  } finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = savedKey;
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
