import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const mutations = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function inspectRoute(source, file = "route.ts") {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.[tj]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
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

export function inventory(root, tools = []) {
  const rows = [];
  const additionalEntrypoints = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Review symlink under admin routes: ${path}`);
      if (entry.isDirectory()) visit(path);
      else if (/^route\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
        const source = relative(root, path).replaceAll("\\", "/");
        const details = inspectRoute(readFileSync(path, "utf8"), source);
        const row = { source, ...details };
        if (source.startsWith("src/app/api/admin/")) rows.push(row);
        else additionalEntrypoints.push(row);
      }
    }
  };
  visit(resolve(root, "src/app/api"));
  rows.sort((a, b) => a.source.localeCompare(b.source, "en"));
  additionalEntrypoints.sort((a, b) => a.source.localeCompare(b.source, "en"));
  const clientWrites = [],
    serverActions = [];
  const inspectSource = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) inspectSource(path);
      else if (/\.[tj]sx?$/.test(entry.name)) {
        const text = readFileSync(path, "utf8");
        const source = relative(root, path).replaceAll("\\", "/");
        const ast = ts.createSourceFile(
          source,
          text,
          ts.ScriptTarget.Latest,
          true,
          entry.name.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        const directive = (nodes, value) =>
          nodes.some(
            (node) =>
              ts.isExpressionStatement(node) &&
              ts.isStringLiteral(node.expression) &&
              node.expression.text === value,
          );
        const client =
          directive(ast.statements, "use client") ||
          /from ["'][^"']*supabase\/client["']/.test(text);
        const moduleServer = directive(ast.statements, "use server");
        const actions = new Set();
        const writes = new Set();
        const scan = (node) => {
          if (
            ts.isFunctionDeclaration(node) &&
            node.name &&
            (moduleServer || (node.body && directive(node.body.statements, "use server")))
          )
            actions.add(node.name.text);
          if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.initializer &&
            (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
            (moduleServer ||
              (ts.isBlock(node.initializer.body) &&
                directive(node.initializer.body.statements, "use server")))
          )
            actions.add(node.name.text);
          if (
            client &&
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ["insert", "update", "upsert", "delete"].includes(node.expression.name.text)
          ) {
            let receiver = node.expression.expression;
            while (
              ts.isCallExpression(receiver) &&
              ts.isPropertyAccessExpression(receiver.expression)
            ) {
              if (receiver.expression.name.text === "from") {
                const table = receiver.arguments[0];
                writes.add(
                  `${node.expression.name.text}:${table && ts.isStringLiteral(table) ? table.text : "dynamic"}`,
                );
                break;
              }
              receiver = receiver.expression.expression;
            }
          }
          ts.forEachChild(node, scan);
        };
        scan(ast);
        const sourceSha256 = createHash("sha256").update(text).digest("hex");
        if (actions.size)
          serverActions.push({ source, operations: [...actions].sort(), sourceSha256 });
        if (writes.size)
          clientWrites.push({ source, operations: [...writes].sort(), sourceSha256 });
      }
    }
  };
  inspectSource(resolve(root, "src"));
  const sourceEntrypoints = [
    ...serverActions.map((row) => ({ ...row, kind: "server_action" })),
    ...clientWrites.map((row) => ({ ...row, kind: "client_write" })),
  ];
  const semantic = operationBindings(
    root,
    [...rows, ...additionalEntrypoints],
    tools,
    sourceEntrypoints,
  );
  return {
    contract: "admin-ai-route-inventory.v2",
    scope:
      "Admin HTTP handlers, other API entrypoints, declared server actions and direct client mutation candidates. Source inventory plus reviewed tool bindings, not universal runtime acceptance.",
    limitations: [
      "HTTP methods do not identify business operations: POST may read, authenticate or approve; one handler may dispatch multiple commands.",
      "Imports are navigation references, not proof of service use, authorization, approval or tool parity.",
      "Server-action and client-write candidates are static discovery only; indirect client writes and third-party plugin entrypoints still require semantic review.",
      "Updating a fingerprint acknowledges source drift only; acceptance still requires the live domain card failure matrix.",
    ],
    routeCount: rows.length,
    mutationHandlerCount: rows.reduce((n, r) => n + r.mutationHandlers.length, 0),
    semantic,
    additionalEntrypoints,
    serverActions,
    clientWrites,
    routes: rows,
  };
}

/** Existing gaps remain visible. Regenerating the inventory cannot silently bless new gaps. */
export function assertNoNewCoverageGaps(previous, current) {
  if (!previous?.semantic || !previous.additionalEntrypoints) return; // one-time v1/source-scope upgrade
  const oldTools = new Set(previous.semantic.unreviewedToolBindings);
  const oldHandlers = new Set(previous.semantic.handlersWithoutReviewedBindings);
  const oldSources = new Set(previous.semantic.unreviewedSourceBindings ?? []);
  const added = [
    ...current.semantic.unreviewedToolBindings
      .filter((name) => !oldTools.has(name))
      .map((name) => `tool ${name}`),
    ...(previous.semantic.unreviewedSourceBindings
      ? (current.semantic.unreviewedSourceBindings ?? [])
          .filter((name) => !oldSources.has(name))
          .map((name) => `source ${name}`)
      : []),
    ...current.semantic.handlersWithoutReviewedBindings
      .filter((name) => !oldHandlers.has(name))
      .map((name) => `handler ${name}`),
  ];
  if (added.length)
    throw new Error(
      `New operations need reviewed semantic bindings before inventory refresh: ${added.join(", ")}`,
    );
}

/** Reviewed semantic bindings come only from the live tool definitions. A mapped transport
 * is still not proof that every action variant in its handler is covered. */
export function operationBindings(root, routes, tools, sourceEntrypoints = []) {
  const operations = new Map();
  const names = new Set();
  const handlers = new Map(
    routes.flatMap((route) =>
      route.handlers.map((method) => {
        const path = route.source.replace(/^src\/app/, "").replace(/\/route\.[^.]+$/, "");
        return [`${method} ${path}`, route];
      }),
    ),
  );
  const sources = new Set(
    sourceEntrypoints.flatMap((row) =>
      row.operations.map((operation) => `${row.kind} ${row.source} ${operation}`),
    ),
  );
  const mappedSources = new Set();
  const mapped = new Set();
  for (const tool of tools) {
    if (names.has(tool.name)) throw new Error(`Duplicate tool binding: ${tool.name}`);
    names.add(tool.name);
    if (!tool.operation) continue;
    const operation = tool.operation;
    if (
      !/^[a-z][a-z0-9.-]+$/.test(operation.id) ||
      !Number.isInteger(operation.version) ||
      operation.version < 1 ||
      !["workspace", "platform"].includes(operation.scope) ||
      !operation.verification?.length
    )
      throw new Error(`Invalid semantic operation binding: ${tool.name}`);
    for (const file of operation.verification) {
      if (!file.startsWith("scripts/") || file.includes(".."))
        throw new Error(`Unsafe verification path: ${file}`);
      readFileSync(resolve(root, file));
    }
    const previous = operations.get(operation.id);
    if (previous && JSON.stringify(previous.definition) !== JSON.stringify(operation))
      throw new Error(`Conflicting operation definition: ${operation.id}`);
    if (previous && previous.serviceTarget !== tool.serviceTarget)
      throw new Error(`Operation adapters must share one service owner: ${operation.id}`);
    for (const entry of operation.entrypoints) {
      const key = `${entry.method} ${entry.path}`;
      if (!handlers.has(key))
        throw new Error(`Semantic binding references a missing handler: ${key}`);
      mapped.add(key);
    }
    for (const entry of operation.sourceEntrypoints ?? []) {
      const key = `${entry.kind} ${entry.path} ${entry.operation}`;
      if (!sources.has(key))
        throw new Error(`Semantic binding references a missing source operation: ${key}`);
      mappedSources.add(key);
    }
    if (previous) previous.tools.push(tool.name);
    else
      operations.set(operation.id, {
        definition: operation,
        serviceTarget: tool.serviceTarget,
        tools: [tool.name],
      });
  }
  return {
    complete: false,
    unreviewedSourceBindings: [...sources].filter((key) => !mappedSources.has(key)).sort(),
    meaning:
      "Reviewed command-to-transport bindings with executable verification references. No coverage percentage or universal runtime acceptance is asserted.",
    registeredTools: tools.length,
    unreviewedToolBindings: tools
      .filter((tool) => !tool.operation)
      .map((tool) => tool.name)
      .sort(),
    operations: [...operations.values()].sort((a, b) =>
      a.definition.id.localeCompare(b.definition.id, "en"),
    ),
    handlersWithoutReviewedBindings: [...handlers.keys()].filter((key) => !mapped.has(key)).sort(),
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
  const tools = JSON.parse(
    execFileSync(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", "scripts/admin-ai-operation-bindings.ts"],
      { cwd: process.cwd(), encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
    ),
  );
  const result = inventory(process.cwd(), tools);
  assertNoNewCoverageGaps(JSON.parse(readFileSync(file, "utf8")), result);
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
      semanticOperations: result.semantic.operations.length,
      semanticParity: "universal coverage not asserted",
    }),
  );
}
