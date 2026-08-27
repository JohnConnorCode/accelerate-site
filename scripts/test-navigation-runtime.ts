import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const runtime = readFileSync("src/components/navigation/NavigationRuntime.tsx", "utf8");
const pageTransition = readFileSync("src/components/layout/PageTransition.tsx", "utf8");
const shell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
const demo = readFileSync("src/components/admin/AdminDemoBoundary.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

assert.match(runtime, /history\.scrollRestoration = "manual"/, "Navigation runtime must own browser restoration");
assert.match(runtime, /registerAdminScroller/, "Navigation runtime must support the admin scroll viewport");
assert.match(runtime, /focus\(\{ preventScroll: true \}\)/, "Route focus must not fight scroll placement");
assert.match(pageTransition, /shouldAnimateRoute/, "Public route entry must distinguish hydration from navigation");
assert.match(shell, /ref=\{mainRef\}/, "Admin main must register its application scroll viewport");
assert.match(shell, /admin-route-entry/, "Admin must have one content-level route entrance owner");
assert.doesNotMatch(shell, /adminPageVariants/, "Admin shell must not retain a second Framer route entrance");
assert.doesNotMatch(demo, /document\.addEventListener\("click"/, "Demo navigation must not hijack document clicks");
assert.doesNotMatch(demo, /window\.location\.(assign|replace)/, "Scenario changes must remain client navigations");
assert.doesNotMatch(styles, /html\s*\{[^}]*scroll-behavior:\s*smooth/, "Route scrolling must not inherit global smooth behavior");

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
