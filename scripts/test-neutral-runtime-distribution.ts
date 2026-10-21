#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import ts from "typescript";
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

// Parse only syntax, never create a compiler program or read omitted agency data.
function contentImportFailures(files: Map<string, string>) {
  const parsed = new Map<string, ts.SourceFile>();
  const failures: string[] = [];
  const script = /\.[cm]?[jt]sx?$/;
  const content = (path: string) => path === "src/content" || path.startsWith("src/content/");
  const source = (path: string) => {
    if (!parsed.has(path))
      parsed.set(path, ts.createSourceFile(path, files.get(path)!, ts.ScriptTarget.Latest, true));
    return parsed.get(path)!;
  };
  const basePath = (importer: string, specifier: string) =>
    specifier.startsWith("@/")
      ? `src/${specifier.slice(2)}`
      : specifier.startsWith(".")
        ? posix.normalize(posix.join(posix.dirname(importer), specifier))
        : null;
  const resolve = (base: string) => {
    const stem = base.replace(/\.[cm]?jsx?$/, "");
    return [
      base,
      ...[".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json", ".mdx"].flatMap(
        (extension) => [stem + extension, `${stem}/index${extension}`],
      ),
    ].find((path) => files.has(path));
  };
  const exportsOf = (path: string) => {
    const names = new Set<string>();
    const visited = new Set<string>();
    const pending = [path];
    while (pending.length) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      const add = (name: string) => {
        if (name !== "default" || file === path) names.add(name);
      };
      if (!script.test(file)) {
        add("default");
        if (file.endsWith(".json")) Object.keys(JSON.parse(files.get(file)!)).forEach(add);
        continue;
      }
      const binding = (name: ts.BindingName) => {
        if (ts.isIdentifier(name)) add(name.text);
        else
          name.elements.forEach((item) => {
            if (ts.isBindingElement(item)) binding(item.name);
          });
      };
      for (const statement of source(file).statements) {
        if (ts.isExportDeclaration(statement)) {
          if (statement.exportClause) {
            if (ts.isNamedExports(statement.exportClause))
              statement.exportClause.elements.forEach((item) => add(item.name.text));
            else add(statement.exportClause.name.text);
          } else if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
            const base = basePath(file, statement.moduleSpecifier.text);
            const target = base && resolve(base);
            if (target) pending.push(target);
          }
        } else if (ts.isExportAssignment(statement)) {
          if (!statement.isExportEquals) add("default");
        } else {
          const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : [];
          if (!modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) continue;
          if (modifiers.some((item) => item.kind === ts.SyntaxKind.DefaultKeyword)) add("default");
          else if (ts.isVariableStatement(statement))
            statement.declarationList.declarations.forEach((item) => binding(item.name));
          else if (
            ts.isFunctionDeclaration(statement) ||
            ts.isClassDeclaration(statement) ||
            ts.isInterfaceDeclaration(statement) ||
            ts.isTypeAliasDeclaration(statement) ||
            ts.isEnumDeclaration(statement) ||
            ts.isModuleDeclaration(statement)
          ) {
            if (statement.name) add(statement.name.text);
          }
        }
      }
    }
    return names;
  };
  for (const [file, text] of files) {
    if (!script.test(file) || (!content(file) && !text.includes("content"))) continue;
    const check = (node: ts.Node, specifier: string, names: string[]) => {
      const base = basePath(file, specifier);
      if (!base || !content(base)) return;
      const location = `${file}:${source(file).getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
      const target = resolve(base);
      if (!target) failures.push(`${location}: ${specifier} is absent from the neutral plan`);
      else {
        const available = exportsOf(target);
        for (const name of names)
          if (!available.has(name)) failures.push(`${location}: ${target} does not export ${name}`);
      }
    };
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const bindings = node.importClause?.namedBindings;
        check(node, node.moduleSpecifier.text, [
          ...(node.importClause?.name ? ["default"] : []),
          ...(bindings && ts.isNamedImports(bindings)
            ? bindings.elements.map((item) => (item.propertyName ?? item.name).text)
            : []),
        ]);
      } else if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        check(
          node,
          node.moduleSpecifier.text,
          node.exportClause && ts.isNamedExports(node.exportClause)
            ? node.exportClause.elements.map((item) => (item.propertyName ?? item.name).text)
            : [],
        );
      } else if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      ) {
        let name = node.qualifier;
        while (name && ts.isQualifiedName(name)) name = name.left;
        check(node, node.argument.literal.text, name ? [name.text] : []);
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteral(node.moduleReference.expression)
      ) {
        check(node, node.moduleReference.expression.text, []);
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        check(node, node.arguments[0].text, []);
      }
      ts.forEachChild(node, visit);
    };
    visit(source(file));
  }
  return failures.sort();
}

prove("AC1", "unset profile is neutral; agency content requires explicit opt-in", () => {
  assert.equal(distributionProfile({}), "neutral");
  assert.equal(distributionProfile({ NEXT_PUBLIC_DISTRIBUTION_PROFILE: "branded" }), "branded");
  assert.equal(distributionProfile({ NEXT_PUBLIC_DISTRIBUTION_PROFILE: "neutral" }), "neutral");
  assert.throws(() => distributionProfile({ NEXT_PUBLIC_DISTRIBUTION_PROFILE: "agency" }));
  assert.match(
    readFileSync("docs/self-hosting/NEUTRAL-DISTRIBUTION.md", "utf8"),
    /NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded/,
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
      if (
        manifest.includePaths?.some((allowed: string) =>
          allowed.endsWith("/") ? path.startsWith(allowed) : path === allowed,
        )
      )
        continue;
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
    assert.deepEqual(JSON.parse(readFileSync("vercel.json", "utf8")).crons, []);
  },
);

prove("AC5-source", "retained content imports match the neutral inclusion/replacement plan", () => {
  const fixture = new Map([
    ["src/content/base.ts", "export const kept = 1; export type Shape = {}; export default [];"],
    ["src/content/index.ts", 'export * from "./base"; export { kept as renamed } from "./base";'],
    [
      "src/view.ts",
      'import value, { kept as alias, type Shape } from "@/content/base"; import { renamed } from "./content";',
    ],
  ]);
  assert.deepEqual(contentImportFailures(fixture), []);
  fixture.set(
    "src/broken.ts",
    'import { missing } from "@/content/base"; import "@/content/omitted"; export { absent } from "./content";',
  );
  const failures = contentImportFailures(fixture);
  assert.equal(failures.length, 3, "Collect every missing export/module before failing");
  for (const expected of [
    "does not export missing",
    "absent from the neutral plan",
    "does not export absent",
  ])
    assert(
      failures.some((failure) => failure.includes(expected)),
      expected,
    );

  const plan = new Map<string, string>(starterFiles().map((path: string) => [path, path]));
  for (const [target, replacement] of Object.entries(loadInclusionManifest().replacements))
    plan.set(target, String(replacement));
  const files = new Map(
    [...plan]
      .filter(
        ([target]) => target.startsWith("src/") && /\.(?:[cm]?[jt]sx?|json|mdx)$/.test(target),
      )
      .map(([target, replacement]) => [target, readFileSync(replacement, "utf8")]),
  );
  const mismatches = contentImportFailures(files);
  assert.deepEqual(
    mismatches,
    [],
    `Neutral content import/export drift:\n${mismatches.join("\n")}`,
  );
});

// Source syntax checks do not replace the actual exported build and qa-turnkey --neutral in CI.

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
