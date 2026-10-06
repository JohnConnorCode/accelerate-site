import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm, stat, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { backupStorage, restoreStorage } from "./lib/storage-recovery.mjs";

// Controlled adapter for failure boundaries only. Native upload/restore proof
// belongs to test-release-restore-upgrade-proof.ts, never to this unit fixture.
function store(initial = []) {
  const bucket = {
    id: "private-files",
    public: false,
    file_size_limit: null,
    allowed_mime_types: null,
  };
  const files = new Map(initial.map(([path, text]) => [path, Buffer.from(text)]));
  const state = { writes: 0, reads: 0, failUpload: false, failList: false };
  const storage = {
    async listBuckets() {
      state.reads++;
      return state.failList
        ? { error: new Error("private provider detail") }
        : { data: [bucket], error: null };
    },
    async createBucket() {
      assert.fail("The existing matching bucket must not be rewritten");
    },
    from() {
      return {
        async list(prefix, { offset, limit }) {
          const entries = new Map();
          for (const [path, value] of files) {
            const remainder = prefix
              ? path.startsWith(prefix + "/")
                ? path.slice(prefix.length + 1)
                : null
              : path;
            if (remainder === null) continue;
            const name = remainder.split("/")[0];
            entries.set(
              name,
              remainder.includes("/")
                ? { name, id: null, metadata: null }
                : {
                    name,
                    id: path,
                    metadata: { size: value.length, mimetype: "text/plain" },
                    updated_at: "2026-10-05T00:00:00Z",
                  },
            );
          }
          return {
            data: [...entries.values()]
              .sort((a, b) => a.name.localeCompare(b.name))
              .slice(offset, offset + limit),
            error: null,
          };
        },
        async download(path) {
          return files.has(path)
            ? { data: new Blob([files.get(path)]), error: null }
            : { error: new Error("missing") };
        },
        async upload(path, value, options) {
          assert.equal(options.upsert, false);
          if (state.failUpload || files.has(path))
            return { error: new Error("conflict or unavailable") };
          state.writes++;
          files.set(path, Buffer.from(value));
          return { error: null };
        },
      };
    },
  };
  return { storage, files, state };
}
const sourceOptions = { origin: "http://127.0.0.1:54321" };
const targetOptions = { origin: "http://127.0.0.1:55321" };

test("private paginated backup, read-only plan and safe restore replay retain bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "accelerate-files-unit-"));
  try {
    const source = store(
      Array.from({ length: 105 }, (_, i) => [
        `tenant/nested/file-${String(i).padStart(3, "0")}.txt`,
        `content ${i}`,
      ]),
    );
    source.files.set("tenant/empty.txt", Buffer.alloc(0));
    const directory = join(root, "copy");
    const backup = await backupStorage(source.storage, "source", directory, sourceOptions);
    assert.equal(backup.files, 106);
    assert.equal((await stat(directory)).mode & 0o077, 0);
    assert.equal((await stat(join(directory, "manifest.json"))).mode & 0o077, 0);
    await assert.rejects(
      backupStorage(source.storage, "source", directory, sourceOptions),
      /exist/i,
    );
    const target = store();
    const plan = await restoreStorage(target.storage, "target", directory, targetOptions);
    assert.equal(plan.pending, 106);
    assert.equal(target.state.writes, 0);
    await restoreStorage(target.storage, "target", directory, { ...targetOptions, apply: true });
    assert.deepEqual(target.files, source.files);
    const replay = await restoreStorage(target.storage, "target", directory, {
      ...targetOptions,
      apply: true,
    });
    assert.equal(replay.pending, 0);
    assert.equal(target.state.writes, 106);
    assert.equal(replay.effectsResumeAllowed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("corrupt or redirected local artifacts fail before target access", async () => {
  const root = await mkdtemp(join(tmpdir(), "accelerate-files-unit-"));
  try {
    const directory = join(root, "copy"),
      source = store([["tenant/file.txt", "original"]]),
      target = store();
    await backupStorage(source.storage, "source", directory, sourceOptions);
    const path = join(directory, "manifest.json"),
      manifest = JSON.parse(await readFile(path, "utf8"));
    const objectPath = join(directory, "objects", manifest.objects[0].file);
    await writeFile(objectPath, "corrupt!");
    await assert.rejects(
      restoreStorage(target.storage, "target", directory, { ...targetOptions, apply: true }),
      /corrupt/,
    );
    assert.equal(target.state.reads, 0);
    assert.equal(target.state.writes, 0);
    await writeFile(objectPath, "original");
    manifest.objects[0].file = "../../outside";
    await writeFile(path, JSON.stringify(manifest));
    await assert.rejects(
      restoreStorage(target.storage, "target", directory, targetOptions),
      /Invalid recovery file/,
    );
    assert.equal(target.state.reads, 0);
    // Recreate the original manifest to exercise the symlink independently.
    const original = store([["tenant/file.txt", "original"]]);
    const second = join(root, "second");
    await backupStorage(original.storage, "source", second, sourceOptions);
    const m = JSON.parse(await readFile(join(second, "manifest.json"), "utf8"));
    const f = join(second, "objects", m.objects[0].file);
    await rm(f);
    await writeFile(join(root, "outside"), "original");
    await symlink(join(root, "outside"), f);
    await assert.rejects(restoreStorage(target.storage, "target", second, targetOptions), /unsafe/);
    assert.equal(target.state.reads, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("same target and conflicting or concurrent files never overwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "accelerate-files-unit-"));
  try {
    const directory = join(root, "copy"),
      source = store([
        ["tenant/a.txt", "one"],
        ["tenant/z.txt", "two"],
      ]);
    await backupStorage(source.storage, "source", directory, sourceOptions);
    const target = store([["tenant/z.txt", "customer edit"]]);
    await assert.rejects(
      restoreStorage(target.storage, "source", directory, targetOptions),
      /different/,
    );
    await assert.rejects(
      restoreStorage(target.storage, "target", directory, sourceOptions),
      /different/,
    );
    await assert.rejects(
      restoreStorage(target.storage, "target", directory, { ...targetOptions, apply: true }),
      /conflicting/,
    );
    assert.equal(target.state.writes, 0);
    assert.equal(target.files.get("tenant/z.txt").toString(), "customer edit");
    const concurrent = store();
    concurrent.state.failUpload = true;
    await assert.rejects(
      restoreStorage(concurrent.storage, "target", directory, { ...targetOptions, apply: true }),
      /stopped/,
    );
    assert.equal(concurrent.state.writes, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("provider failure leaves an incomplete backup and cannot claim success", async () => {
  const root = await mkdtemp(join(tmpdir(), "accelerate-files-unit-"));
  try {
    const source = store();
    source.state.failList = true;
    const directory = join(root, "copy");
    await assert.rejects(
      backupStorage(source.storage, "source", directory, sourceOptions),
      /inventory failed/,
    );
    await assert.rejects(readFile(join(directory, "manifest.json")), /ENOENT/);
    await assert.rejects(
      restoreStorage(store().storage, "target", directory, targetOptions),
      /ENOENT/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
