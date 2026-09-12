import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Source evidence only. Browser visibility and usability need separate measured journeys. */
export function auditAdminLanguage(root = process.cwd(), sourceOverrides = {}) {
  const problems = [];
  const parse = (file) =>
    ts.createSourceFile(
      file,
      sourceOverrides[file] ?? readFileSync(resolve(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  const visit = (node, fn) => {
    fn(node);
    ts.forEachChild(node, (child) => visit(child, fn));
  };
  const property = (node, key) =>
    node.properties.find(
      (p) =>
        ts.isPropertyAssignment(p) &&
        p.name.getText().replaceAll('"', "").replaceAll("'", "") === key,
    )?.initializer;
  const literal = (node) =>
    node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      ? node.text
      : undefined;
  const evidence = (file, node) =>
    `${file}:${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  const links = [];
  visit(parse("src/lib/admin/navigation.ts"), (node) => {
    if (!ts.isObjectLiteralExpression(node)) return;
    const id = literal(property(node, "id")),
      label = literal(property(node, "label")),
      href = literal(property(node, "href"));
    if (id && label && href)
      links.push({ id, label, href, source: evidence("src/lib/admin/navigation.ts", node) });
  });
  let guidance;
  visit(parse("src/lib/admin/page-guidance.ts"), (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText() === "adminPageGuidance")
      guidance = node.initializer;
  });
  if (!guidance || !ts.isObjectLiteralExpression(guidance))
    throw new Error("Guidance registry must be an object");
  const pages = [];
  function walk(dir) {
    for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else if (entry.name === "page.tsx") pages.push(file);
    }
  }
  walk("src/app/admin");
  function introductions(file, seen = new Set()) {
    if (seen.has(file)) return [];
    seen.add(file);
    const tree = parse(file),
      found = [],
      used = new Set();
    visit(tree, (node) => {
      if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
      used.add(node.tagName.getText());
      if (node.tagName.getText() !== "PageHeader") return;
      const attr = (name) =>
        node.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText() === name)
          ?.initializer;
      const title = attr("title"),
        subtitle = attr("subtitle");
      const canonicalIds = [];
      if (title)
        visit(title, (part) => {
          if (
            ts.isCallExpression(part) &&
            ts.isIdentifier(part.expression) &&
            part.expression.text === "adminPageName" &&
            literal(part.arguments[0])
          )
            canonicalIds.push(literal(part.arguments[0]));
        });
      found.push({
        canonicalIds,
        literalTitle:
          literal(title) ??
          (title && ts.isJsxExpression(title) ? literal(title.expression) : undefined),
        source: evidence(file, node),
        title: title?.getText() ?? null,
        subtitle: subtitle?.getText() ?? null,
        guidance: attr("guidance")?.getText() ?? "shared destination guidance",
      });
    });
    if (found.length) return found;
    // Follow rendered local components, not every imported helper or transitive dependency.
    for (const statement of tree.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      const clause = statement.importClause;
      const names = [
        clause?.name?.text,
        ...(clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
          ? clause.namedBindings.elements.map((e) => e.name.text)
          : []),
      ];
      if (!names.some((name) => used.has(name))) continue;
      const spec = statement.moduleSpecifier.text;
      const base = spec.startsWith("@/")
        ? `src/${spec.slice(2)}`
        : spec.startsWith(".")
          ? relative(root, resolve(root, dirname(file), spec))
          : null;
      if (!base) continue;
      const child = [base, `${base}.tsx`, `${base}/index.tsx`].find(
        (p) => existsSync(resolve(root, p)) && p.endsWith(".tsx"),
      );
      if (child) found.push(...introductions(child, seen));
    }
    return found;
  }
  const destinations = links.map((link) => {
    const help = property(guidance, link.id);
    const description =
      help && ts.isObjectLiteralExpression(help) ? literal(property(help, "description")) : null;
    const steps = help && ts.isObjectLiteralExpression(help) ? property(help, "steps") : null;
    const guideHref =
      help && ts.isObjectLiteralExpression(help) ? literal(property(help, "guideHref")) : null;
    if (
      !description?.trim() ||
      !steps ||
      !ts.isArrayLiteralExpression(steps) ||
      steps.elements.length < 2 ||
      steps.elements.some((step) => !literal(step)?.trim())
    )
      problems.push(`Missing meaningful contextual guidance for ${link.id}`);
    if (
      !guideHref?.startsWith("/docs/") ||
      !existsSync(resolve(root, `src/content/docs/${guideHref?.slice(6)}.mdx`))
    )
      problems.push(`Missing guide target for ${link.id}: ${guideHref}`);
    const owned = pages
      .filter((file) => {
        const route = file.replace("src/app", "").replace(/\/page\.tsx$/, "");
        return (
          [...links]
            .sort((a, b) => b.href.length - a.href.length)
            .find(
              (candidate) =>
                route === candidate.href.split("?")[0] ||
                route.startsWith(`${candidate.href.split("?")[0]}/`),
            )
            ?.href.split("?")[0] === link.href.split("?")[0]
        );
      })
      .map((file) => ({
        route: file.replace("src/app", "").replace(/\/page\.tsx$/, ""),
        file,
        introductions: introductions(file),
      }));
    const page = owned.find((p) => p.route === link.href.split("?")[0]);
    if (!page) problems.push(`Missing root page for ${link.id}`);
    else if (
      !page.introductions.some(
        (item) => item.literalTitle === link.label || item.canonicalIds.includes(link.id),
      )
    )
      problems.push(`Root heading does not use canonical ${link.label}: ${page.file}`);
    for (const p of owned)
      if (!p.introductions.length) problems.push(`No source-bound introduction for ${p.file}`);
    return {
      ...link,
      guidance: {
        source: help ? evidence("src/lib/admin/page-guidance.ts", help) : null,
        description,
        guideHref,
      },
      pages: owned,
    };
  });
  const header = parse("src/components/admin/PageHeader.tsx");
  let helpButton = false,
    helpDialog = false,
    heading = false;
  visit(header, (node) => {
    if (!ts.isJsxOpeningElement(node)) return;
    const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
    if (node.tagName.getText() === "h1") heading = true;
    if (
      node.tagName.getText() === "button" &&
      attrs.some((p) => p.name.getText() === "aria-expanded")
    )
      helpButton = true;
    if (
      attrs.some((p) => p.name.getText() === "role" && literal(p.initializer) === "dialog") &&
      attrs.some((p) => p.name.getText() === "aria-label")
    )
      helpDialog = true;
  });
  if (!heading || !helpButton || !helpDialog)
    problems.push(
      "Shared PageHeader must retain heading and accessible optional help trigger/dialog",
    );
  return {
    result: problems.length ? "failed" : "passed",
    scope: "Core registry root/detail source inventory; not browser proof",
    destinations,
    problems,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditAdminLanguage();
  if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else
    console.log(
      JSON.stringify(
        {
          result: report.result,
          destinations: report.destinations.length,
          pages: report.destinations.reduce((n, d) => n + d.pages.length, 0),
          problems: report.problems,
        },
        null,
        2,
      ),
    );
  if (report.problems.length) process.exitCode = 1;
}
