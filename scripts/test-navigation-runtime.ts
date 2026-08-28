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
const styles = readFileSync("src/app/globals.css", "utf8");

assert.match(runtime, /history\.scrollRestoration = "manual"/, "Navigation runtime must own browser restoration");
assert.match(runtime, /registerAdminScroller/, "Navigation runtime must support the admin scroll viewport");
assert.match(runtime, /focus\(\{ preventScroll: true \}\)/, "Route focus must not fight scroll placement");
assert.match(runtime, /new MutationObserver\(/, "Streamed route focus must follow the DOM handoff instead of fixed retry timers");
assert.doesNotMatch(runtime, /setTimeout\(focusDestination/, "Streamed route focus must not guess at network timing");
assert.match(runtime, /data-admin-route-loading/, "Focus must wait for the real destination instead of targeting a fallback");
assert.match(runtime, /pendingHref/, "Navigation intent must expose the destination before its data commits");
assert.match(runtime, /nextIntent\.kind === "push" && nextId === currentEntryId\.current/, "A pushed history entry must not reuse the origin's scroll receipt id");
assert.match(pageTransition, /shouldAnimateRoute/, "Public route entry must distinguish hydration from navigation");
assert.match(shell, /ref=\{mainRef\}/, "Admin main must register its application scroll viewport");
assert.match(shell, /<AdminRouteStage routeKey=\{routeKey\}>/, "Every committed admin destination, including a direct load, must use the shared route-stage owner");
assert.doesNotMatch(shell, /shouldAnimateRoute/, "Admin entrance must not be disabled on the first committed destination");
assert.doesNotMatch(shell, /adminPageVariants/, "Admin shell must not retain a second Framer route entrance");
assert.match(routeStage, /data-admin-route-stage/, "The route-stage owner must remain observable for browser QA");
assert.match(routeStage, /prefers-reduced-motion: reduce/, "The route-stage owner must honor reduced motion without changing server markup");
assert.match(routeStage, /new MutationObserver/, "Regional loading completion must not depend on a guessed network timer");
assert.match(shell, /isPendingActive/, "Mobile navigation must acknowledge the intended destination immediately");
assert.match(shell, /data-pending=\{isPendingActive\(link\.href\)/, "Pending navigation state must remain observable for browser QA");
assert.match(shell, /prefetch/, "Primary mobile destinations must use Next prefetching");
assert.doesNotMatch(demo, /document\.addEventListener\("click"/, "Demo navigation must not hijack document clicks");
assert.doesNotMatch(demo, /window\.location\.(assign|replace)/, "Scenario changes must remain client navigations");
assert.doesNotMatch(styles, /html\s*\{[^}]*scroll-behavior:\s*smooth/, "Route scrolling must not inherit global smooth behavior");
const dataSkeleton = readFileSync("src/components/admin/LoadingSkeleton.tsx", "utf8");
assert.equal(existsSync("src/app/admin/loading.tsx"), false, "The root admin layout must not replace committed content with a full-page fallback");
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
assert.match(routeStage, /duration: 360/, "Desktop admin entrance must remain perceptible without delaying useful interaction");
assert.match(routeStage, /translateY\(8px\)/, "Ready regional content must use a restrained semantic rise");
assert.match(routeStage, /delay: index \* 48/, "Committed admin sections must use one bounded semantic stagger");
assert.match(notificationBell, /admin-notifications-open/, "Mobile alerts must publish their shared overlay state");
assert.match(notificationBell, /data-admin-mobile-alerts/, "Mobile alerts must expose their collision boundary to browser QA");
assert.match(notificationBell, /createPortal/, "Viewport-edge alerts must escape transformed shell containing blocks");
assert.match(notificationBell, /useId\(\)/, "Each desktop and mobile alert surface must own a unique accessible id");
assert.match(styles, /body\.admin-notifications-open \.admin-mobile-dock/, "The dock must transition out while a bottom-edge sheet owns the viewport");
assert.match(styles, /body\.admin-mobile-nav-open \.admin-mobile-dock/, "The dock must transition out while the More drawer owns navigation");

const adminPageFiles = readdirSync("src/app/admin", { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name === "page.tsx")
  .map((entry) => join(entry.parentPath, entry.name));
for (const file of adminPageFiles) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /AdminRouteSkeleton/, `${file}: client data loading must not replace the page with the route fallback`);
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
