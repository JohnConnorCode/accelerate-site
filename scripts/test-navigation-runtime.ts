import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const runtime = readFileSync("src/components/navigation/NavigationRuntime.tsx", "utf8");
const pageTransition = readFileSync("src/components/layout/PageTransition.tsx", "utf8");
const shell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
const demo = readFileSync("src/components/admin/AdminDemoBoundary.tsx", "utf8");
const notificationBell = readFileSync("src/components/admin/NotificationBell.tsx", "utf8");
const pageLoading = readFileSync("src/components/admin/AdminPageLoading.tsx", "utf8");
const routeStage = readFileSync("src/components/admin/AdminRouteStage.tsx", "utf8");
const asyncRegion = readFileSync("src/components/admin/AdminAsyncRegion.tsx", "utf8");
const dialog = readFileSync("src/components/admin/AdminDialog.tsx", "utf8");
const pageHeader = readFileSync("src/components/admin/PageHeader.tsx", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const productionRelease = readFileSync("scripts/next-release.mjs", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

assert.match(runtime, /history\.scrollRestoration = "manual"/, "Navigation runtime must own browser restoration");
assert.match(runtime, /registerAdminScroller/, "Navigation runtime must support the admin scroll viewport");
assert.match(runtime, /focus\(\{ preventScroll: true \}\)/, "Route focus must not fight scroll placement");
assert.match(runtime, /new MutationObserver\(/, "Streamed route focus must follow the DOM handoff instead of fixed retry timers");
assert.doesNotMatch(runtime, /setTimeout\(focusDestination/, "Streamed route focus must not guess at network timing");
assert.match(runtime, /data-admin-route-loading/, "Focus must wait for the real destination instead of targeting a fallback");
assert.match(runtime, /pendingHref/, "Navigation intent must expose the destination before its data commits");
assert.match(runtime, /dataset\.navigationPhase = pending \? "pending" : "idle"/, "The document must expose same-frame navigation intent for perceptual QA");
assert.match(runtime, /nextIntent\.kind === "push" && nextId === currentEntryId\.current/, "A pushed history entry must not reuse the origin's scroll receipt id");
assert.match(runtime, /MAX_PERSISTED_POSITIONS = 64/, "Returning profiles must keep a bounded scroll-receipt history");
assert.match(runtime, /requestIdleCallback/, "Scroll receipt persistence must stay off the navigation frame");
assert.match(runtime, /while \(positions\.size > MAX_PERSISTED_POSITIONS\)/, "Legacy scroll receipts must be trimmed instead of growing indefinitely");
assert.match(pageTransition, /shouldAnimateRoute/, "Public route entry must distinguish hydration from navigation");
assert.match(pageTransition, /isLeaving/, "Public navigation must acknowledge intent before the destination commits");
assert.match(shell, /ref=\{mainRef\}/, "Admin main must register its application scroll viewport");
assert.match(shell, /<AdminRouteStage routeKey=\{routeKey\}>/, "Every committed admin destination, including a direct load, must use the shared route-stage owner");
assert.doesNotMatch(shell, /shouldAnimateRoute/, "Admin entrance must not be disabled on the first committed destination");
assert.doesNotMatch(shell, /adminPageVariants/, "Admin shell must not retain a second Framer route entrance");
assert.match(routeStage, /data-admin-route-stage/, "The route-stage owner must remain observable for browser QA");
assert.match(routeStage, /className="admin-route-stage"/, "The route-stage entrance state must ship in committed markup before first paint");
assert.doesNotMatch(routeStage, /useEffect|\.animate\(|MutationObserver/, "Route motion must not start after paint from a client effect");
assert.match(styles, /@keyframes admin-route-stage-in/, "The shared CSS route entrance must remain defined");
assert.match(styles, /@keyframes admin-route-section-in/, "Committed route sections must share one bounded stagger");
assert.match(styles, /data-navigation-pending="true"/, "Retained admin content must visibly acknowledge destination intent");
assert.match(shell, /isPendingActive/, "Mobile navigation must acknowledge the intended destination immediately");
assert.match(shell, /data-pending=\{isPendingActive\(link\.href\)/, "Pending navigation state must remain observable for browser QA");
assert.match(shell, /--admin-mobile-dock-index/, "The mobile dock must use one persistent position-driven indicator");
assert.doesNotMatch(shell, /layoutId="admin-mobile-dock-active"/, "The mobile dock indicator must not run layout projection while route DOM is replacing");
assert.match(shell, /prefetch/, "Primary mobile destinations must use Next prefetching");
assert.match(shell, /data-navigation-pending=\{routeIsPending/, "The persistent admin shell must publish pending route state");
assert.doesNotMatch(demo, /document\.addEventListener\("click"/, "Demo navigation must not hijack document clicks");
assert.doesNotMatch(demo, /window\.location\.(assign|replace)/, "Scenario changes must remain client navigations");
assert.doesNotMatch(styles, /html\s*\{[^}]*scroll-behavior:\s*smooth/, "Route scrolling must not inherit global smooth behavior");
const dataSkeleton = readFileSync("src/components/admin/LoadingSkeleton.tsx", "utf8");
assert.equal(existsSync("src/app/admin/loading.tsx"), false, "The root admin layout must not replace committed content with a full-page fallback");
assert.equal(existsSync("src/app/(marketing)/loading.tsx"), true, "Public navigations need a marketing loading region under the shared chrome");
const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
assert.doesNotMatch(rootLayout, /components\/layout\/Header/, "Marketing chrome must not hydrate on admin through the root layout");
assert.match(readFileSync("src/app/(marketing)/layout.tsx", "utf8"), /MarketingChrome/, "Public routes must own Header, Footer, Chat, and Dock");
assert.doesNotMatch(readFileSync("src/components/v2/studio/Studio.tsx", "utf8"), /"use client"/, "Homepage composition must stay a server component");
assert.match(readFileSync("src/app/(marketing)/learn/page.tsx", "utf8"), /getArticleSummaries/, "Learn listings must not serialize MDX bodies");
assert.doesNotMatch(readFileSync("src/app/(marketing)/learn/page.tsx", "utf8"), /getAllArticles\(/, "Learn listings must not serialize MDX bodies");
const hero = readFileSync("src/components/home/Hero.tsx", "utf8");
assert.match(hero, /const \[loaded, setLoaded\] = useState\(false\)/, "Hero must start unloaded so PROFIT and the CTA can transition in");
assert.match(hero, /eyebrow-anim rv\$\{loaded \? " in" : ""\}/, "Hero eyebrow must wait on the same loaded gate as the rest of the sequence");
assert.doesNotMatch(hero, /reveal-immediate/, "Hero copy must not skip its authored entrance");
assert.match(styles, /\.motion-ready \.hero:not\(\.loaded\) \.swap/, "PROFIT must stay hidden until the loaded gate flips");
assert.match(styles, /\.motion-ready \.hero:not\(\.loaded\) \.hero-inline-cta/, "The hero CTA must stay hidden until the loaded gate flips");
assert.match(styles, /\.loaded \.swap \{[^}]*transition:/, "PROFIT entrance is a delayed transition off .loaded, not a first-paint rest state");
assert.match(styles, /\.loaded \.hero-inline-cta \{[^}]*transition:/, "Hero CTA entrance is a delayed transition off .loaded");
assert.doesNotMatch(styles, /\.motion-ready \.hero \.rv:not\(\.in\)/, "Hero rv copy must not bypass the loaded entrance");
const rootNotFound = readFileSync("src/app/not-found.tsx", "utf8");
const marketingNotFound = readFileSync("src/app/(marketing)/not-found.tsx", "utf8");
assert.match(rootNotFound, /MarketingChrome/, "Unmatched URLs have no marketing layout, so the root 404 must wrap chrome");
assert.match(rootNotFound, /NotFoundBody/, "Root and marketing 404s must share one body");
assert.doesNotMatch(marketingNotFound, /MarketingChrome/, "Marketing notFound() already sits inside MarketingChrome");
assert.match(marketingNotFound, /NotFoundBody/, "Marketing 404 must render the shared body without a second shell");
assert.match(asyncRegion, /data-admin-async-state/, "Client loading must remain observable inside the region that owns it");
assert.match(asyncRegion, /delayMs/, "Fast reads must not flash a regional skeleton");
assert.match(asyncRegion, /window\.setTimeout\(\(\) => setShowFallback\(true\), delayMs\)/, "The shared async region must enforce its loading threshold behaviorally");
assert.match(asyncRegion, /requestAnimationFrame\(\(\) => setShowFallback\(false\)\)/, "A later load must reset the fallback without a synchronous effect cascade");
assert.match(asyncRegion, /data-admin-async-visible/, "The delayed regional fallback must remain observable in browser timing QA");
assert.match(asyncRegion, /hasData/, "Cached data must remain visible during a refetch");
assert.match(dataSkeleton, /admin-skeleton-shape/, "Client-data skeletons must use the semantic admin loading tokens");
assert.doesNotMatch(dataSkeleton, /animate-pulse|bg-white\//, "Legacy dark-only skeleton styling must not return");
assert.match(pageLoading, /PageHeader/, "Client data loading must preserve the destination's real page identity");
assert.match(pageLoading, /admin-async-region/, "Client data loading must be scoped to an authored regional transition");
assert.match(styles, /admin-route-section-in 180ms/, "Admin entrance must remain perceptible without delaying useful interaction");
assert.match(styles, /translateY\(6px\)/, "Ready route content must use a restrained semantic rise");
assert.match(styles, /nth-child\(n \+ 5\).*72ms/, "Committed admin sections must cap their semantic stagger");
const adminRouteMotion = styles.slice(styles.indexOf("@keyframes admin-route-stage-in"), styles.indexOf("@keyframes admin-skeleton-reveal"));
assert.doesNotMatch(adminRouteMotion, /filter:/, "Admin route motion must not blur full mobile page layers");
assert.doesNotMatch(styles, /\.admin-shell \*,\s*\n\s*\.admin-shell \*::before/, "Reduced motion must not globally destroy every admin transition");
assert.match(dialog, /<AnimatePresence mode="sync">/, "The shared dialog must animate an initially opened controlled surface");
assert.doesNotMatch(dialog, /<AnimatePresence initial=\{false\}/, "The shared dialog must not suppress entry when a caller opens on mount");
assert.match(dialog, /data-admin-overlay="dialog"/, "Dialog motion must remain observable in browser QA");
assert.match(pageHeader, /utilityActions/, "Compact sync and refresh actions must not consume a full mobile row");
assert.match(nextConfig, /deploymentId:/, "Next deployment skew protection must remain enabled");
assert.match(nextConfig, /runtimeServerDeploymentId:\s*false/, "Prebuilt releases must keep the build-time custom id authoritative at runtime");
assert.match(packageJson, /node scripts\/next-release\.mjs vercel-build/, "Prebuilt production deploys must use the deployment-aware release runner");
assert.match(packageJson, /node scripts\/next-release\.mjs vercel-deploy/, "Prebuilt production upload must use the verified release runner");
assert.match(packageJson, /"build":\s*"node scripts\/next-release\.mjs build"/, "Local production builds must embed the release identity used by start");
assert.match(packageJson, /node scripts\/next-release\.mjs start/, "Local production QA must use the same deployment-aware release runner");
assert.match(productionRelease, /NEXT_DEPLOYMENT_ID/, "The build must receive one immutable custom deployment id");
assert.match(productionRelease, /git[\s\S]*rev-parse/, "The release runner must derive its id from the committed release");
assert.match(productionRelease, /required-server-files\.json[\s\S]*command-center\.prerender-fallback\.html/, "The upload must verify Next's serialized config and emitted document identity first");
assert.match(productionRelease, /runtimeServerDeploymentId[\s\S]*!== false/, "The upload must fail closed if Next can override the custom id at runtime");
assert.match(productionRelease, /mode === "verify-prebuilt"/, "The release identity gate must be testable without invoking a deployment");
assert.doesNotMatch(productionRelease, /"--env"[\s\S]*NEXT_DEPLOYMENT_ID/, "The prebuilt upload must not inject a competing runtime deployment id");
assert.doesNotMatch(nextConfig, /VERCEL_DEPLOYMENT_ID/, "The reserved platform deployment id must not override a prebuilt custom id");
assert.match(notificationBell, /admin-notifications-open/, "Mobile alerts must publish their shared overlay state");
assert.match(notificationBell, /data-admin-mobile-alerts/, "Mobile alerts must expose their collision boundary to browser QA");
assert.match(notificationBell, /createPortal/, "Viewport-edge alerts must escape transformed shell containing blocks");
assert.match(notificationBell, /`admin-notifications-\$\{placement\}`/, "Each alert placement must own a unique hydration-stable accessible id");
assert.match(styles, /body\.admin-notifications-open \.admin-mobile-dock/, "The dock must transition out while a bottom-edge sheet owns the viewport");
assert.match(styles, /body\.admin-mobile-nav-open \.admin-mobile-dock/, "The dock must transition out while the More drawer owns navigation");

const adminPageFiles = readdirSync("src/app/admin", { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name === "page.tsx")
  .map((entry) => join(entry.parentPath, entry.name));
for (const file of adminPageFiles) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /AdminRouteSkeleton/, `${file}: client data loading must not replace the page with the route fallback`);
  assert.doesNotMatch(source, /\{[^\n]*&&\s*<AdminDialog/, `${file}: controlled dialogs must stay mounted so exit motion can finish`);
}

const coreAdminPages = [
  "src/app/admin/today/page.tsx",
  "src/app/admin/pipeline/page.tsx",
  "src/app/admin/conversations/page.tsx",
  "src/app/admin/analytics/page.tsx",
  "src/app/admin/campaigns/page.tsx",
  "src/app/admin/emails/page.tsx",
  "src/app/admin/features/page.tsx",
  "src/app/admin/pipeline/[id]/page.tsx",
  "src/app/admin/integrations/page.tsx",
  "src/app/admin/inbox/page.tsx",
  "src/app/admin/bookings/page.tsx",
];
for (const file of coreAdminPages) {
  const source = readFileSync(file, "utf8");
  assert.match(source, /useAdminQuery/, `${file} must use the shared cancellable admin query cache`);
  assert.match(source, /AdminAsyncRegion|AdminReadBody/, `${file} must keep delayed regional loading instead of blanking the route`);
  assert.doesNotMatch(source, /return <AdminPageLoading/, `${file} must not replace committed page identity with a full-page loader`);
}

const today = readFileSync("src/app/admin/today/page.tsx", "utf8");
const notifications = readFileSync("src/components/admin/NotificationBell.tsx", "utf8");
const aiChat = readFileSync("src/components/admin/AdminAIChat.tsx", "utf8");
const aiCommand = readFileSync("src/components/admin/RevenueAICommand.tsx", "utf8");
const conversations = readFileSync("src/app/admin/conversations/page.tsx", "utf8");
assert.doesNotMatch(today, /function queueIcon/, "Homogeneous Today rows must not regain repeated leading icons");
assert.doesNotMatch(notifications, /priorityIcons/, "Homogeneous priority alerts must not regain repeated leading icons");
for (const [file, source] of [["AdminAIChat", aiChat], ["RevenueAICommand", aiCommand], ["Conversations", conversations]] as const) {
  assert.match(source, /admin-composer/, `${file} must use the shared composer surface`);
  assert.match(source, /admin-composer-field/, `${file} must use the shared composer field`);
  assert.match(source, /admin-composer-action/, `${file} must use the shared composer action`);
}

const adminFiles = ["src/app/admin", "src/components/admin"].flatMap((root) => (
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name))
));
for (const file of adminFiles.filter((file) => !file.endsWith("AdminLink.tsx") && !file.endsWith("AdminDemoBoundary.tsx"))) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /from ["']next\/link["']/, `${file}: shared admin links must resolve through AdminLink`);
  assert.doesNotMatch(source, /useRouter/, `${file}: programmatic admin navigation must resolve through useAdminNavigation`);
}

console.log(JSON.stringify({ result: "passed", contract: "navigation-runtime.v1" }, null, 2));
