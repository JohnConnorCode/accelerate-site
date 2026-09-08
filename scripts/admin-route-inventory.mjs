import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const inventoryPath = "docs/verification/admin-route-inventory.json";

function filesUnder(root, directory, suffix) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory()
      ? filesUnder(root, path, suffix)
      : path.endsWith(suffix)
        ? [path]
        : [];
  });
}

function adapterEvidence(path, root) {
  const source = readFileSync(resolve(root, path), "utf8");
  return {
    path,
    domainImports: [
      ...new Set(
        [
          ...source.matchAll(
            /from ["'](@\/lib\/(?:revenue-os|tenancy|email|ai|site-studio)\/[^"']+)/g,
          ),
        ].map((match) => match[1]),
      ),
    ].sort(),
    directTables: [
      ...new Set([...source.matchAll(/\.from\(["']([^"']+)/g)].map((match) => match[1])),
    ].sort(),
  };
}

// Run only after reviewing changed routes and editing their human-authored boundaries.
export function refreshEvidence(inventory, root = process.cwd()) {
  const sources = new Set([
    "src/lib/admin/navigation.ts",
    "src/lib/revenue-os/modules.ts",
    "src/lib/revenue-os/README.md",
    "src/lib/revenue-os/legacy-adapter.ts",
    ...filesUnder(root, "src/components/admin", ".tsx"),
  ]);
  for (const row of inventory.routes) {
    sources.add(row.page);
    row.adapters = row.adapters.map((adapter) => adapterEvidence(adapter.path, root));
    for (const adapter of row.adapters) {
      sources.add(adapter.path);
      for (const imported of adapter.domainImports)
        sources.add(imported.replace("@/", "src/") + ".ts");
    }
  }
  inventory.sources = Object.fromEntries(
    [...sources].sort().map((path) => [
      path,
      createHash("sha256")
        .update(readFileSync(resolve(root, path)))
        .digest("hex"),
    ]),
  );
  return inventory;
}

/** A coverage/drift check, not a call-graph, authorization or data-parity proof. */
export function verifyInventory(inventory, root = process.cwd()) {
  const errors = [];
  const expectedPages = filesUnder(root, "src/app/admin", "/page.tsx");
  const seen = new Set();
  if (inventory.schemaVersion !== 1) errors.push("Unsupported inventory schema");
  for (const row of inventory.routes) {
    if (seen.has(row.page)) errors.push(`Duplicate route: ${row.page}`);
    seen.add(row.page);
    if (!expectedPages.includes(row.page)) errors.push(`Unknown page: ${row.page}`);
    const expectedRoute = row.page.replace(/^src\/app/, "").replace(/\/page\.tsx$/, "");
    if (row.route !== expectedRoute) errors.push(`Wrong route for ${row.page}`);
    if (!row.primaryAction?.trim() || !row.boundary?.trim())
      errors.push(`Missing action/boundary: ${row.route}`);
    if (!row.adapters.length && !row.specialBoundary)
      errors.push(`Missing service disposition: ${row.route}`);
    if (
      row.followUp &&
      (!row.followUp.key?.trim() || !/^[a-f0-9-]{36}$/.test(row.followUp.id ?? ""))
    ) {
      errors.push(`Invalid linked work: ${row.route}`);
    }
    for (const adapter of row.adapters) {
      try {
        if (JSON.stringify(adapterEvidence(adapter.path, root)) !== JSON.stringify(adapter)) {
          errors.push(`Stale adapter observations: ${adapter.path}`);
        }
      } catch {
        errors.push(`Missing adapter: ${adapter.path}`);
      }
    }
    for (const path of [row.page, ...row.adapters.map((adapter) => adapter.path)]) {
      if (!inventory.sources[path]) errors.push(`Untracked evidence: ${path}`);
    }
  }
  for (const page of expectedPages) if (!seen.has(page)) errors.push(`Missing route: ${page}`);
  for (const component of filesUnder(root, "src/components/admin", ".tsx")) {
    if (!inventory.sources[component]) errors.push(`Unreviewed admin component: ${component}`);
  }
  for (const [path, hash] of Object.entries(inventory.sources)) {
    const absolute = resolve(root, path);
    if (relative(root, absolute).startsWith("..") || !path.startsWith("src/")) {
      errors.push(`Invalid source path: ${path}`);
      continue;
    }
    try {
      const actual = createHash("sha256").update(readFileSync(absolute)).digest("hex");
      if (actual !== hash) errors.push(`Source changed; review its route boundary: ${path}`);
    } catch {
      errors.push(`Missing source: ${path}`);
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  if (process.argv.includes("--refresh")) {
    refreshEvidence(inventory);
    writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
  }
  const errors = verifyInventory(inventory);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `Admin route inventory: ${inventory.routes.length} pages and ${Object.keys(inventory.sources).length} source fingerprints verified. Data parity is not asserted.`,
    );
  }
}
