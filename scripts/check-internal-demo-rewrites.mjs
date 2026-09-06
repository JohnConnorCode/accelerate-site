import assert from "node:assert/strict";

const base = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018");
assert.ok(
  base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "Internal rewrite verification requires a local fixture server",
);
const scenarios = [
  "northline-roofing",
  "alder-ridge-law",
  "ledgerstone-advisory",
  "hearthline-realty",
  "common-table-network",
];
for (const scenario of scenarios) {
  for (const route of ["branding", "plugins"]) {
    const path = `/demo/command-center/${scenario}/${route}`;
    const response = await fetch(new URL(path, base), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    // Consume the document so connections are reusable and rendering errors
    // cannot hide behind successful response headers. No retry masks failures.
    const document = await response.text();
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
    assert.ok(!document.includes("Internal Server Error"), `${path} rendered a server error`);
    const rewrite = response.headers.get("x-middleware-rewrite");
    assert.ok(
      rewrite?.startsWith("/admin/"),
      `${path} must rewrite internally; received ${rewrite}`,
    );
    const destination = new URL(rewrite, base);
    assert.equal(destination.pathname, `/admin/${route}`);
    assert.equal(destination.searchParams.get("__demoScenario"), scenario);
  }
}
console.log(
  "PASS: five fictional workspaces use internal admin rewrites, without HTTP self-proxying.",
);
