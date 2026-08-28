import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const arg = (name, fallback) => {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};

const base = process.env.PLAYWRIGHT_BASE_URL || arg("base", "http://localhost:3010");
const profile = arg("profile", "/tmp/accelerate-persistent-browser-profile");
const output = arg("output", "/tmp/accelerate-persistent-profile-qa");
const iterations = Number.parseInt(arg("iterations", "30"), 10);
const phase = arg("phase", "same-release");
const cacheMode = arg("cache", "matrix");
const enforceBudget = !process.argv.includes("--observe-only");
const expectReleaseChange = process.argv.includes("--expect-release-change");
const routes = [
  { slug: "today", label: "Today" },
  { slug: "pipeline", label: "Pipeline" },
  { slug: "conversations", label: "Conversations" },
  { slug: "inbox", label: "Inbox" },
  { slug: "contacts", label: "Contact intake" },
  { slug: "emails", label: "Email Studio" },
  { slug: "campaigns", label: "Campaigns" },
  { slug: "proposals", label: "Proposals" },
  { slug: "email-sequences", label: "Delivery Runs" },
  { slug: "revenue", label: "Revenue" },
  { slug: "clients", label: "Clients" },
  { slug: "bookings", label: "Bookings" },
  { slug: "content", label: "Content" },
  { slug: "resources", label: "Resources" },
  { slug: "ai", label: "AI Workspace" },
  { slug: "analytics", label: "Analytics" },
  { slug: "activity", label: "Activity" },
  { slug: "integrations", label: "Integrations" },
  { slug: "setup", label: "Setup Center" },
  { slug: "features", label: "Feature Board" },
  { slug: "settings", label: "Settings" },
  { slug: "leads", label: "Leads" },
  { slug: "chat-leads", label: "Chat inquiries" },
  { slug: "subscribers", label: "Subscribers" },
  { slug: "partners", label: "Partners" },
  { slug: "website-grades", label: "Website Grades" },
];
const mobilePrimarySlugs = new Set(["today", "pipeline", "conversations", "inbox"]);

if (!Number.isFinite(iterations) || iterations < 4) throw new Error("--iterations must be at least 4");
await mkdir(output, { recursive: true });

const percentile = (values, fraction) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};
const lowerHeaders = (headers = {}) => Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
const isCommandCenterRsc = (request) => request.isRsc && new URL(request.url).pathname.startsWith("/demo/command-center/");
const serializeRequest = (request, servedFromCache) => ({
  ...request,
  servedFromCache: servedFromCache.has(request.requestId),
  requestDeploymentId: request.requestHeaders?.["x-deployment-id"] || null,
  responseDeploymentId: request.responseHeaders?.["x-nextjs-deployment-id"] || null,
  cacheControl: request.responseHeaders?.["cache-control"] || null,
  age: request.responseHeaders?.age || null,
  vary: request.responseHeaders?.vary || null,
  etag: request.responseHeaders?.etag || null,
  vercelCache: request.responseHeaders?.["x-vercel-cache"] || null,
});

async function inspectBrowserStorage(page) {
  return page.evaluate(async () => {
    const registrations = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    const cacheNames = "caches" in globalThis ? await caches.keys() : [];
    const cacheEntries = [];
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      cacheEntries.push({ name, urls: requests.slice(0, 250).map((request) => request.url) });
    }
    return {
      controller: navigator.serviceWorker?.controller?.scriptURL ?? null,
      registrations: registrations.map((registration) => ({
        scope: registration.scope,
        active: registration.active?.scriptURL ?? null,
        waiting: registration.waiting?.scriptURL ?? null,
        installing: registration.installing?.scriptURL ?? null,
      })),
      caches: cacheEntries,
    };
  });
}

async function waitForRouteSettled(page, previousKey, expected) {
  await page.waitForURL((url) => url.pathname.endsWith(`/${expected.slug}`), { waitUntil: "commit", timeout: 15_000 });
  await page.waitForFunction(({ oldKey, slug }) => {
    const stage = document.querySelector("[data-admin-route-stage]");
    const key = stage?.getAttribute("data-admin-route-key") || "";
    return Boolean(stage && key !== oldKey && (key.endsWith(`/${slug}`) || location.pathname.endsWith(`/${slug}`)));
  }, { oldKey: previousKey, slug: expected.slug }, { timeout: 15_000 });
  const committedAt = Date.now();
  const stage = page.locator("[data-admin-route-stage]");
  await stage.evaluate(async (node) => {
    await Promise.all(node.getAnimations({ subtree: false }).map((animation) => animation.finished.catch(() => undefined)));
  });
  const settledAt = Date.now();
  const rendered = await page.evaluate(() => ({
    pathname: location.pathname,
    heading: document.querySelector(".admin-main h1")?.textContent?.replace(/\s+/g, " ").trim() || "",
    routeKey: document.querySelector("[data-admin-route-stage]")?.getAttribute("data-admin-route-key") || "",
  }));
  return { committedAt, settledAt, rendered };
}

