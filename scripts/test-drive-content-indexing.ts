#!/usr/bin/env tsx
/**
 * drive-content-indexing acceptance battery (AC1–AC3, local).
 *
 * Memory-only fixtures: supported mime types extract to searchable text with
 * provider id, link, modified time, folder and hash (AC1); unchanged content
 * is not re-extracted (AC2); files that vanish become `deleted` and failed
 * reads become `inaccessible` (AC2); identical content across distinct files
 * records a duplicate reference without erasing either source (AC3).
 */
import assert from "node:assert/strict";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import {
  driveContentHash,
  indexDriveFolder,
  isSupportedDriveMimeType,
  SUPPORTED_DRIVE_MIME_TYPES,
} from "../src/lib/revenue-os/drive-content-indexing";

const TENANT = "tenant-a";

type Row = Record<string, unknown>;

function seed() {
  return new MemorySupabase({
    tenants: [{ id: TENANT, status: "active", config: {} }],
    drive_documents: [],
  });
}

function bound(mem: MemorySupabase) {
  return bindTenantDatabaseForTest(mem.client as never, TENANT);
}

function row(overrides: Row = {}): Row {
  return {
    provider: "google",
    external_id: "file-1",
    name: "Acme onboarding",
    mime_type: "application/vnd.google-apps.document",
    web_view_link: "https://docs.google.com/d/acme",
    modified_at: "2026-09-01T10:00:00Z",
    folder_id: "folder-a",
    content_hash: null,
    ...overrides,
  };
}

