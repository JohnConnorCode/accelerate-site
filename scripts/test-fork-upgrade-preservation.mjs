import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build, transform } from "esbuild";
import { checkForkUpgrade } from "./check-fork-upgrade.mjs";
import {
  loadDeploymentTarget,
  verifyDeploymentTarget,
  verifyHostingSelection,
} from "./deployment-preflight.mjs";

const source = process.cwd();
// A real populated-fork update across published source, not synthetic source-presence checks.
const prior = "59167a013d6085e8ff94abc30009a085e93a404a";
const upstream = "c2b090e51ec74c0433d368adde9c150686686b2f";
const target = {
  projectId: "prj_owned_fixture",
  teamId: "team_owned_fixture",
  projectName: "owned-fixture",
  canonicalUrl: "https://owned.example",
};
const temp = mkdtempSync(join(tmpdir(), "accelerate-fork-preservation-"));
let serial = 0;
const put = (root, path, value) => {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, value);
};
const hash = (root, path) =>
  createHash("sha256")
    .update(readFileSync(join(root, path)))
    .digest("hex");
// Disposable test commits must not run machine-wide hooks against old releases.
const git = (root, ...args) =>
  execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const commit = (root) => {
  git(root, "add", ".");
  git(
    root,
    "-c",
    "user.name=Fork fixture",
    "-c",
    "user.email=fork-fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "Owned customization fixture",
  );
};
const fixture = (base = upstream) => {
  const root = join(temp, `fork-${serial++}`);
  git(source, "clone", "--quiet", "--shared", "--no-checkout", source, root);
  git(root, "checkout", "--quiet", "-b", "owned-fixture", base);
  symlinkSync(resolve(source, "node_modules"), join(root, "node_modules"));
  // Prior releases did not ignore this override; adoption never needs to commit it.
  put(root, ".git/info/exclude", "/deployment-target.local.json\n");
  return root;
};
const bundleContracts = async (root) => {
  const entry = join(temp, `contracts-${serial++}.ts`),
    output = `${entry}.mjs`;
  writeFileSync(
    entry,
    `export { createNeutralWebsite } from ${JSON.stringify(join(root, "src/lib/site-studio/neutral-website.ts"))};\nexport { parseWebsiteDocument } from ${JSON.stringify(join(root, "src/lib/site-studio/website-document.ts"))};\nexport { resolveWorkspaceBrand, workspaceBrandSchema } from ${JSON.stringify(join(root, "src/lib/revenue-os/branding-contract.ts"))};`,
  );
  await build({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    absWorkingDir: root,
    tsconfig: join(root, "tsconfig.json"),
    logLevel: "silent",
  });
  return import(pathToFileURL(output).href);
};
const generate = (root, args = []) =>
  spawnSync(
    process.execPath,
    [
      join(source, "scripts/generate-fork-hosting.mjs"),
      "--project",
      target.projectId,
      "--team",
      target.teamId,
      "--name",
      target.projectName,
      "--url",
      target.canonicalUrl,
      ...args,
    ],
    { cwd: root, encoding: "utf8" },
  );

test("hosting override retains the tracked target and refuses repeated generation", () => {
  const root = fixture(),
    original = hash(root, "deployment-target.json");
  assert.equal(generate(root).status, 0);
  assert.equal(hash(root, "deployment-target.json"), original);
  assert.deepEqual(loadDeploymentTarget(root), target);
  const saved = hash(root, "deployment-target.local.json");
  assert.equal(generate(root).status, 1);
  assert.equal(hash(root, "deployment-target.local.json"), saved);
  assert.equal(generate(root, ["--unknown", "unused"]).status, 1);
  verifyHostingSelection(loadDeploymentTarget(root), {});
  assert.throws(
    () =>
      verifyDeploymentTarget({
        target: loadDeploymentTarget(root),
        linked: { projectId: "prj_wrong", orgId: target.teamId },
        request() {
          throw new Error("Must not call provider");
        },
      }),
    /Wrong Vercel/,
  );
});

test("invalid local overrides fail closed instead of falling back to upstream hosting", () => {
  const root = fixture();
  for (const body of [
    "{",
    "null",
    "[]",
    "{}",
    JSON.stringify({ ...target, teamId: 42 }),
    "x".repeat(17000),
  ]) {
    put(root, "deployment-target.local.json", body);
    assert.throws(() => loadDeploymentTarget(root));
  }
  rmSync(join(root, "deployment-target.local.json"));
  symlinkSync(join(root, "deployment-target.json"), join(root, "deployment-target.local.json"));
  assert.throws(() => loadDeploymentTarget(root), /regular/);
});