async function runProfile({ label, userDataDir, cacheDisabled, seedLegacyPositions = false }) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: "no-preference",
  });
  if (seedLegacyPositions) {
    await context.addInitScript(({ key, count }) => {
      try {
        const positions = {};
        for (let index = 0; index < count; index += 1) positions[`legacy-${index}`] = index % 1_000;
        sessionStorage.setItem(key, JSON.stringify(positions));
      } catch {
        // Sandboxed third-party frames do not expose same-origin storage.
      }
    }, { key: "accelerate:navigation-positions", count: 5_000 });
  }
  const page = context.pages()[0] || await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Network.enable", { maxTotalBufferSize: 100_000_000, maxResourceBufferSize: 10_000_000 });
  await session.send("Network.setCacheDisabled", { cacheDisabled });

  const requests = new Map();
  const runtimeErrors = [];
  const servedFromCache = new Set();
  session.on("Network.requestServedFromCache", ({ requestId }) => servedFromCache.add(requestId));
  session.on("Network.requestWillBeSent", (event) => {
    const headers = lowerHeaders(event.request.headers);
    const isRsc = event.request.url.includes("_rsc=") || headers.rsc === "1" || headers.accept?.includes("text/x-component");
    const record = requests.get(event.requestId) || { redirects: [] };
    if (event.redirectResponse) record.redirects.push({ url: event.redirectResponse.url, status: event.redirectResponse.status, headers: lowerHeaders(event.redirectResponse.headers) });
    Object.assign(record, {
      requestId: event.requestId,
      url: event.request.url,
      method: event.request.method,
      type: event.type,
      isRsc,
      requestHeaders: headers,
      startMonotonic: event.timestamp,
      startWallMs: event.wallTime * 1000,
    });
    requests.set(event.requestId, record);
  });
  session.on("Network.responseReceived", (event) => {
    const record = requests.get(event.requestId);
    if (!record) return;
    const response = event.response;
    Object.assign(record, {
      status: response.status,
      mimeType: response.mimeType,
      responseHeaders: lowerHeaders(response.headers),
      fromDiskCache: Boolean(response.fromDiskCache),
      fromServiceWorker: Boolean(response.fromServiceWorker),
      fromPrefetchCache: Boolean(response.fromPrefetchCache),
      protocol: response.protocol,
      responseMonotonic: event.timestamp,
    });
  });
  session.on("Network.loadingFinished", (event) => {
    const record = requests.get(event.requestId);
    if (!record) return;
    record.finishedMonotonic = event.timestamp;
    record.networkDurationMs = Math.max(0, (event.timestamp - record.startMonotonic) * 1000);
    record.encodedDataLength = event.encodedDataLength;
  });
  session.on("Network.loadingFailed", (event) => {
    const record = requests.get(event.requestId);
    if (record) record.failure = event.errorText;
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("net::ERR_FAILED")) runtimeErrors.push(message.text());
  });

  await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (new URL(base).hostname === "localhost") {
    await page.evaluate(() => {
      const removeDevelopmentPortal = () => document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
      removeDevelopmentPortal();
      new MutationObserver(removeDevelopmentPortal).observe(document.documentElement, { childList: true, subtree: true });
    });
  }
  await page.locator(".admin-shell").waitFor();
  await page.waitForFunction(() => document.documentElement.dataset.motionHydrated === "true");
  const storageBefore = await inspectBrowserStorage(page);
  const consumedRequestIds = new Set(requests.keys());
  const steps = [];

  for (let index = 0; index < iterations; index += 1) {
    const currentPath = new URL(page.url()).pathname;
    const currentIndex = routes.findIndex((route) => currentPath.endsWith(`/${route.slug}`));
    const expected = routes[(currentIndex + 1 + routes.length) % routes.length];
    let link;
    if (mobilePrimarySlugs.has(expected.slug)) {
      link = page.locator(`.admin-mobile-dock a[href$="/${expected.slug}"]`).first();
    } else {
      await page.getByRole("button", { name: "Open More", exact: true }).click();
      await page.locator("#admin-mobile-navigation").waitFor();
      link = page.locator(`#admin-mobile-navigation a[href$="/${expected.slug}"]`).first();
      const sectionButton = link.locator("xpath=ancestor::section[1]").getByRole("button").first();
      if (await sectionButton.getAttribute("aria-expanded") === "false") await sectionButton.click();
    }
    await link.waitFor();
    await link.evaluate((node) => {
      node.addEventListener("click", () => {
        document.documentElement.dataset.qaNavigationClickAt = String(Date.now());
      }, { capture: true, once: true });
    });
    const previousKey = await page.locator("[data-admin-route-stage]").getAttribute("data-admin-route-key");
    await link.click({ noWaitAfter: true });
    const clickAt = Number(await page.locator("html").getAttribute("data-qa-navigation-click-at"));
    const acknowledgedAt = Date.now();
    const settled = await waitForRouteSettled(page, previousKey, expected);
    await page.waitForTimeout(40);
    const navigationRequests = [...requests.values()].filter((request) =>
      !consumedRequestIds.has(request.requestId)
      && request.startWallMs >= clickAt - 150
      && request.startWallMs <= settled.settledAt + 500
      && (request.isRsc || request.type === "Document"),
    ).map((request) => serializeRequest(request, servedFromCache));
    for (const request of navigationRequests) consumedRequestIds.add(request.requestId);
    steps.push({
      index: index + 1,
      destination: expected.slug,
      clickAt,
      acknowledgedAt,
      committedAt: settled.committedAt,
      settledAt: settled.settledAt,
      acknowledgeMs: acknowledgedAt - clickAt,
      commitMs: settled.committedAt - clickAt,
      settleMs: settled.settledAt - settled.committedAt,
      rendered: settled.rendered,
      requests: navigationRequests,
    });
  }

  const storageAfter = await inspectBrowserStorage(page);
  const navigationPositionStorage = await page.evaluate(() => {
    const raw = sessionStorage.getItem("accelerate:navigation-positions") || "{}";
    try { return { bytes: raw.length, entries: Object.keys(JSON.parse(raw)).length }; }
    catch { return { bytes: raw.length, entries: -1 }; }
  });
  const network = [...requests.values()]
    .filter((request) => request.isRsc || request.type === "Document")
    .map((request) => serializeRequest(request, servedFromCache));
  const releaseIds = [...new Set([...requests.values()].flatMap((request) => [...request.url.matchAll(/[?&]dpl=([A-Za-z0-9_-]+)/g)].map((match) => match[1])))];
  const summary = {
    label,
    phase,
    base,
    cacheDisabled,
    iterations,
    releaseIds,
    acknowledgeP95Ms: percentile(steps.map((step) => step.acknowledgeMs), 0.95),
    commitMedianMs: percentile(steps.map((step) => step.commitMs), 0.5),
    commitP95Ms: percentile(steps.map((step) => step.commitMs), 0.95),
    commitMaxMs: Math.max(...steps.map((step) => step.commitMs)),
    documentNavigations: steps.flatMap((step) => step.requests).filter((request) => request.type === "Document").length,
    rscRequests: network.filter(isCommandCenterRsc).length,
    cachedRscResponses: network.filter((request) => isCommandCenterRsc(request) && (request.fromDiskCache || request.servedFromCache)).length,
    serviceWorkerRscResponses: network.filter((request) => isCommandCenterRsc(request) && request.fromServiceWorker).length,
    navigationPositionStorage,
    runtimeErrors,
  };
  const trace = { summary, storageBefore, storageAfter, network, steps };
  await writeFile(join(output, `${label}.json`), `${JSON.stringify(trace, null, 2)}\n`);
  await page.screenshot({ path: join(output, `${label}.png`), fullPage: false });
  await context.close();
  return trace;
}

