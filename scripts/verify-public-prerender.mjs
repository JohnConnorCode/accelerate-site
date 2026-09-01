import { readFileSync } from "node:fs";
import { join } from "node:path";

const manifestPath = join(process.cwd(), ".next", "prerender-manifest.json");
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  console.error(
    `public prerender verification requires a completed production build: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}

const required = [
  "/",
  "/about",
  "/blog",
  "/changelog",
  "/command-center",
  "/open-source",
  "/command-center/demo",
  "/contact",
  "/industries",
  "/industries/auto-dealers",
  "/industries/home-services",
  "/industries/insurance-agencies",
  "/industries/law-firms",
  "/industries/manufacturing",
  "/industries/medical-dental",
  "/industries/nonprofits",
  "/industries/professional-services",
  "/industries/real-estate",
  "/industries/startups",
  "/learn",
  "/packages",
  "/partners",
  "/plan-builder",
  "/privacy",
  "/resources",
  "/results",
  "/roofing",
  "/services",
  "/style-guide",
  "/terms",
  "/work",
  "/work/work-shelter",
  "/work/healthcare-real-estate",
  "/work/superdebate",
  "/work/sparkblox",
  "/work/thrive-protocol",
  "/work/green-goods",
  "/work/northern-trust",
  "/results/sparkblox",
  "/results/farrell-roofing",
  "/results/montoya-capital",
];

const prerendered = new Set(Object.keys(manifest.routes ?? {}));
const missing = required.filter((route) => !prerendered.has(route));
if (missing.length) {
  console.error(`public routes missing from prerender manifest:\n${missing.join("\n")}`);
  process.exit(1);
}

const learnRoutes = [...prerendered].filter(
  (route) => route === "/learn" || route.startsWith("/learn/"),
);
const workRoutes = [...prerendered].filter(
  (route) => route === "/work" || route.startsWith("/work/"),
);
if (learnRoutes.length < 195) {
  console.error(
    `expected the complete generated Learn catalog, found ${learnRoutes.length} prerendered routes`,
  );
  process.exit(1);
}
if (workRoutes.length !== 8) {
  console.error(
    `expected the Work index plus seven cases, found ${workRoutes.length} prerendered routes`,
  );
  process.exit(1);
}

const livePatterns = ["/plan/[token]", "/proposal/[token]"];
const appPaths = JSON.parse(
  readFileSync(join(process.cwd(), ".next", "server", "app-paths-manifest.json"), "utf8"),
);
for (const pattern of livePatterns) {
  if (prerendered.has(pattern) || !appPaths[`${pattern}/page`]) {
    console.error(`live token route did not remain an on-demand application page: ${pattern}`);
    process.exit(1);
  }
}

for (const route of prerendered) {
  if (route === "/admin" || route.startsWith("/admin/") || route.startsWith("/api/admin/")) {
    console.error(`protected route was unexpectedly prerendered: ${route}`);
    process.exit(1);
  }
}

console.log(
  JSON.stringify(
    {
      requiredPublicRoutes: required.length,
      learnRoutes: learnRoutes.length,
      workRoutes: workRoutes.length,
      intentionalLivePatterns: livePatterns,
      protectedRoutesExcluded: true,
      result: "passed",
    },
    null,
    2,
  ),
);
