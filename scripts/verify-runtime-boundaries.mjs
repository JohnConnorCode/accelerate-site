import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

export function tenantRegistryGaps(root) {
  const source = readFileSync(resolve(root, "src/lib/revenue-os/schema-contract.ts"), "utf8");
  const registry = source.slice(
    source.indexOf("export const TENANT_SCOPED_TABLES"),
    source.indexOf("] as const;"),
  );
  const scoped = new Set([...registry.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
  const missing = new Set();
  for (const file of readdirSync(resolve(root, "migrations"))) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(resolve(root, "migrations", file), "utf8");
    for (const match of sql.matchAll(
      /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi,
    )) {
      const table = match[1];
      if (!/\btenant_id\s+UUID\b/i.test(match[2])) continue;
      // Control-plane audit is deliberately platform-global despite referring
      // to an affected tenant. These exceptions name the exact semantic table.
      if (["tenant_memberships", "platform_audit_log", "tenant_ingest_keys"].includes(table))
        continue;
      if (!scoped.has(table)) missing.add(table);
    }
  }
  return [...missing].sort();
}

export function routeWrites(root) {
  const writes = {};
  function walk(dir) {
    for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else if (entry.name === "route.ts") {
        const tree = ts.createSourceFile(
          file,
          readFileSync(resolve(root, file), "utf8"),
          ts.ScriptTarget.Latest,
          true,
        );
        function visit(node) {
          if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ["insert", "update", "upsert", "delete"].includes(node.expression.name.text)
          ) {
            const receiver = node.expression.expression;
            if (
              ts.isCallExpression(receiver) &&
              ts.isPropertyAccessExpression(receiver.expression) &&
              receiver.expression.name.text === "from" &&
              ts.isStringLiteral(receiver.arguments[0])
            ) {
              let fn = node.parent;
              while (fn && !ts.isFunctionDeclaration(fn)) fn = fn.parent;
              const key = `${file}::${fn?.name?.text ?? "local"}::${receiver.arguments[0].text}::${node.expression.name.text}`;
              writes[key] = (writes[key] ?? 0) + 1;
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(tree);
      }
    }
  }
  walk("src/app/api");
  return writes;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const gaps = tenantRegistryGaps(root);
  const writes = routeWrites(root);
  const baseline = JSON.parse(
    readFileSync(resolve(root, "scripts/runtime-write-baseline.json"), "utf8"),
  );
  const newWrites = Object.entries(writes).filter(([key, count]) => count > (baseline[key] ?? 0));
  if (gaps.length || newWrites.length) {
    console.error(
      JSON.stringify({ unscopedTenantTables: gaps, newRouteBusinessWrites: newWrites }, null, 2),
    );
    process.exitCode = 1;
  } else
    console.log(JSON.stringify({ result: "passed", legacyWriteSites: Object.keys(writes).length }));
}