const configurations = cacheMode === "matrix"
  ? [
      { label: "persistent-cache-enabled", userDataDir: profile, cacheDisabled: false, seedLegacyPositions: true },
      { label: "persistent-cache-disabled", userDataDir: profile, cacheDisabled: true },
      { label: "persistent-cache-reenabled", userDataDir: profile, cacheDisabled: false },
      { label: "fresh-cache-enabled", userDataDir: await mkdtemp(join(tmpdir(), "accelerate-fresh-browser-profile-")), cacheDisabled: false },
    ]
  : [{ label: `${phase}-cache-${cacheMode}`, userDataDir: profile, cacheDisabled: cacheMode === "disabled" }];

const traces = [];
for (const configuration of configurations) traces.push(await runProfile(configuration));

const failures = [];
for (const trace of traces) {
  const { summary, storageBefore, network, steps } = trace;
  if (storageBefore.controller || storageBefore.registrations.length || storageBefore.caches.length) failures.push(`${summary.label}: unexpected service worker or Cache Storage controls the origin (${JSON.stringify(storageBefore)})`);
  if (summary.runtimeErrors.length) failures.push(`${summary.label}: runtime errors (${summary.runtimeErrors.join(" | ")})`);
  if (summary.releaseIds.length > 1) failures.push(`${summary.label}: mixed deployment identities (${summary.releaseIds.join(", ")})`);
  if (summary.documentNavigations) failures.push(`${summary.label}: ${summary.documentNavigations} repeated document navigation(s) replaced client routing`);
  if (!summary.cacheDisabled && summary.cachedRscResponses) failures.push(`${summary.label}: ${summary.cachedRscResponses} RSC response(s) came from browser cache`);
  if (summary.serviceWorkerRscResponses) failures.push(`${summary.label}: ${summary.serviceWorkerRscResponses} RSC response(s) came from a service worker`);
  if (summary.navigationPositionStorage.entries < 0 || summary.navigationPositionStorage.entries > 64) failures.push(`${summary.label}: returning-profile navigation receipts were not bounded (${JSON.stringify(summary.navigationPositionStorage)})`);
  for (const step of steps) {
    if (!step.rendered.pathname.endsWith(`/${step.destination}`) || !step.rendered.routeKey.endsWith(`/${step.destination}`)) failures.push(`${summary.label} step ${step.index}: URL and committed route disagree (${JSON.stringify(step.rendered)})`);
    if (!step.rendered.heading) failures.push(`${summary.label} step ${step.index}: committed route has no heading`);
  }
  for (const request of network.filter(isCommandCenterRsc)) {
    if (request.mimeType && !request.mimeType.includes("text/x-component")) failures.push(`${summary.label}: RSC request returned ${request.mimeType} for ${request.url}`);
    if (request.cacheControl && !/no-store|private/.test(request.cacheControl)) failures.push(`${summary.label}: reusable RSC cache policy ${request.cacheControl} for ${request.url}`);
    if (request.vary && !request.vary.toLowerCase().includes("rsc")) failures.push(`${summary.label}: RSC response lacks Vary separation (${request.vary}) for ${request.url}`);
  }
  for (const slug of new Set(steps.map((step) => step.destination))) {
    const observed = network.some((request) => isCommandCenterRsc(request) && new URL(request.url).pathname.endsWith(`/${slug}`));
    if (!observed) failures.push(`${summary.label}: no RSC payload was observed for visited route ${slug}`);
  }
  if (enforceBudget) {
    if (summary.acknowledgeP95Ms > 100) failures.push(`${summary.label}: click acknowledgement p95 ${summary.acknowledgeP95Ms}ms exceeds 100ms`);
    if (summary.commitP95Ms > 750) failures.push(`${summary.label}: route commit p95 ${summary.commitP95Ms}ms exceeds 750ms`);
    if (summary.commitMaxMs > 1_500) failures.push(`${summary.label}: route commit max ${summary.commitMaxMs}ms exceeds 1500ms`);
  }
}

