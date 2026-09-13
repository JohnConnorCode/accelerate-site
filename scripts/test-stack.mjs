import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  chmodSync,
  realpathSync,
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
const root = realpathSync(mkdtempSync(join(tmpdir(), "accelerate-package-")));
try {
  for (const file of [
    "compose.yaml",
    "compose.social-marketing.yaml",
    "scripts/stack.mjs",
    "plugins/social-marketing/deployment/compose.yaml",
  ]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(file, join(root, file));
  }
  writeFileSync(join(root, ".env"), "APP_HOST=app.example.test\n");
  const env = {
    ...process.env,
    APP_HOST: "app.example.test",
    POSTIZ_HOST: "social.app.example.test",
    APP_REVISION: "fixture",
    POSTIZ_JWT_SECRET: "a".repeat(64),
    POSTIZ_DB_PASSWORD: "b".repeat(64),
    TEMPORAL_DB_PASSWORD: "c".repeat(64),
  };
  const bareEnv = { ...env, COMPOSE_FILE: "compose.yaml", SOCIAL_MARKETING_ENABLED: "false" };
  for (const key of [
    "POSTIZ_HOST",
    "POSTIZ_JWT_SECRET",
    "POSTIZ_DB_PASSWORD",
    "TEMPORAL_DB_PASSWORD",
  ])
    delete bareEnv[key];
  const bare = JSON.parse(
    execFileSync("docker", ["compose", "config", "--format", "json"], {
      cwd: root,
      env: bareEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  assert.deepEqual(Object.keys(bare.services).sort(), ["app", "proxy"]);
  assert.equal(bare.services.app.environment.POSTIZ_ORIGIN, "");
  assert.ok(
    !bare.services.proxy.volumes.some(
      (v) => v.target === "/srv/source" || v.target === "/etc/caddy/postiz.caddy",
    ),
  );
  env.COMPOSE_FILE = "compose.yaml:compose.social-marketing.yaml";
  const config = JSON.parse(
    execFileSync("docker", ["compose", "config", "--format", "json"], {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  const services = config.services;
  assert.equal(Object.keys(services).length, 7);
  assert.equal(services.app.environment.POSTIZ_ORIGIN, "https://social.app.example.test");
  for (const [name, service] of Object.entries(services))
    if (name !== "proxy") assert.ok(!service.ports?.length, `${name} must remain private`);
  assert.deepEqual(services.proxy.ports.map((p) => p.target).sort(), [443, 80]);
  assert.equal(
    services.postiz.build.context,
    join(root, "plugins/social-marketing/deployment/upstream"),
  );
  assert.equal(
    services.proxy.volumes.find((v) => v.target === "/etc/caddy/Caddyfile").source,
    join(root, "deployment/Caddyfile.social-marketing"),
  );
  assert.equal(
    services.proxy.volumes.find((v) => v.target === "/srv/source").source,
    join(root, "plugins/social-marketing/deployment/source"),
  );
  // Prove default startup never prepares upstream or generates plugin secrets.
  const bin = join(root, "bin");
  mkdirSync(bin);
  const docker = join(bin, "docker");
  writeFileSync(docker, '#!/bin/sh\nprintf "%s\\n" "$COMPOSE_FILE" "$*" >> "$STACK_TEST_LOG"\n');
  chmodSync(docker, 0o700);
  const log = join(root, "calls");
  const initialEnv = readFileSync(join(root, ".env"), "utf8");
  execFileSync(process.execPath, ["scripts/stack.mjs", "up"], {
    cwd: root,
    env: { ...bareEnv, PATH: `${bin}:${process.env.PATH}`, STACK_TEST_LOG: log },
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(readFileSync(join(root, ".env"), "utf8"), initialEnv);
  assert.ok(!existsSync(join(root, "plugins/social-marketing/deployment/upstream")));
  assert.match(
    readFileSync(log, "utf8"),
    /compose.yaml\ncompose up --build --detach --remove-orphans/,
  );
  execFileSync(process.execPath, ["scripts/stack.mjs", "down"], {
    cwd: root,
    env: { ...bareEnv, PATH: `${bin}:${process.env.PATH}`, STACK_TEST_LOG: log },
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.match(readFileSync(log, "utf8"), /compose down --remove-orphans/);
  assert.ok(!readFileSync(log, "utf8").includes("--volumes"));
  console.log(
    "Optional package checks passed: app-only startup has no Postiz configuration/source/secrets; opt-in includes the private services; disabling removes containers without deleting volumes.",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
