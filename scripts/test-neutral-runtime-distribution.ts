#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tenant } from "../src/config/tenant";
import { distributionProfile } from "../src/lib/distribution/profile";
import { neutralPublicIdentity } from "../src/lib/distribution/public-identity";
import {
  assertForkHosting,
  gitFiles,
  loadInclusionManifest,
  loadOriginalHosting,
  starterFiles,
} from "./lib/neutral-distribution.mjs";

const cases: { id: string; name: string }[] = [];
function prove(id: string, name: string, fn: () => void) {
  fn();
  cases.push({ id, name });
}

prove("AC1", "unset profile stays branded; explicit neutral is a separate profile", () => {
  assert.equal(distributionProfile({}), "branded");
  assert.equal(distributionProfile({ NEXT_PUBLIC_DISTRIBUTION_PROFILE: "branded" }), "branded");
  assert.equal(distributionProfile({ NEXT_PUBLIC_DISTRIBUTION_PROFILE: "neutral" }), "neutral");
  assert.throws(() => distributionProfile({ NEXT_PUBLIC_DISTRIBUTION_PROFILE: "agency" }));
  assert.match(
    readFileSync("docs/self-hosting/NEUTRAL-DISTRIBUTION.md", "utf8"),
    /branded installation/,
  );
});

prove("AC2", "neutral identity comes from the configured business, not the original domain", () => {
  const harbor = {
    brand: {
      name: "Harbor",
      domain: "harbor.test",
      siteUrl: "https://harbor.test",
      logoMark: "H",
      accentColor: "#000000",
      tagline: "Harbor operations",
      emailFooter: "Harbor · private operations",
    },
    ai: {
      businessDescriptor: "Harbor, a roofing operator",
      voice: "Direct and local.",
      positioning: "Harbor runs roofing work.",
    },
  };
  const identity = neutralPublicIdentity(harbor as typeof tenant);
  assert.equal(identity.profile, "neutral");
  assert.equal(identity.name, "Harbor");
  assert.equal(identity.siteUrl, "https://harbor.test");
  assert.equal(identity.emailFooter, "Harbor · private operations");
  assert.equal(identity.aiBusinessDescriptor, "Harbor, a roofing operator");
  assert.doesNotMatch(JSON.stringify(identity), /acceleratewith|Accelerate/);
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(layout, /neutralPublicIdentity\(tenant\)/);
  assert.match(
    readFileSync("src/components/admin/AdminAuthLayout.tsx", "utf8"),
    /tenant\.brand\.name/,
  );
});

prove(
  "AC3",
  "inclusion manifest excludes protected media that this branded repo still serves",
  () => {
    const manifest = loadInclusionManifest();
    const tracked = new Set(gitFiles());
    assert.ok(tracked.has("public/images/john.jpg"));
    assert.ok([...tracked].some((path) => path.startsWith("public/images/team/")));
    assert.ok([...tracked].some((path) => path.startsWith("public/work/")));
    const starter = starterFiles();
    for (const path of starter) {
      assert.equal(
        manifest.excludePrefixes.some(
          (prefix: string) => path === prefix || path.startsWith(prefix),
        ),
        false,
        path,
      );
    }
    assert.ok(starter.some((path) => path.startsWith("src/app/admin/")));
    assert.ok(starter.some((path) => path.startsWith("src/lib/revenue-os/")));
    assert.ok(starter.includes("docs/self-hosting/SELF-HOSTING.md"));
    assert.ok(!starter.includes("public/images/john.jpg"));
  },
);

prove(
  "AC4",
  "fork hosting generation refuses original project IDs and example placeholders",
  () => {
    const original = loadOriginalHosting();
    assert.throws(() => assertForkHosting(original));
    assert.throws(() =>
      assertForkHosting({
        projectId: "prj_replace_with_your_vercel_project",
        teamId: "team_x",
        projectName: "x",
        canonicalUrl: "https://harbor.test",
      }),
    );
    const written = assertForkHosting({
      projectId: "prj_fork_example_not_original",
      teamId: "team_fork_example_not_original",
      projectName: "harbor-os",
      canonicalUrl: "https://harbor.test",
    });
    assert.equal(written.projectName, "harbor-os");
    for (const canonicalUrl of [
      "https://ACCELERATEWITH.US/",
      "http://www.acceleratewith.us:80/path",
      "https://acceleratewith.us./",
    ]) {
      assert.throws(() => assertForkHosting({ ...written, canonicalUrl }), /original installation/);
    }
    assert.throws(
      () => assertForkHosting({ ...written, canonicalUrl: "https://user:pass@harbor.test" }),
      /without credentials/,
    );
    const example = JSON.parse(readFileSync("deployment-target.example.json", "utf8"));
    assert.notEqual(example.projectId, original.projectId);
    const preflight = readFileSync("scripts/deployment-preflight.mjs", "utf8");
    assert.match(preflight, /assertForkHosting/);
    assert.match(readFileSync("vercel.json", "utf8"), /"deploymentEnabled": false/);
  },
);

// AC5 is verified by the actual exported starter build and qa-turnkey --neutral in CI.

prove("AC6", "stable extension interfaces and sample apps are documented for upgrades", () => {
  const guide = readFileSync("docs/self-hosting/NEUTRAL-DISTRIBUTION.md", "utf8");
  assert.match(guide, /Stable interfaces/);
  assert.match(guide, /Sample business applications/);
  assert.match(guide, /upstream upgrades/);
  assert.match(readFileSync("docs/contributing/EXTENDING.md", "utf8"), /modules/);
});

const refused = spawnSync(
  process.execPath,
  [
    "scripts/generate-fork-hosting.mjs",
    "--project",
    loadOriginalHosting().projectId,
    "--team",
    "team_x",
    "--url",
    "https://harbor.test",
  ],
  {
    encoding: "utf8",
  },
);
assert.notEqual(refused.status, 0);
assert.match(refused.stderr, /original installation/);

console.log(JSON.stringify({ result: "passed", cases }, null, 2));
