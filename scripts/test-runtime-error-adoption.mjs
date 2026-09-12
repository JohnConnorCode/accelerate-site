import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { silentCatches, compareBaseline, scanRuntime } from "./verify-runtime-error-adoption.mjs";

test("AST detects empty handlers through comments, optional calls and wrappers", () => {
  const source = `try { work() } catch (e) { /* omitted */ }
 job.catch(() => {});
 job.catch(async function(e) { // nothing
 });
 job?.catch?.((() => {}) as Handler);
 job["catch"](function named() {});`;
  assert.deepEqual(
    silentCatches(source).map((x) => x.line),
    [1, 2, 3, 5, 6],
  );
  assert.equal(silentCatches("job.catch(<Handler>(()=>{}))", "fixture.ts").length, 1);
});
test("prose and real handlers do not match", () => {
  assert.deepEqual(
    silentCatches(
      'const text="try {} catch(e) {}"; // job.catch(()=>{})\n try { work() } catch { throw new Error("failed") }\njob.catch(error => report(error));\njob.catch(function(e) { return retry(e); });',
    ),
    [],
  );
});
test("exact budgets reject growth, padding, invalid counts, deleted files and stale allowances", () => {
  const sites = [{ line: 2, kind: "empty catch" }];
  assert.deepEqual(compareBaseline({ "one.ts": sites }, { "one.ts": 1 }), []);
  assert.match(compareBaseline({ "new.ts": sites }, {})[0].reason, /increased/);
  assert.match(compareBaseline({ "one.ts": sites }, { "one.ts": 2 })[0].reason, /Stale/);
  assert.match(compareBaseline({}, { "deleted.ts": 1 })[0].reason, /Stale/);
  assert.match(compareBaseline({}, { "padded.ts": 0 })[0].reason, /Invalid/);
  assert.match(compareBaseline({}, { "padded.ts": 1.5 })[0].reason, /Invalid/);
});
test("file scanner reports deterministic source-relative diagnostics and removed allowances", () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-adoption-"));
  try {
    const dir = join(root, "src/lib/revenue-os");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "z.ts"), "try {} catch {}");
    writeFileSync(join(dir, "a.tsx"), "const view=<p>catch text</p>;\njob.catch(()=>{});");
    const findings = scanRuntime(root);
    assert.deepEqual(Object.keys(findings), [
      "src/lib/revenue-os/a.tsx",
      "src/lib/revenue-os/z.ts",
    ]);
    assert.deepEqual(findings["src/lib/revenue-os/a.tsx"], [
      { line: 2, kind: "empty .catch handler" },
    ]);
    assert.deepEqual(scanRuntime(root), findings);
    rmSync(join(dir, "z.ts"));
    assert(
      compareBaseline(scanRuntime(root), {
        "src/lib/revenue-os/a.tsx": 1,
        "src/lib/revenue-os/z.ts": 1,
      }).some((x) => x.file.endsWith("z.ts") && x.reason.startsWith("Stale")),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
