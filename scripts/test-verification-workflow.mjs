import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(resolve(tmpdir(), "accelerate-hook-test-"));
const repo = resolve(scratch, "repo");
mkdirSync(repo);
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: resolve(scratch, "global-config"),
  GIT_CONFIG_NOSYSTEM: "1",
};
for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"])
  delete env[name];
let cases = 0;
function run(command, args, cwd = repo) {
  return spawnSync(command, args, { cwd, env, encoding: "utf8" });
}
function git(args, cwd = repo) {
  const result = run("git", args, cwd);
  assert.equal(result.status, 0, `git ${args[0]}: ${result.stderr}`);
  return result.stdout.trim();
}
function write(file, value) {
  mkdirSync(dirname(resolve(repo, file)), { recursive: true });
  writeFileSync(resolve(repo, file), value);
}
function hook() {
  return run(process.execPath, ["scripts/verify-commit.mjs"]);
}
function check(name, fn) {
  fn();
  cases++;
  console.log(`ok ${cases} - ${name}`);
}
function reset() {
  git(["reset", "--hard", "HEAD"]);
  git(["clean", "-fd"]);
}
try {
  git(["init", "--template=", "--initial-branch=main"]);
  git(["config", "user.name", "Workflow Test"]);
  git(["config", "user.email", "workflow@example.test"]);
  for (const file of [
    ".githooks/pre-commit",
    "scripts/verify-commit.mjs",
    "scripts/install-git-hooks.mjs",
    "scripts/lib/source-safety.mjs",
  ]) {
    mkdirSync(dirname(resolve(repo, file)), { recursive: true });
    cpSync(resolve(source, file), resolve(repo, file));
  }
  write("valid.json", '{"ready":true}\n');
  git(["add", "."]);
  git(["commit", "-qm", "Fixture baseline"]);
  const other = resolve(scratch, "other");
  git(["worktree", "add", "-b", "other", other]);
  const legacyHook = resolve(repo, ".git/hooks/pre-commit");
  mkdirSync(dirname(legacyHook), { recursive: true });
  writeFileSync(legacyHook, "#!/bin/sh\n# preserved legacy hook\nexit 0\n", { mode: 0o755 });
  check("installer preserves legacy hooks and isolates the current worktree", () => {
    assert.equal(run(process.execPath, ["scripts/install-git-hooks.mjs"]).status, 0);
    assert.equal(git(["config", "--worktree", "--get", "core.hooksPath"]), ".githooks");
    assert.equal(run("git", ["config", "--get", "core.hooksPath"], other).status, 1);
    assert.match(readFileSync(legacyHook, "utf8"), /preserved legacy hook/);
    assert.equal(run(process.execPath, ["scripts/install-git-hooks.mjs"]).status, 0);
  });
  check("linked worktree installation preserves an existing custom override", () => {
    git(["config", "--worktree", "core.hooksPath", ".custom-hooks"], other);
    assert.notEqual(run(process.execPath, ["scripts/install-git-hooks.mjs"], other).status, 0);
    assert.equal(git(["config", "--worktree", "--get", "core.hooksPath"], other), ".custom-hooks");
    git(["config", "--worktree", "--unset", "core.hooksPath"], other);
    assert.equal(run(process.execPath, ["scripts/install-git-hooks.mjs"], other).status, 0);
    assert.equal(git(["config", "--worktree", "--get", "core.hooksPath"], other), ".githooks");
  });
  check("valid staged JSON passes despite invalid unstaged JSON without mutating either", () => {
    write("valid.json", '{"ready":false}\n');
    git(["add", "valid.json"]);
    const staged = git(["write-tree"]);
    write("valid.json", "{not json}");
    assert.equal(hook().status, 0);
    assert.equal(git(["write-tree"]), staged);
    assert.equal(readFileSync(resolve(repo, "valid.json"), "utf8"), "{not json}");
  });
  reset();
  check("unstaged fixes cannot hide invalid staged JSON", () => {
    write("valid.json", "{not json}");
    git(["add", "valid.json"]);
    write("valid.json", "{}\n");
    assert.notEqual(hook().status, 0);
  });
  reset();
  check("known secret findings are redacted", () => {
    const specimen = ["sk", "-or-v1-", "a".repeat(64)].join("");
    write("credentials.ts", `export const token = "${specimen}";\n`);
    git(["add", "."]);
    const result = hook();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /OpenRouter secret key/);
    assert.ok(!`${result.stdout}${result.stderr}`.includes(specimen));
  });
  reset();
  check("unstaged secrets are outside the commit check", () => {
    write("valid.json", '{"ready":false}\n');
    git(["add", "valid.json"]);
    write("private.ts", ["sk", "-or-v1-", "b".repeat(64)].join(""));
    assert.equal(hook().status, 0);
  });
  reset();
  check("root and nested environment files are rejected", () => {
    for (const file of [".env.local", "nested/.env.production"]) {
      write(file, "EXAMPLE=value\n");
      git(["add", file]);
      assert.notEqual(hook().status, 0);
      reset();
    }
  });
  check("environment examples remain allowed", () => {
    write(".env.example", "EXAMPLE=\n");
    git(["add", ".env.example"]);
    assert.equal(hook().status, 0);
  });
  reset();
  check("key file names are rejected without inspecting their contents", () => {
    write("private.pem", "fixture\n");
    git(["add", "."]);
    assert.notEqual(hook().status, 0);
  });
  reset();
  check("whitespace and conflict markers refuse commits", () => {
    for (const value of ["trailing space \n", `${"<".repeat(7)} HEAD\nconflict\n`]) {
      write("change.txt", value);
      git(["add", "."]);
      assert.notEqual(hook().status, 0);
      reset();
    }
  });
  check("spaces/newlines in filenames are handled as single staged paths", () => {
    write("nested/a file\nname.json", "{}\n");
    git(["add", "."]);
    assert.equal(hook().status, 0);
  });
  reset();
  check("deletions and renames are valid", () => {
    git(["mv", "valid.json", "renamed file.json"]);
    assert.equal(hook().status, 0);
    reset();
    git(["rm", "valid.json"]);
    assert.equal(hook().status, 0);
  });
  reset();
  check("real Git commits use the installed hook", () => {
    write("valid.json", '{"committed":true}\n');
    git(["add", "."]);
    const before = git(["rev-parse", "HEAD"]);
    git(["commit", "-qm", "Accepted by staged hook"]);
    assert.notEqual(git(["rev-parse", "HEAD"]), before);
    write("valid.json", "invalid");
    git(["add", "."]);
    const refused = run("git", ["commit", "-qm", "Must refuse"]);
    assert.notEqual(refused.status, 0);
  });
  reset();
  check("navigation performance runs after parallel browser suites finish", () => {
    const workflow = readFileSync(resolve(source, ".github/workflows/ci.yml"), "utf8");
    const command = "node scripts/qa-public-navigation-profile.mjs --services-only";
    assert.equal(workflow.split(command).length, 2, "Exactly one performance run");
    assert.ok(
      workflow.indexOf(command) > workflow.indexOf('wait "$browser_pid"'),
      "No competing browser group while measuring performance",
    );
    assert.match(
      workflow,
      /if ! node scripts\/qa-public-navigation-profile\.mjs --services-only; then browser_status=1; fi/,
    );
  });
  check("docs-only CI scope excludes shared code and workflow edits", () => {
    const workflow = readFileSync(resolve(source, ".github/workflows/ci.yml"), "utf8");
    const detector = workflow
      .match(
        /- name: Detect docs-only pull request[\s\S]*?\n        run: \|\n((?:          .*\n)+)/,
      )?.[1]
      ?.replace(/^ {10}/gm, "");
    assert.ok(detector);
    const scopeRepo = resolve(scratch, "scope-repo");
    mkdirSync(scopeRepo);
    git(["init", "--template=", "--initial-branch=main"], scopeRepo);
    git(["config", "user.name", "Workflow Test"], scopeRepo);
    git(["config", "user.email", "workflow@example.test"], scopeRepo);
    writeFileSync(resolve(scopeRepo, "README.md"), "base\n");
    git(["add", "."], scopeRepo);
    git(["commit", "-qm", "Base"], scopeRepo);
    const base = git(["rev-parse", "HEAD"], scopeRepo);
    const output = resolve(scratch, "scope-output");
    const classify = (paths, eventName = "pull_request") => {
      git(["reset", "--hard", base], scopeRepo);
      git(["clean", "-fd"], scopeRepo);
      for (const path of paths) {
        mkdirSync(dirname(resolve(scopeRepo, path)), { recursive: true });
        writeFileSync(resolve(scopeRepo, path), "changed\n");
      }
      git(["add", "."], scopeRepo);
      git(["commit", "-qm", "Change"], scopeRepo);
      writeFileSync(output, "");
      const result = spawnSync("bash", ["-e", "-c", detector], {
        cwd: scopeRepo,
        env: {
          ...env,
          GITHUB_EVENT_NAME: eventName,
          BASE_SHA: base,
          RUNNER_TEMP: scratch,
          GITHUB_OUTPUT: output,
        },
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
      return readFileSync(output, "utf8").trim();
    };
    assert.equal(classify(["src/content/docs/start/overview.mdx"]), "docs_only=true");
    assert.equal(
      classify(["src/components/docs/DocsSearch.tsx", "scripts/qa-docs.ts"]),
      "docs_only=true",
    );
    assert.equal(
      classify(["src/content/docs/start/overview.mdx", "src/app/admin/page.tsx"]),
      "docs_only=false",
    );
    assert.equal(classify([".github/workflows/ci.yml"]), "docs_only=false");
    assert.equal(classify(["scripts/verify-docs.ts"]), "docs_only=false");
    assert.equal(classify(["src/content/docs/start/overview.mdx"], "push"), "docs_only=false");
  });
  check("CI aggregate requires the matching docs or full verification path", () => {
    const workflow = readFileSync(resolve(source, ".github/workflows/ci.yml"), "utf8");
    assert.match(
      workflow,
      /verify:\s+if: \$\{\{ always\(\) && !inputs\.admin_design_only && !inputs\.public_pages_only && !inputs\.cold_start_only \}\}\s+needs: \[scope, checks, docs-checks, build, full-product-fork, neutral-starter\]/,
    );
    assert.match(workflow, /admin_design_only:[\s\S]*?type: boolean\s+default: false/);
    assert.match(workflow, /public_pages_only:[\s\S]*?type: boolean\s+default: false/);
    assert.match(workflow, /cold_start_only:[\s\S]*?type: boolean\s+default: false/);
    assert.match(workflow, /scope:\s+runs-on: ubuntu-latest/);
    assert.match(workflow, /docs_only: \$\{\{ steps\.detect\.outputs\.docs_only \}\}/);
    assert.match(
      workflow,
      /case "\$path" in[\s\S]*?'src\/app\/\(marketing\)\/docs\/'\*[\s\S]*?\*\) echo 'docs_only=false'/,
    );
    assert.match(
      workflow,
      /docs-checks:\s+needs: scope\s+if: \$\{\{ needs\.scope\.outputs\.docs_only == 'true' \}\}/,
    );
    assert.match(
      workflow,
      /build:\s+needs: scope\s+if: \$\{\{ !inputs\.admin_design_only && !inputs\.cold_start_only \}\}/,
    );
    for (const job of ["checks", "full-product-fork", "neutral-starter"])
      assert.match(
        workflow,
        new RegExp(job + ":[\\s\\S]*?needs: scope[\\s\\S]*?docs_only != 'true'"),
      );
    assert.match(workflow, /admin-design:\s+if: \$\{\{ inputs\.admin_design_only \}\}/);
    const command = workflow
      .match(
        /- name: Require all verification jobs[\s\S]*?\n        run: \|\n((?:          .*\n)+)/,
      )?.[1]
      ?.replace(/^ {10}/gm, "");
    assert.ok(command);
    const verify = (results) =>
      spawnSync("bash", ["-e", "-c", command], { env: { ...env, ...results } }).status === 0;
    const full = {
      SCOPE_RESULT: "success",
      DOCS_ONLY: "false",
      CHECKS_RESULT: "success",
      DOCS_CHECKS_RESULT: "skipped",
      BUILD_RESULT: "success",
      NEUTRAL_RESULT: "success",
      FULL_FORK_RESULT: "success",
    };
    const docs = {
      ...full,
      DOCS_ONLY: "true",
      CHECKS_RESULT: "skipped",
      DOCS_CHECKS_RESULT: "success",
      NEUTRAL_RESULT: "skipped",
      FULL_FORK_RESULT: "skipped",
    };
    assert.ok(verify(full));
    assert.ok(verify(docs));
    for (const results of [full, docs]) {
      for (const key of Object.keys(results)) {
        assert.equal(verify({ ...results, [key]: "failure" }), false, key + " failed");
        assert.equal(verify({ ...results, [key]: "cancelled" }), false, key + " cancelled");
      }
      assert.equal(verify({ ...results, BUILD_RESULT: "skipped" }), false);
    }
    assert.match(workflow, /merge_group:/);
    assert.doesNotMatch(workflow, /run: npm run typecheck/);
    assert.match(workflow, /run: npm run build/);
    assert.match(workflow, /run: npm run lint -- --max-warnings=0/);
    assert.match(workflow, /run: npm run format:check/);
    assert.doesNotMatch(
      readFileSync(resolve(source, "next.config.ts"), "utf8"),
      /ignoreBuildErrors\s*:\s*true/,
    );
  });
  check("uninstall restores the previous hook lookup", () => {
    git(["config", "--worktree", "--unset", "core.hooksPath"]);
    assert.equal(run("git", ["config", "--get", "core.hooksPath"]).status, 1);
    assert.match(readFileSync(legacyHook, "utf8"), /preserved legacy hook/);
  });
  console.log(JSON.stringify({ result: "passed", cases }));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
