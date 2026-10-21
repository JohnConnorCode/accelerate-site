import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  cpSync,
  rmSync,
  symlinkSync,
} from "node:fs";
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
  check("application and fork builds wait for one source typecheck", () => {
    const ci = readFileSync(resolve(source, ".github/workflows/ci.yml"), "utf8");
    const connected = readFileSync(resolve(source, ".github/workflows/connected-fork.yml"), "utf8");
    const section = (text, name) =>
      text.split(`  ${name}:\n`)[1]?.split(/\n  [a-z][a-z-]*:/)[0] ?? "";
    for (const job of ["build", "full-product-fork", "neutral-starter"])
      assert.match(section(ci, job), /needs:.*typecheck/, `${job} must wait for source typing`);
    for (const job of ["release-recovery", "connected-fork"])
      assert.match(
        section(connected, job),
        /needs: typecheck/,
        `${job} must wait for source typing`,
      );
    for (const text of [ci, connected])
      assert.match(section(text, "typecheck"), /run: npm run typecheck/);
    assert.match(section(ci, "verify"), /test "\$TYPECHECK_RESULT" = success/);
  });
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
  check("import and opportunity recovery get early feedback and focused artifacts", () => {
    const workflow = readFileSync(resolve(source, ".github/workflows/ci.yml"), "utf8");
    const command = "node scripts/qa-contact-import-source-review.mjs";
    assert.equal(workflow.split(command).length, 2, "One complete import browser run");
    assert.ok(
      workflow.indexOf(command) <
        workflow.indexOf("- name: Verify credential-free first-run journey"),
    );
    assert.match(workflow, /name: contact-import-browser-evidence/);
    const opportunity = "node scripts/qa-opportunity-create-recovery.mjs";
    assert.equal(workflow.split(opportunity).length, 2, "One complete opportunity browser run");
    assert.ok(
      workflow.indexOf(opportunity) <
        workflow.indexOf("- name: Verify credential-free first-run journey"),
    );
    assert.match(workflow, /name: opportunity-create-browser-evidence/);
    assert.match(
      workflow,
      /PATH="\$\(pg_config --bindir\):\$PATH" npm run test:opportunity-create:postgres/,
    );
  });
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
  check("narrow CI scopes use real Git changes and fail closed", () => {
    const workflow = readFileSync(resolve(source, ".github/workflows/ci.yml"), "utf8");
    const detector = workflow
      .match(
        /- name: Detect narrow pull request scope[\s\S]*?\n        run: \|\n((?:          .*\n)+)/,
      )?.[1]
      ?.replace(/^ {10}/gm, "");
    assert.ok(detector);
    const fixtures = [
      "scripts/test-first-value-business-journey.ts",
      "scripts/test-demo-business-workflows.ts",
      "scripts/test-stripe-workflow.ts",
      "scripts/test-opportunity-create.ts",
    ];
    assert.deepEqual(
      [...detector.matchAll(/scripts\/test-[a-z-]+\.ts/g)].map(([path]) => path).sort(),
      [...fixtures].sort(),
      "Every allowlist addition needs an execution-wiring check",
    );
    const { scripts } = JSON.parse(readFileSync(resolve(source, "package.json"), "utf8"));
    for (const path of fixtures) {
      const script = Object.entries(scripts).find(([, command]) =>
        command.split(/\s+/).includes(path),
      );
      assert.ok(script, `${path} must have a runnable package command`);
      assert.ok(
        scripts["test:core"].split(" && ").includes(`npm run ${script[0]}`),
        `${path} must execute in the unchanged checks job`,
      );
    }
    assert.match(workflow, /run: npm run test:core/);
    assert.match(
      workflow,
      /run: PATH="\$\(pg_config --bindir\):\$PATH" npm run test:reference-business-journeys/,
    );
    const scopeRepo = resolve(scratch, "scope-repo");
    mkdirSync(scopeRepo);
    git(["init", "--template=", "--initial-branch=main"], scopeRepo);
    git(["config", "user.name", "Workflow Test"], scopeRepo);
    git(["config", "user.email", "workflow@example.test"], scopeRepo);
    writeFileSync(resolve(scopeRepo, "README.md"), "base\n");
    git(["add", "."], scopeRepo);
    git(["commit", "-qm", "Base without fixtures"], scopeRepo);
    const withoutFixtures = git(["rev-parse", "HEAD"], scopeRepo);
    mkdirSync(resolve(scopeRepo, "scripts"));
    for (const path of fixtures) writeFileSync(resolve(scopeRepo, path), "base fixture\n");
    git(["add", "."], scopeRepo);
    git(["commit", "-qm", "Existing fixtures"], scopeRepo);
    const base = git(["rev-parse", "HEAD"], scopeRepo);
    const output = resolve(scratch, "scope-output");
    let scopeCases = 0;
    const classify = (paths, eventName = "pull_request", options = {}) => {
      git(["reset", "--hard", base], scopeRepo);
      git(["clean", "-fd"], scopeRepo);
      for (const path of paths) {
        mkdirSync(dirname(resolve(scopeRepo, path)), { recursive: true });
        writeFileSync(resolve(scopeRepo, path), "changed\n");
      }
      if (options.remove) git(["rm", options.remove], scopeRepo);
      if (options.rename) git(["mv", ...options.rename], scopeRepo);
      if (options.symlink) {
        rmSync(resolve(scopeRepo, options.symlink));
        symlinkSync("../README.md", resolve(scopeRepo, options.symlink));
      }
      git(["add", "."], scopeRepo);
      git(["commit", "--allow-empty", "-qm", "Change"], scopeRepo);
      writeFileSync(output, "");
      const result = spawnSync("bash", ["-e", "-c", detector], {
        cwd: scopeRepo,
        env: {
          ...env,
          GITHUB_EVENT_NAME: eventName,
          BASE_SHA: options.baseSha ?? base,
          RUNNER_TEMP: scratch,
          GITHUB_OUTPUT: output,
        },
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
      scopeCases++;
      return Object.fromEntries(
        readFileSync(output, "utf8")
          .trim()
          .split("\n")
          .map((line) => line.split("=")),
      );
    };
    const docs = { docs_only: "true", fixtures_only: "false" };
    const fixture = { docs_only: "false", fixtures_only: "true" };
    const full = { docs_only: "false", fixtures_only: "false" };
    assert.deepEqual(classify(["src/content/docs/start/overview.mdx"]), docs);
    assert.deepEqual(classify(["src/components/docs/DocsSearch.tsx", "scripts/qa-docs.ts"]), docs);
    assert.deepEqual(classify(["src/content/docs/start/file with spaces.mdx"]), docs);
    for (const path of fixtures) assert.deepEqual(classify([path]), fixture);
    assert.deepEqual(classify(fixtures), fixture);
    for (const path of [
      "src/app/admin/page.tsx",
      "src/lib/admin/demo/business-runtime.ts",
      "package.json",
      "package-lock.json",
      "next.config.ts",
      ".env.example",
      ".github/workflows/ci.yml",
      "scripts/verify-docs.ts",
      "scripts/lib/reference-journey-evidence.ts",
      "scripts/test-verification-workflow.mjs",
      "scripts/test-unknown-fixture.ts",
      "scripts/test-first-value-business-journey.ts\nscripts/test-stripe-workflow.ts",
    ])
      assert.deepEqual(classify([fixtures[0], path]), full, path);
    assert.deepEqual(classify([fixtures[0], "src/content/docs/start/overview.mdx"]), full);
    assert.deepEqual(classify([]), full);
    assert.deepEqual(
      classify([fixtures[0]], "pull_request", { baseSha: withoutFixtures }),
      full,
      "Added fixtures",
    );
    assert.deepEqual(
      classify([], "pull_request", { remove: fixtures[0] }),
      full,
      "Deleted fixture",
    );
    assert.deepEqual(
      classify([], "pull_request", { rename: [fixtures[0], "scripts/test-renamed-fixture.ts"] }),
      full,
      "Renamed fixture",
    );
    assert.deepEqual(
      classify([], "pull_request", { symlink: fixtures[0] }),
      full,
      "Type-changed fixture",
    );
    for (const baseSha of ["", "not-a-ref", "f".repeat(40)])
      assert.deepEqual(
        classify([fixtures[0]], "pull_request", { baseSha }),
        full,
        "Missing/invalid base",
      );
    for (const event of ["push", "merge_group", "workflow_dispatch"]) {
      assert.deepEqual(classify([fixtures[0]], event), full, event);
      assert.deepEqual(classify(["src/content/docs/start/overview.mdx"], event), full, event);
    }
    console.log(JSON.stringify({ scopeCases, allowlistedFixtures: fixtures.length }));
  });
  check("CI aggregate requires the matching docs, fixtures or full verification path", () => {
    const workflow = readFileSync(resolve(source, ".github/workflows/ci.yml"), "utf8");
    assert.match(
      workflow,
      /verify:\s+if: \$\{\{ always\(\) && !inputs\.admin_design_only && !inputs\.public_pages_only && !inputs\.cold_start_only \}\}\s+needs: \[scope, typecheck, checks, docs-checks, build, full-product-fork, neutral-starter\]/,
    );
    assert.match(workflow, /admin_design_only:[\s\S]*?type: boolean\s+default: false/);
    assert.match(workflow, /public_pages_only:[\s\S]*?type: boolean\s+default: false/);
    assert.match(workflow, /cold_start_only:[\s\S]*?type: boolean\s+default: false/);
    assert.match(workflow, /scope:\s+runs-on: ubuntu-latest/);
    assert.match(workflow, /docs_only: \$\{\{ steps\.detect\.outputs\.docs_only \}\}/);
    assert.match(workflow, /fixtures_only: \$\{\{ steps\.detect\.outputs\.fixtures_only \}\}/);
    assert.match(
      workflow,
      /docs-checks:\s+needs: scope\s+if: \$\{\{ needs\.scope\.outputs\.docs_only == 'true' \}\}/,
    );
    assert.match(
      workflow,
      /build:\s+needs: \[scope, typecheck\]\s+if: \$\{\{ !inputs\.admin_design_only && !inputs\.cold_start_only && !inputs\.hero_target_url && needs\.scope\.outputs\.fixtures_only != 'true' \}\}/,
    );
    assert.match(workflow, /hero_target_url:[\s\S]*?type: string\s+default: ""/);
    assert.match(
      workflow,
      /hosted-homepage:\s+if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.public_pages_only && inputs\.hero_target_url \}\}/,
    );
    assert.match(workflow, /checks:[\s\S]*?needs: scope[\s\S]*?docs_only != 'true'/);
    for (const job of ["checks", "typecheck"]) {
      const condition = workflow.match(
        new RegExp(`  ${job}:\\n[\\s\\S]*?\\n    if: ([^\\n]+)`),
      )?.[1];
      assert.ok(condition, `${job} must have an explicit condition`);
      assert.doesNotMatch(condition, /fixtures_only/, `${job} must run for fixture-only PRs`);
    }
    for (const job of ["full-product-fork", "neutral-starter"])
      assert.match(
        workflow,
        new RegExp(
          job +
            ":[\\s\\S]*?needs: \\[scope, typecheck\\]\\s+if: [^\\n]*docs_only != 'true'[^\\n]*fixtures_only != 'true'",
        ),
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
      TYPECHECK_RESULT: "success",
      DOCS_ONLY: "false",
      FIXTURES_ONLY: "false",
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
    const fixtures = {
      ...full,
      FIXTURES_ONLY: "true",
      BUILD_RESULT: "skipped",
      NEUTRAL_RESULT: "skipped",
      FULL_FORK_RESULT: "skipped",
    };
    assert.ok(verify(full));
    assert.ok(verify(docs));
    assert.ok(verify(fixtures));
    let refusedResults = 0;
    for (const results of [full, docs, fixtures]) {
      for (const key of Object.keys(results)) {
        for (const value of ["failure", "cancelled", "", "unexpected"]) {
          assert.equal(verify({ ...results, [key]: value }), false, key + " " + value);
          refusedResults++;
        }
        const mismatch = results[key] === "success" ? "skipped" : "success";
        assert.equal(verify({ ...results, [key]: mismatch }), false, key + " mismatched");
        refusedResults++;
      }
      assert.equal(verify({ ...results, TYPECHECK_RESULT: "skipped" }), false);
    }
    assert.equal(verify({ ...fixtures, DOCS_ONLY: "true" }), false);
    console.log(JSON.stringify({ aggregateScopes: 3, refusedResults }));
    assert.match(workflow, /merge_group:/);
    assert.match(workflow, /run: npm run typecheck/);
    assert.match(workflow, /run: npm run build/);
    assert.match(workflow, /run: npm run lint -- --max-warnings=0/);
    assert.match(workflow, /run: npm run format:check/);
    assert.doesNotMatch(
      readFileSync(resolve(source, "next.config.ts"), "utf8"),
      /ignoreBuildErrors\s*:\s*true/,
    );
  });
  check("independent design checks still fail the run when any group fails", () => {
    const workflow = readFileSync(resolve(source, ".github/workflows/ci.yml"), "utf8");
    const design = workflow.split("  admin-design:\n")[1];
    assert.ok(design.indexOf("id: design_captures") < design.indexOf("id: design_modes"));
    for (const id of ["design_captures", "design_routes", "design_modes"]) {
      assert.match(design, new RegExp(`id: ${id}\\n        continue-on-error: true`));
      assert.ok(design.includes(`steps.${id}.outcome`), "Aggregate must use original outcomes");
    }
    const command = design.match(/run: (test "\$CAPTURE_RESULT"[^\n]+)/)?.[1];
    assert.ok(command);
    const passing = { CAPTURE_RESULT: "success", ROUTE_RESULT: "success", MODE_RESULT: "success" };
    assert.equal(
      spawnSync("bash", ["-e", "-c", command], { env: { ...env, ...passing } }).status,
      0,
    );
    for (const key of Object.keys(passing))
      for (const value of ["failure", "cancelled", "skipped", ""]) {
        assert.notEqual(
          spawnSync("bash", ["-e", "-c", command], { env: { ...env, ...passing, [key]: value } })
            .status,
          0,
          `${key}: ${value} cannot pass the design lane`,
        );
      }
  });
  check("compiled design reuse refuses every application or asset change", () => {
    const workflow = readFileSync(resolve(source, ".github/workflows/ci.yml"), "utf8");
    const reuse = workflow
      .split("- name: Verify reusable compiled design source")[1]
      ?.split("- name: Restore")[0];
    assert.ok(reuse);
    assert.match(reuse, /git diff --no-renames --name-only -z "\$source_sha" HEAD --/);
    const guard = reuse.match(
      /          while IFS=[\s\S]*?done < "\$RUNNER_TEMP\/design-reuse-changes"/,
    )?.[0];
    assert.ok(guard);
    const directory = resolve(scratch, "design-reuse");
    mkdirSync(directory);
    const changes = resolve(directory, "design-reuse-changes");
    const permits = (paths) => {
      writeFileSync(changes, paths.length ? paths.join("\0") + "\0" : "");
      return (
        spawnSync("bash", ["-e", "-c", guard], {
          env: { ...env, RUNNER_TEMP: directory },
        }).status === 0
      );
    };
    const plumbing = [
      ".github/workflows/ci.yml",
      "scripts/capture-product-screenshots.ts",
      "scripts/capture-docs-screenshots.mjs",
      "scripts/qa-customer-workflow-context.mjs",
      "scripts/qa-collections-workspace.mjs",
      "scripts/test-verification-workflow.mjs",
    ];
    assert.equal(permits([]), true);
    assert.equal(permits(plumbing), true);
    for (const path of [
      "src/app/layout.tsx",
      "public/images/demo/preview.png",
      "next.config.ts",
      "package.json",
      "package-lock.json",
      "src/content/docs/workspace/settings.mdx",
      "scripts/capture-product-screenshots.ts.backup",
      "unknown\npath",
    ])
      assert.equal(permits([...plumbing, path]), false, path);
    assert.match(workflow, /id: design_build\s+if: \$\{\{ !inputs\.admin_design_preview_run \}\}/);
    assert.match(workflow, /c\.deploymentId!==process\.env\.EXPECTED_RELEASE/);
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
