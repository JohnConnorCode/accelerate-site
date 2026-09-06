import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const mutations = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function inspectRoute(source, file = "route.ts") {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw new Error(`Cannot parse ${file}`);
  const handlers = new Set();
  const imports = new Set();
  const add = (name) => {
    if (methods.has(name)) handlers.add(name);
  };
  for (const node of ast.statements) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
      imports.add(node.moduleSpecifier.text);
    if (ts.isExportDeclaration(node)) {
      if (node.isTypeOnly) continue;
      if (!node.exportClause) throw new Error(`Review wildcard route export in ${file}`);
      if (ts.isNamedExports(node.exportClause))
        for (const item of node.exportClause.elements) if (!item.isTypeOnly) add(item.name.text);
      continue;
    }
    if (!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(node) && node.name) add(node.name.text);
    if (ts.isVariableStatement(node))
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) add(declaration.name.text);
        else throw new Error(`Review destructured route export in ${file}`);
      }
  }
  const sorted = [...handlers].sort();
  return {
    handlers: sorted,
    mutationHandlers: sorted.filter((m) => mutations.has(m)),
    imports: [...imports].sort(),
    sourceSha256: createHash("sha256").update(source).digest("hex"),
  };
}

export function inventory(root) {
  const rows = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Review symlink under admin routes: ${path}`);
      if (entry.isDirectory()) visit(path);
      else if (/^route\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
        const source = relative(root, path).replaceAll("\\", "/");
        const details = inspectRoute(readFileSync(path, "utf8"), source);
        rows.push({ source, ...details });
      }
    }
  };
  visit(resolve(root, "src/app/api/admin"));
  rows.sort((a, b) => a.source.localeCompare(b.source, "en"));
  return {
    contract: "admin-ai-route-inventory.v1",
    scope:
      "Exported HTTP handlers under src/app/api/admin. Source inventory, not verified AI operation coverage.",
    limitations: [
      "HTTP methods do not identify business operations: POST may read, authenticate or approve; one handler may dispatch multiple commands.",
      "Imports are navigation references, not proof of service use, authorization, approval or tool parity.",
      "Server actions, other API roots, direct client mutations and third-party plugin entrypoints require separate semantic review.",
      "Updating a fingerprint acknowledges source drift only; acceptance still requires the live domain card failure matrix.",
    ],
    routeCount: rows.length,
    mutationHandlerCount: rows.reduce((n, r) => n + r.mutationHandlers.length, 0),
    routes: rows,
  };
}

export function serializeInventory(value) {
  return JSON.stringify(value, null, 2) + "\n";
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (!["--write", "--check"].includes(mode) || process.argv.length !== 3)
    throw new Error("Usage: node scripts/admin-ai-inventory.mjs --write|--check");
  const file = "docs/generated/admin-ai-route-inventory.json";
  const result = inventory(process.cwd());
  const text = serializeInventory(result);
  if (mode === "--write") writeFileSync(file, text);
  else if (readFileSync(file, "utf8") !== text)
    throw new Error(
      "Admin route inventory drifted. Review the changed operations and their live parity cards, then run node scripts/admin-ai-inventory.mjs --write.",
    );
  console.log(
    JSON.stringify({
      result: "passed",
      mode,
      routes: result.routeCount,
      mutationHandlers: result.mutationHandlerCount,
      semanticParity: "not asserted",
    }),
  );
}
