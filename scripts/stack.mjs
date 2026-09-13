import { existsSync, readFileSync, appendFileSync, writeFileSync, renameSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.error || result.status !== 0)
    throw new Error(`${command} failed; existing data is retained.`);
  return result.stdout?.trim();
}
if (!existsSync(".env")) throw new Error("Copy .env.example to .env and configure your app first.");
process.loadEnvFile(".env");
if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(process.env.APP_HOST || ""))
  throw new Error("Set APP_HOST to your application hostname in .env.");
process.env.POSTIZ_HOST ||= `social.${process.env.APP_HOST}`;
process.env.APP_REVISION ||= run("git", ["rev-parse", "--short=12", "HEAD"], true);
const mode = process.argv[2] || "up";
if (!["up", "down", "config", "owner"].includes(mode))
  throw new Error("Use up, down, config or owner.");
if (mode === "up") {
  for (const key of ["POSTIZ_JWT_SECRET", "POSTIZ_DB_PASSWORD", "TEMPORAL_DB_PASSWORD"]) {
    if (!process.env[key]) {
      process.env[key] = randomBytes(32).toString("hex");
      appendFileSync(".env", `\n${key}=${process.env[key]}\n`, { mode: 0o600 });
    }
  }
  const base = "plugins/social-marketing/deployment/";
  const stamp = createHash("sha256")
    .update(
      ["prepare-source.sh", "identity.patch", "service-hardening.patch"]
        .map((p) => readFileSync(base + p))
        .join("\n"),
    )
    .digest("hex");
  if (
    !existsSync(base + "source/PACKAGE-SHA256") ||
    readFileSync(base + "source/PACKAGE-SHA256", "utf8") !== stamp
  ) {
    const suffix = `.previous-${Date.now()}`;
    for (const path of ["upstream", "source"])
      if (existsSync(base + path)) renameSync(base + path, base + path + suffix);
    run("bash", [base + "prepare-source.sh"]);
    writeFileSync(base + "source/PACKAGE-SHA256", stamp);
  }
  run("docker", ["compose", "up", "--build", "--detach"]);
} else if (mode === "owner") {
  run("node", ["plugins/social-marketing/deployment/bootstrap-owner.mjs", "--package"]);
} else run("docker", ["compose", ...(mode === "config" ? ["config", "--quiet"] : ["down"])]);
