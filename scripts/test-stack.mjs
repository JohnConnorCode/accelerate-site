import assert from "node:assert/strict";
import { realpathSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
const root = realpathSync(mkdtempSync(join(tmpdir(), "accelerate-package-")));
try {
  for (const file of ["compose.yaml", "plugins/social-marketing/deployment/compose.yaml"]) {
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
    join(root, "deployment/Caddyfile"),
  );
  assert.equal(
    services.proxy.volumes.find((v) => v.target === "/srv/source").source,
    join(root, "plugins/social-marketing/deployment/source"),
  );
  console.log(
    "One-package Compose wiring passed: shared proxy, automatic origin, private services and matching source paths.",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
