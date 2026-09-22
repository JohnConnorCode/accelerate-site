import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

async function main() {
  const [manifest, middleware, serviceWorker, offlineStore, pwa, docs, faq] = await Promise.all([
    read("src/app/manifest.ts"),
    read("src/middleware.ts"),
    read("public/command-center-sw.js"),
    read("src/lib/admin/offline-store.ts"),
    read("src/components/admin/CommandCenterPwa.tsx"),
    read("src/content/docs/workspace/overview.mdx"),
    read("src/content/command-center-faq.ts"),
  ]);

  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /start_url: "\/workspace"/);
  assert.match(manifest, /command-center-icon-192\.png/);
  assert.match(manifest, /display: "browser"/);
  assert.match(middleware, /NEXT_PUBLIC_COMMAND_CENTER_ORIGIN|commandCenterOrigin/);
  assert.match(middleware, /NextResponse\.redirect\(destination, 307\)/);
  assert.match(serviceWorker, /CACHE_NAME = "accelerate-command-center-v1"/);
  assert.match(serviceWorker, /startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /startsWith\("\/auth\/"\)/);
  assert.match(serviceWorker, /caches\.match\(OFFLINE_URL\)/);
  assert.doesNotMatch(serviceWorker, /cache\.put\(request[\s\S]*\/api\//);
  assert.match(offlineStore, /tenantSlug/);
  assert.match(offlineStore, /saveOfflineDraft/);
  assert.doesNotMatch(offlineStore, /fetch\(/);
  assert.match(pwa, /CLEAR_WORKSPACE_CACHE/);
  assert.match(pwa, /pwa_draft_saved/);
  assert.match(pwa, /isCommandCenterHost/);
  assert.match(pwa, /freshSnapshot/);
  assert.match(pwa, /controllerchange/);
  assert.match(pwa, /data-command-center-dialog/);
  assert.match(pwa, /aria-describedby/);
  assert.match(pwa, /event\.key === "Escape"/);
  assert.match(docs, /Install Command Center/);
  assert.match(faq, /Can I install Command Center/);

  console.log("Command Center PWA contract checks passed.");
}

void main();
