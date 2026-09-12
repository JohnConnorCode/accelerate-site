// Run after prepare-source.sh. Tests the applied upstream helper with real files.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const root = new URL("./upstream/", import.meta.url);
const temporary = mkdtempSync(join(tmpdir(), "postiz-hardening-"));
try {
  const uploads = join(temporary, "uploads");
  mkdirSync(uploads);
  writeFileSync(join(uploads, "approved.png"), "approved fixture bytes");
  writeFileSync(join(temporary, "private.txt"), "must never escape");
  symlinkSync(join(temporary, "private.txt"), join(uploads, "escape.png"));
  const source = readFileSync(new URL("libraries/helpers/src/utils/read.or.fetch.ts", root), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  let remoteCalls = 0;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, URL, Buffer,
    process: { env: { STORAGE_PROVIDER: "local", FRONTEND_URL: "https://social.example.test", UPLOAD_DIRECTORY: uploads } },
    require: name => name === "axios" ? async () => { remoteCalls++; return { data: Buffer.from("remote fixture") }; } : require(name),
  });
  const read = exports.readOrFetch;
  assert.equal((await read("https://social.example.test/uploads/approved.png")).toString(), "approved fixture bytes");
  assert.equal(remoteCalls, 0, "Private local media must not fetch through the public proxy");
  await assert.rejects(read("https://social.example.test/uploads/escape.png"), /Invalid local media path/);
  await assert.rejects(read("https://social.example.test/uploads/..%2fprivate.txt"), /Invalid local media path/);
  await assert.rejects(read("https://social.example.test/uploads/missing.png"), /ENOENT/);
  assert.equal((await read("https://external.example.test/image.png")).toString(), "remote fixture");
  assert.equal(remoteCalls, 1, "Other provider helper behavior remains unchanged");
  console.log("Patched media reader: local bytes, symlink/traversal refusal, missing file and external-source behavior passed");
} finally { rmSync(temporary, { recursive: true, force: true }); }