for (const profile of ["neutral", "branded"])
  test(`real upstream update retains the populated ${profile} fork`, async () => {
    const root = fixture(prior);
    const contracts = await bundleContracts(source);
    const document = contracts.createNeutralWebsite();
    document.identity.name = "Owned fixture business";
    document.navigation = [{ label: "Our work", href: "/our-work" }];
    document.pages[0].metadata.title = "Owned published homepage";
    document.assets.push({
      id: "owned-mark",
      src: "/site-assets/owned-mark.svg",
      alt: "Owned mark",
    });
    const draft = structuredClone(document);
    draft.pages[0].metadata.title = "Next unpublished revision";
    const brand = contracts.resolveWorkspaceBrand(
      { brand: { name: "Owned fixture business", accentColor: "#315c52", font: "serif" } },
      "Owned fixture business",
    );
    const contactId = "00000000-0000-4000-8000-000000000001";
    const state = {
      config: {
        brand,
        modules: { "owner-inventory": true, "stripe-invoicing": false, "opportunity-radar": false },
      },
      website: {
        draft,
        published: document,
        draftRevision: "revision-2",
        publishedRevision: "revision-1",
        revisions: [
          { id: "revision-1", document },
          { id: "revision-2", document: draft },
        ],
      },
      contacts: [{ id: contactId, name: "Fictional customer" }],
      tasks: [{ id: "fixture-task", contact_id: contactId, status: "todo" }],
      providerBindings: [
        {
          provider: "google",
          status: "revoked",
          credential_version: 2,
          ciphertext: randomBytes(32).toString("hex"),
        },
      ],
      work: [{ id: "fixture-work", status: "waiting", sourceId: contactId }],
    };
    put(root, ".accelerate/installation-fixture.json", JSON.stringify(state));
    put(root, ".accelerate/uploaded-object.bin", randomBytes(128));
    put(
      root,
      ".env.local",
      `NEXT_PUBLIC_DISTRIBUTION_PROFILE=${profile}\nNEXT_PUBLIC_BUSINESS_NAME=Owned fixture business\nGOOGLE_TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}\n`,
    );
    const manifest = JSON.parse(
      readFileSync(join(root, "extensions/example-inventory.module.json"), "utf8"),
    );
    manifest.id = "owner-inventory";
    manifest.name = "Owned inventory";
    manifest.navLinks[0] = {
      ...manifest.navLinks[0],
      id: "owner-inventory",
      href: "/admin/owner-inventory",
    };
    manifest.routes = ["/admin/owner-inventory"];
    put(root, "extensions/owner-inventory.module.json", JSON.stringify(manifest));
    put(
      root,
      "src/app/admin/owner-inventory/page.tsx",
      "export default function OwnedInventory() { return <main>Owned inventory</main>; }\n",
    );
    put(
      root,
      "plugins/owner-inventory/README.md",
      "# Owned inventory\n\nThis fictional source extension keeps the existing Inventory contract, permissions and settings. It has no provider effects.\n",
    );
    put(
      root,
      "public/site-assets/owned-mark.svg",
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h8v8H0z"/></svg>',
    );
    commit(root);
    assert.equal(generate(root).status, 0);
    const owned = [
      ".accelerate/installation-fixture.json",
      ".accelerate/uploaded-object.bin",
      ".env.local",
      "deployment-target.local.json",
      "extensions/owner-inventory.module.json",
      "plugins/owner-inventory/README.md",
      "src/app/admin/owner-inventory/page.tsx",
      "public/site-assets/owned-mark.svg",
    ];
    const before = Object.fromEntries(owned.map((path) => [path, hash(root, path)]));
    const head = git(root, "rev-parse", "HEAD"),
      index = hash(root, ".git/index");
    const preview = checkForkUpgrade(root, upstream);
    assert.equal(preview.status, "mergeable");
    assert.equal(git(root, "rev-parse", "HEAD"), head);
    assert.equal(hash(root, ".git/index"), index, "Preflight never changes the index");
    git(
      root,
      "-c",
      "user.name=Fork fixture",
      "-c",
      "user.email=fork-fixture@example.invalid",
      "merge",
      "--quiet",
      "--no-edit",
      upstream,
    );
    for (const path of owned) assert.equal(hash(root, path), before[path], `Preserve ${path}`);
    assert.deepEqual(loadDeploymentTarget(root), target);
    const updated = await bundleContracts(root),
      restored = JSON.parse(
        readFileSync(join(root, ".accelerate/installation-fixture.json"), "utf8"),
      );
    for (const page of [restored.website.draft, restored.website.published])
      updated.parseWebsiteDocument(page);
    updated.workspaceBrandSchema.parse(restored.config.brand);
    assert.equal(restored.tasks[0].contact_id, restored.contacts[0].id);
    assert.equal(restored.providerBindings[0].status, "revoked");
    assert.deepEqual(restored.config.modules, state.config.modules);
    assert.equal(git(root, "status", "--porcelain"), "");
    const generated = spawnSync(process.execPath, ["scripts/build-extension-modules.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(
      generated.status,
      0,
      `Retained custom manifest still builds through the canonical generator: ${generated.stderr}`,
    );
    assert.match(
      readFileSync(join(root, "src/lib/revenue-os/extension-modules.generated.ts"), "utf8"),
      /owner-inventory/,
    );
    // Receipts describe coverage and hashes only. Private fixture content never enters output.
  });

test("preflight preserves dirty and untracked work, and reports conflicting source without merging", () => {
  const root = fixture();
  put(root, "unfinished.txt", "Unfinished owner work");
  assert.equal(checkForkUpgrade(root, upstream).status, "working-tree-changes");
  assert.equal(readFileSync(join(root, "unfinished.txt"), "utf8"), "Unfinished owner work");
  rmSync(join(root, "unfinished.txt"));
  const original = readFileSync(join(root, "README.md"), "utf8");
  put(root, "README.md", original.replace(/^.*\n/, "# Owner title\n"));
  commit(root);
  const head = git(root, "rev-parse", "HEAD");
  git(root, "checkout", "--quiet", "-b", "future-upstream", upstream);
  put(root, "README.md", original.replace(/^.*\n/, "# Upstream title\n"));
  commit(root);
  const next = git(root, "rev-parse", "HEAD");
  git(root, "checkout", "--quiet", "owned-fixture");
  const result = checkForkUpgrade(root, next);
  assert.equal(result.status, "owner-review");
  assert.deepEqual(result.conflicts, ["README.md"]);
  assert.equal(git(root, "rev-parse", "HEAD"), head);
  assert.equal(readFileSync(join(root, "README.md"), "utf8").startsWith("# Owner title"), true);
});

test("committed legacy tenant and hosting edits require explicit owner adoption", () => {
  const root = fixture();
  put(root, "deployment-target.json", JSON.stringify(target));
  put(
    root,
    "src/config/tenant.ts",
    readFileSync(join(root, "src/config/tenant.ts"), "utf8") + "\n// Owner legacy edit\n",
  );
  commit(root);
  const result = checkForkUpgrade(root, upstream);
  assert.equal(result.status, "owner-review");
  assert.deepEqual(result.legacyConfiguration, ["deployment-target.json", "src/config/tenant.ts"]);
});

test("configured custom merge drivers are never executed by the preflight", () => {
  const root = fixture();
  put(root, ".gitattributes", "README.md merge=fixture\n");
  commit(root);
  git(root, "config", "merge.fixture.driver", "touch driver-ran.txt");
  assert.equal(checkForkUpgrade(root, upstream).status, "owner-review");
  assert.equal(existsSync(join(root, "driver-ran.txt")), false);
});

test("reduced exports without upstream ancestry get manual adoption, never unrelated-history merge", () => {
  const root = join(temp, "reduced");
  mkdirSync(root);
  git(root, "init", "--quiet");
  put(root, "README.md", "Independent reduced export\n");
  commit(root);
  git(root, "fetch", "--quiet", "--no-tags", source, upstream);
  const head = git(root, "rev-parse", "HEAD");
  assert.equal(checkForkUpgrade(root, upstream).status, "manual-adoption");
  assert.equal(git(root, "rev-parse", "HEAD"), head);
  assert.equal(checkForkUpgrade(root, "missing-upstream").status, "invalid-reference");
  assert.equal(checkForkUpgrade(root, "--anything").status, "invalid-reference");
});

test("exported identity uses environment configuration without changing tenant source", async () => {
  const code = readFileSync("distribution/neutral-starter/src/config/tenant.ts.txt", "utf8");
  const built = await transform(code, { loader: "ts", format: "esm" });
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const module = await import('data:text/javascript;base64,${Buffer.from(built.code).toString("base64")}'); if(module.tenant.brand.name !== 'Owned fixture business' || module.tenant.brand.domain !== 'owned.example' || module.tenant.capabilities.publicBooking !== false) process.exit(1);`,
    ],
    {
      env: {
        ...process.env,
        NEXT_PUBLIC_BUSINESS_NAME: "Owned fixture business",
        NEXT_PUBLIC_SITE_URL: target.canonicalUrl,
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, "Public bootstrap identity must follow configured environment");
});

process.on("exit", () => rmSync(temp, { recursive: true, force: true }));
