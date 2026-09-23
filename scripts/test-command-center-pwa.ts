import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { resolvePublicWorkspaceHref } from "../src/lib/admin/navigation-paths";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

async function main() {
  const [
    manifest,
    middleware,
    serviceWorker,
    offlineStore,
    pwa,
    docs,
    faq,
    tenants,
    recovery,
    google,
    googleAuthorize,
    googleCallback,
  ] = await Promise.all([
    read("src/app/manifest.ts"),
    read("src/proxy.ts"),
    read("public/command-center-sw.js"),
    read("src/lib/admin/offline-store.ts"),
    read("src/components/admin/CommandCenterPwa.tsx"),
    read("src/content/docs/workspace/overview.mdx"),
    read("src/content/command-center-faq.ts"),
    read("src/app/api/admin/tenants/route.ts"),
    read("src/app/api/admin/password-reset/route.ts"),
    read("src/lib/revenue-os/google.ts"),
    read("src/app/api/admin/google/authorize/route.ts"),
    read("src/app/api/admin/google/callback/route.ts"),
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
  const activation = pwa.slice(pwa.indexOf("const activateUpdate"), pwa.indexOf("const saveDraft"));
  assert.doesNotMatch(activation, /if \(!navigator\.serviceWorker\.controller\)[\s\S]*reload\(\);/);
  assert.match(activation, /controllerchange[\s\S]*waiting\.postMessage/);
  assert.match(docs, /Install Command Center/);
  assert.match(faq, /Can I install Command Center/);
  for (const route of [tenants, recovery, google, googleAuthorize, googleCallback])
    assert.match(route, /commandCenterOrigin/, "Account links must stay on the app origin");

  process.env.NEXT_PUBLIC_COMMAND_CENTER_ORIGIN = "https://app.example.test";
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.test";
  process.env.NEXT_PUBLIC_DISTRIBUTION_PROFILE = "branded";
  const { proxy } = await import("../src/proxy");
  const visit = (host: string, route: string, headers: Record<string, string> = {}) =>
    proxy(
      new NextRequest(`https://${host}${route}`, { headers: { accept: "text/html", ...headers } }),
    );
  assert.equal(
    (await visit("app.example.test", "/")).headers.get("location"),
    "https://app.example.test/workspace",
  );
  assert.equal((await visit("app.example.test", "/workspace")).headers.get("location"), null);
  assert.equal(
    (await visit("internal.example.test", "/", { host: "app.example.test" })).headers.get(
      "location",
    ),
    "https://app.example.test/workspace",
  );
  assert.equal((await visit("app.example.test", "/admin/login")).headers.get("location"), null);
  assert.equal(
    (await visit("app.example.test", "/auth/callback?code=test")).headers.get("location"),
    null,
  );
  assert.equal(
    (await visit("app.example.test", "/command-center-offline.html")).headers.get("location"),
    null,
  );
  assert.equal(
    (await visit("app.example.test", "/docs/workspace/overview?from=app")).headers.get("location"),
    "https://www.example.test/docs/workspace/overview?from=app",
  );
  assert.equal(
    (await visit("app.example.test", "/demo/command-center")).headers.get("location"),
    "https://www.example.test/demo/command-center",
  );
  assert.equal(
    (await visit("app.example.test", "/docs", { accept: "*/*", rsc: "1" })).headers.get("location"),
    "https://www.example.test/docs",
  );
  assert.equal((await visit("app.example.test", "/api/admin/login")).headers.get("location"), null);
  assert.equal((await visit("www.example.test", "/")).headers.get("location"), null);
  assert.equal(
    (await visit("www.example.test", "/admin/login")).headers.get("location"),
    "https://app.example.test/admin/login",
  );
  assert.equal(
    resolvePublicWorkspaceHref("/docs/workspace/overview", "https://www.example.test/"),
    "https://www.example.test/docs/workspace/overview",
  );
  assert.equal(
    resolvePublicWorkspaceHref("/demo/command-center", "https://www.example.test"),
    "https://www.example.test/demo/command-center",
  );
  assert.equal(
    resolvePublicWorkspaceHref("/admin/today", "https://www.example.test"),
    "/admin/today",
  );
  assert.equal(resolvePublicWorkspaceHref("/docs", null), "/docs");

  console.log("Command Center PWA contract checks passed.");
}

void main();
