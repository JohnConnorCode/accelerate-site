import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pluginDocumentationFailures } from "./lib/plugin-documentation.mjs";

test("bundled documentation refuses omissions and unsafe or mismatched links", () => {
  const root = mkdtempSync(join(tmpdir(), "plugin-docs-"));
  const manifest = {
    id: "test-plugin",
    docsUrl:
      "https://github.com/JohnConnorCode/accelerate-site/blob/main/plugins/test-plugin/README.md",
  };
  try {
    assert.match(pluginDocumentationFailures(root, manifest).join(), /missing operator guide/);
    mkdirSync(join(root, "plugins/test-plugin"), { recursive: true });
    const path = join(root, "plugins/test-plugin/README.md");
    writeFileSync(path, "# Test plugin\n\n");
    assert.match(pluginDocumentationFailures(root, manifest).join(), /title and content/);
    writeFileSync(path, "# Test plugin\n\nFollow this documented task.\n");
    assert.deepEqual(pluginDocumentationFailures(root, manifest), []);
    for (const docsUrl of [
      undefined,
      "",
      "javascript:alert(1)",
      "http://example.org/docs",
      "https://secret@example.org/docs",
      "not a URL",
    ])
      assert.ok(
        pluginDocumentationFailures(root, { ...manifest, docsUrl }).length,
        String(docsUrl),
      );
    assert.match(
      pluginDocumentationFailures(root, {
        ...manifest,
        docsUrl: manifest.docsUrl.replace("test-plugin/", "wrong-plugin/"),
      }).join(),
      /this plugin's guide/,
    );
    for (const docsUrl of ["https://example.org/docs/plugin", "/docs/extend/plugins"])
      assert.deepEqual(pluginDocumentationFailures(root, { ...manifest, docsUrl }), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