if (traces.length > 1) {
  const persistent = traces.find((trace) => trace.summary.label === "persistent-cache-reenabled")?.summary;
  const fresh = traces.find((trace) => trace.summary.label === "fresh-cache-enabled")?.summary;
  if (persistent && fresh && enforceBudget) {
    const allowed = Math.max(fresh.commitP95Ms * 1.2, fresh.commitP95Ms + 150);
    if (persistent.commitP95Ms > allowed) failures.push(`persistent profile commit p95 ${persistent.commitP95Ms}ms is materially slower than fresh ${fresh.commitP95Ms}ms (allowed ${allowed.toFixed(0)}ms)`);
  }
}

const historyFile = join(output, "release-history.json");
const history = await readFile(historyFile, "utf8").then(JSON.parse).catch(() => []);
if (expectReleaseChange) {
  const previous = [...history].reverse().find((entry) => entry.phase !== phase);
  const previousIds = new Set(previous?.traces.flatMap((trace) => trace.releaseIds) || []);
  const currentIds = new Set(traces.flatMap((trace) => trace.summary.releaseIds));
  if (!previous || !previousIds.size || !currentIds.size) failures.push("release-change QA requires populated deployment identities in both phases");
  if ([...currentIds].some((id) => previousIds.has(id))) failures.push(`release-change QA retained the previous deployment identity (${[...currentIds].filter((id) => previousIds.has(id)).join(", ")})`);
}
history.push({ at: new Date().toISOString(), phase, traces: traces.map((trace) => trace.summary) });
await writeFile(historyFile, `${JSON.stringify(history.slice(-20), null, 2)}\n`);
await writeFile(join(output, "summary.json"), `${JSON.stringify({ result: failures.length ? "failed" : "passed", phase, traces: traces.map((trace) => trace.summary), failures }, null, 2)}\n`);

if (failures.length) {
  console.error(`Persistent profile QA failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", phase, profile, traces: traces.map((trace) => trace.summary), artifacts: output }, null, 2));
