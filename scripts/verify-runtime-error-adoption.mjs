/** Syntactic adoption guard, not proof of correct logging or error recovery. */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export function silentCatches(source, filename = "fixture.ts") {
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.[jt]sx$/.test(filename) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings = [];
  const empty = (node) => ts.isBlock(node) && node.statements.length === 0;
  function visit(node) {
    let kind;
    if (ts.isCatchClause(node) && empty(node.block)) kind = "empty catch";
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const catchCall =
        (ts.isPropertyAccessExpression(expression) && expression.name.text === "catch") ||
        (ts.isElementAccessExpression(expression) &&
          expression.argumentExpression &&
          ts.isStringLiteral(expression.argumentExpression) &&
          expression.argumentExpression.text === "catch");
      let handler = node.arguments[0];
      while (
        handler &&
        (ts.isParenthesizedExpression(handler) ||
          ts.isAsExpression(handler) ||
          ts.isTypeAssertionExpression(handler) ||
          ts.isNonNullExpression(handler) ||
          ts.isSatisfiesExpression(handler))
      )
        handler = handler.expression;
      if (
        catchCall &&
        handler &&
        (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) &&
        empty(handler.body)
      )
        kind = "empty .catch handler";
    }
    if (kind)
      findings.push({
        line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
        kind,
      });
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return findings;
}
export function scanRuntime(root) {
  const result = {};
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
        const matches = silentCatches(readFileSync(path, "utf8"), entry.name);
        if (matches.length) result[relative(root, path).replaceAll("\\", "/")] = matches;
      }
    }
  }
  walk(resolve(root, "src/lib/revenue-os"));
  return result;
}
export function compareBaseline(findings, baseline) {
  const failures = [];
  for (const file of [...new Set([...Object.keys(findings), ...Object.keys(baseline)])].sort()) {
    const actual = findings[file]?.length ?? 0,
      allowed = baseline[file] ?? 0;
    if (!Number.isSafeInteger(allowed) || allowed < 1) {
      if (Object.hasOwn(baseline, file))
        failures.push({
          file,
          reason: "Invalid allowance; baseline entries must be positive integers",
        });
    }
    if (actual > allowed)
      failures.push({
        file,
        reason: `Silent catches increased: ${actual} > ${allowed}`,
        sites: findings[file],
      });
    if (actual < allowed)
      failures.push({
        file,
        reason: `Stale allowance: lower ${allowed} to ${actual}, or remove the entry when zero`,
      });
  }
  return failures;
}
export function verifyRuntimeErrorAdoption(root) {
  const findings = scanRuntime(root);
  const baseline = JSON.parse(
    readFileSync(resolve(root, "scripts/runtime-error-baseline.json"), "utf8"),
  );
  return { findings, failures: compareBaseline(findings, baseline) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const { findings, failures } = verifyRuntimeErrorAdoption(root);
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  } else
    console.log(
      JSON.stringify({
        passed: true,
        baselineSites: Object.values(findings).reduce((sum, sites) => sum + sites.length, 0),
        files: Object.keys(findings).length,
      }),
    );
}