async function main() {
  const checks: string[] = [];
  function check(name: string) {
    checks.push(name);
  }

  // AC1: supported docs extract to searchable text with provenance.
  {
    const mem = seed();
    const db = bound(mem);
    const listed = [
      row({ external_id: "f1", name: "Playbook", content_hash: null }),
      row({ external_id: "f2", name: "Rates", mime_type: "text/csv" }),
    ];
    const summary = await indexDriveFolder(db, {
      folderId: "folder-a",
      rows: listed as never,
      listingComplete: true,
      listedIds: new Set(["f1", "f2"]),
      extract: async (r) => {
        if (r.external_id === "f1") return "Our onboarding playbook, step by step.";
        return "rate,month\nbase,1200";
      },
    });
    assert.equal(summary.indexed, 2, "both supported docs must be indexed");
    assert.equal(summary.unsupported, 0);
    const docs = mem.rows("drive_documents");
    assert.equal(docs.length, 2);
    const playbook = docs.find((d) => d.external_id === "f1")!;
    assert.equal(playbook.extracted_text, "Our onboarding playbook, step by step.");
    assert.equal(playbook.indexed_status, "indexed");
    assert.equal(playbook.folder_id, "folder-a");
    assert.equal(playbook.provider, "google");
    assert.equal(playbook.web_view_link, "https://docs.google.com/d/acme");
    assert.equal(playbook.modified_at, "2026-09-01T10:00:00Z");
    assert.equal(
      playbook.content_hash,
      driveContentHash("Our onboarding playbook, step by step."),
      "hash must be derived from extracted text for native docs",
    );
    assert.ok(
      SUPPORTED_DRIVE_MIME_TYPES.includes("application/vnd.google-apps.document") &&
        SUPPORTED_DRIVE_MIME_TYPES.includes("text/csv"),
    );
    assert.equal(isSupportedDriveMimeType("application/vnd.google-apps.document"), true);
    assert.equal(isSupportedDriveMimeType("application/pdf"), false);
    check("extract-supported-with-provenance");
  }

  // AC2: unchanged content is not re-extracted.
  {
    const mem = seed();
    const db = bound(mem);
    const hash = driveContentHash("Version one content");
    mem.tables.drive_documents = [
      {
        id: "d1",
        tenant_id: TENANT,
        provider: "google",
        external_id: "f1",
        name: "Doc",
        mime_type: "text/plain",
        folder_id: "folder-a",
        extracted_text: "Version one content",
        content_hash: hash,
        provider_revision: "v1",
        indexed_status: "indexed",
        metadata: {},
      },
    ];
    let extractions = 0;
    const summary = await indexDriveFolder(db, {
      folderId: "folder-a",
      rows: [
        row({
          external_id: "f1",
          content_hash: hash,
          provider_revision: "v1",
          mime_type: "text/plain",
        }),
      ] as never,
      listingComplete: true,
      listedIds: new Set(["f1"]),
      extract: async () => {
        extractions++;
        return "Version one content";
      },
    });
    assert.equal(summary.unchanged, 1, "unchanged content must be reported as unchanged");
    assert.equal(summary.indexed, 0);
    assert.equal(extractions, 0, "unchanged content must not be re-extracted");
    assert.equal(mem.rows("drive_documents")[0]!.extracted_text, "Version one content");
    check("unchanged-content-skipped");
  }

  // AC2: vanished files become deleted; failed reads become inaccessible.
  {
    const mem = seed();
    const db = bound(mem);
    mem.tables.drive_documents = [
      {
        id: "d1",
        tenant_id: TENANT,
        provider: "google",
        external_id: "gone",
        name: "Gone",
        mime_type: "text/plain",
        folder_id: "folder-a",
        extracted_text: "old",
        content_hash: "old-hash",
        indexed_status: "indexed",
        metadata: {},
      },
    ];
    const summary = await indexDriveFolder(db, {
      folderId: "folder-a",
      rows: [row({ external_id: "broken", mime_type: "text/plain" })] as never,
      listingComplete: true,
      listedIds: new Set(["broken"]),
      extract: async () => null, // read fails
    });
    assert.equal(summary.inaccessible, 1, "failed read must become inaccessible");
    assert.equal(summary.deleted, 1, "vanished file must become deleted");
    const byExternal = Object.fromEntries(
      mem.rows("drive_documents").map((d) => [String(d.external_id), d]),
    );
    assert.equal(byExternal["broken"]?.indexed_status, "inaccessible");
    assert.equal(byExternal["gone"]?.indexed_status, "deleted");
    assert.equal(
      byExternal["gone"]?.extracted_text,
      null,
      "retired content is removed from search; source metadata remains",
    );
    check("deleted-and-inaccessible-explicit");
  }

  // AC3: duplicate content is marked without erasing either source.
  {
    const mem = seed();
    const db = bound(mem);
    const text = "Identical body across two files";
    const summary = await indexDriveFolder(db, {
      folderId: "folder-a",
      rows: [
        row({ external_id: "a", name: "Copy A", mime_type: "text/plain" }),
        row({ external_id: "b", name: "Copy B", mime_type: "text/plain" }),
      ] as never,
      listingComplete: true,
      listedIds: new Set(["a", "b"]),
      extract: async () => text,
    });
    assert.equal(summary.indexed, 2, "both files are stored");
    assert.equal(summary.duplicates, 1, "the second identical file is marked as a duplicate");
    const docs = mem.rows("drive_documents");
    assert.equal(docs.length, 2);
    const a = docs.find((d) => d.external_id === "a")!;
    const b = docs.find((d) => d.external_id === "b")!;
    assert.equal(a.content_duplicate_of, null);
    assert.equal(b.content_duplicate_of, "a", "duplicate references the first source id");
    assert.equal(a.extracted_text, text);
    assert.equal(b.extracted_text, text);
    assert.notEqual(a.id, b.id, "distinct rows preserve distinct source provenance");
    assert.equal(a.name, "Copy A");
    assert.equal(b.name, "Copy B");
    check("duplicate-content-preserves-provenance");
  }

  {
    const mem = seed();
    const db = bound(mem);
    const previous = {
      ...row(),
      id: "d1",
      tenant_id: TENANT,
      indexed_status: "indexed",
      extracted_text: "private content",
      content_hash: driveContentHash("private content"),
      provider_revision: "v1",
    };
    mem.tables.drive_documents = [previous, { ...previous, id: "foreign", tenant_id: "tenant-b" }];
    const incomplete = await indexDriveFolder(db, {
      folderId: "folder-a",
      rows: [],
      listedIds: new Set(),
      listingComplete: false,
      extract: async () => {
        throw new Error("not called");
      },
    });
    assert.equal(incomplete.deleted, 0);
    assert.equal(mem.rows("drive_documents")[0]!.extracted_text, "private content");
    const revoked = await indexDriveFolder(db, {
      folderId: "folder-a",
      rows: [row({ provider_revision: "v1", metadata: { canDownload: false } })] as never,
      listedIds: new Set(["file-1"]),
      listingComplete: true,
      extract: async () => {
        throw new Error("revoked content must not be fetched");
      },
    });
    assert.equal(revoked.inaccessible, 1);
    assert.equal(mem.rows("drive_documents").find((r) => r.id === "d1")!.extracted_text, null);
    assert.equal(
      mem.rows("drive_documents").find((r) => r.id === "foreign")!.extracted_text,
      "private content",
    );
    await assert.rejects(
      indexDriveFolder(mem.client as never, {
        folderId: "folder-a",
        rows: [],
        listedIds: new Set(),
        extract: async () => null,
      }),
      /tenant-bound/,
    );
    await assert.rejects(
      indexDriveFolder(db, {
        folderId: "folder-a",
        rows: [row({ folder_id: "elsewhere" })] as never,
        listedIds: new Set(["file-1"]),
        extract: async () => null,
      }),
      /scope/,
    );
    assert.equal(
      isSupportedDriveMimeType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
      false,
    );
    check("partial-listing-revocation-binary-and-tenant-boundaries");
  }
  {
    const mem = seed();
    const db = bound(mem);
    const source = row({ provider_revision: "v1", mime_type: "text/plain" });
    await indexDriveFolder(db, {
      folderId: "folder-a",
      rows: [source] as never,
      listedIds: new Set(["file-1"]),
      listingComplete: true,
      extract: async () => "same",
    });
    let reads = 0;
    const result = await indexDriveFolder(db, {
      folderId: "folder-a",
      rows: [
        source,
        row({
          external_id: "copy",
          provider_revision: "v2",
          content_hash: "different-provider-checksum",
          mime_type: "text/plain",
        }),
      ] as never,
      listedIds: new Set(["file-1", "copy"]),
      listingComplete: true,
      extract: async () => {
        reads++;
        return "same";
      },
    });
    assert.equal(reads, 1);
    assert.equal(result.unchanged, 1);
    assert.equal(result.duplicates, 1);
    assert.equal(
      mem.rows("drive_documents").find((r) => r.external_id === "copy")!.content_duplicate_of,
      "file-1",
    );
    check("duplicate-of-unchanged-source-uses-text-hash");
  }

  {
    const mem = seed();
    const db = bound(mem);
    const base = {
      ...row(),
      id: "owned",
      tenant_id: TENANT,
      indexed_status: "indexed",
      provider_revision: "v1",
      extracted_text: "owned content",
      content_hash: driveContentHash("owned content"),
    };
    mem.tables.drive_documents = [
      base,
      {
        ...base,
        id: "foreign",
        tenant_id: "tenant-b",
        extracted_text: "foreign secret",
        content_hash: driveContentHash("foreign secret"),
      },
    ];
    await indexDriveFolder(db, {
      folderId: "folder-a",
      rows: [row({ provider_revision: "v1" })] as never,
      listedIds: new Set(["file-1"]),
      listingComplete: true,
      extract: async () => {
        throw new Error("unchanged");
      },
    });
    assert.equal(
      mem.rows("drive_documents").find((row) => row.id === "owned")!.extracted_text,
      "owned content",
    );
    await indexDriveFolder(db, {
      folderId: "folder-a",
      rows: [],
      listedIds: new Set(),
      listingComplete: true,
      extract: async () => null,
    });
    assert.equal(
      mem.rows("drive_documents").find((row) => row.id === "foreign")!.indexed_status,
      "indexed",
    );
    check("foreign-identical-file-id-never-supplies-or-retires-content");
  }
  console.log(JSON.stringify({ result: "passed", checks }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
