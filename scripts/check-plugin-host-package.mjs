/** Prove Next's deployable route traces retain the native loader and WASM. */
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { newQuickJSWASMModuleFromVariant, newVariant } from "quickjs-emscripten";
const packageName = "@jitl/quickjs-wasmfile-release-sync";
for (const route of ["plugins/workflow", "plugins/run"]) {
  const trace = resolve(`.next/server/app/api/admin/${route}/route.js.nft.json`);
  const files = JSON.parse(readFileSync(trace, "utf8")).files;
  const fixture = mkdtempSync(join(tmpdir(), "accelerate-engine-package-"));
  try {
    const marker = `/node_modules/${packageName}/`;
    let copied = 0;
    for (const relative of files) {
      const source = resolve(dirname(trace), relative);
      const index = source.indexOf(marker);
      if (index < 0) continue;
      const target = join(
        fixture,
        "node_modules",
        packageName,
        source.slice(index + marker.length),
      );
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
      copied++;
    }
    assert.ok(copied > 0, `${route}: engine package missing from Next trace`);
    const requireFromArtifact = createRequire(join(fixture, "package.json"));
    const loaderPath = requireFromArtifact.resolve(`${packageName}/emscripten-module`);
    assert.ok(loaderPath.startsWith(fixture + "/"), "No fallback to workspace dependencies");
    assert.ok(loaderPath.endsWith(".cjs"), "Must load the native CommonJS entrypoint");
    const variant = requireFromArtifact(packageName).default;
    const engine = await newQuickJSWASMModuleFromVariant(
      newVariant(
        {
          ...variant,
          importModuleLoader: async () => requireFromArtifact(`${packageName}/emscripten-module`),
        },
        { wasmMemory: new WebAssembly.Memory({ initial: 256, maximum: 256 }) },
      ),
    );
    const runtime = engine.newRuntime();
    runtime.setMemoryLimit(8 * 1024 * 1024);
    const context = runtime.newContext();
    try {
      const value = context.unwrapResult(context.evalCode("40 + 2"));
      try {
        assert.equal(context.getNumber(value), 42);
      } finally {
        value.dispose();
      }
    } finally {
      context.dispose();
      runtime.dispose();
    }
    console.log(`${route}: traced Node loader and WASM execute successfully`);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
