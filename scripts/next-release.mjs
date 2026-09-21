import { deploymentPreflight, deploymentConfigArgs } from "./deployment-preflight.mjs";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout?.trim() ?? "";
}

function releaseId() {
  const explicitId = process.env.NEXT_DEPLOYMENT_ID?.trim();
  const source = explicitId || run("git", ["rev-parse", "--short=12", "HEAD"], { capture: true });
  const value = source.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  if (!value) throw new Error("A deployment id is required for a production release.");
  return value;
}

const [mode, ...args] = process.argv.slice(2);
let hostingArgs = [];
if (mode === "vercel-build" || mode === "vercel-deploy") {
  const target = deploymentPreflight();
  hostingArgs = deploymentConfigArgs(target, args);
}
const deploymentId = releaseId();
const env = { ...process.env, NEXT_DEPLOYMENT_ID: deploymentId };

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function verifyPrebuiltIdentity() {
  const documentRoot = ".vercel/output/functions/api/admin/knowledge/documents.func";
  const documentConfig = readJson(`${documentRoot}/.vc-config.json`);
  const architecture = documentConfig.architecture || "x86_64";
  const nativeArch = { x86_64: "x64", arm64: "arm64" }[architecture];
  if (!nativeArch) throw new Error("Unsupported document function architecture");
  const nativePath = `node_modules/@napi-rs/canvas-linux-${nativeArch}-gnu/skia.linux-${nativeArch}-gnu.node`;
  // Current Vercel builds reference source files through a repository-relative map.
  // Standalone artifacts can instead carry the file within the function directory.
  const native = readFileSync(
    documentConfig.filePathMap?.[nativePath] || join(documentRoot, nativePath),
  );
  if (
    native.length < 20 ||
    native.subarray(0, 4).toString("hex") !== "7f454c46" ||
    native[5] !== 1 ||
    native.readUInt16LE(18) !== (nativeArch === "x64" ? 62 : 183)
  ) {
    throw new Error(
      "Document parser requires the matching Linux native binary. Rebuild before deploying.",
    );
  }
  const requiredServerFiles = readJson(".next/required-server-files.json");
  const serializedConfig = requiredServerFiles.config || {};
  if (serializedConfig.deploymentId !== deploymentId) {
    throw new Error(
      `Prebuilt output does not preserve release id ${deploymentId}. Rebuild before deploying.`,
    );
  }
  if (serializedConfig.experimental?.runtimeServerDeploymentId !== false) {
    throw new Error(
      "Prebuilt output may replace the custom release id at runtime. Refusing deployment.",
    );
  }
  const fallback = ".vercel/output/functions/demo/command-center.prerender-fallback.html";
  if (!existsSync(fallback)) {
    // Published website settings make the launcher server-rendered in a
    // connected installation. Verify its packaged server configuration instead
    // of requiring an HTML artifact that only exists in credential-free builds.
    const functionRoot = ".vercel/output/functions/demo/command-center.func";
    const metadata = readJson(`${functionRoot}/.vc-config.json`);
    if (metadata.handler !== "___next_launcher.cjs")
      throw new Error("Unrecognized demo server artifact. Refusing deployment.");
    const launcher = readFileSync(`${functionRoot}/___next_launcher.cjs`, "utf8");
    const serialized = launcher.match(/^const conf = (\{[^\n]+\});$/m)?.[1];
    if (!serialized) throw new Error("Demo server has no verifiable Next configuration.");
    const config = JSON.parse(serialized);
    if (
      config.deploymentId !== deploymentId ||
      config.experimental?.runtimeServerDeploymentId !== false
    )
      throw new Error("Demo server artifact does not preserve the exact release identity.");
    return;
  }
  const document = readFileSync(fallback, "utf8");
  const documentIds = new Set(
    [...document.matchAll(/\?dpl=([a-zA-Z0-9_-]+)/g)].map((match) => match[1]),
  );
  if (documentIds.size !== 1 || !documentIds.has(deploymentId)) {
    throw new Error(
      `Prebuilt document contains competing deployment ids: ${[...documentIds].join(", ") || "none"}.`,
    );
  }
}

if (mode === "build") {
  console.log(`Building production release ${deploymentId}`);
  if (env.ACCELERATE_PREBUILT_NATIVE === "1") {
    // npm normally omits other OS/CPU optional packages on a local prebuilt host.
    // Install only the existing lockfile-pinned Linux variants, without scripts or lock edits.
    const packages = readJson("package-lock.json").packages;
    const temporary = mkdtempSync(join(tmpdir(), "accelerate-document-runtime-"));
    try {
      for (const arch of ["x64", "arm64"]) {
        const name = `@napi-rs/canvas-linux-${arch}-gnu`;
        const locked = packages[`node_modules/${name}`];
        if (!locked?.resolved || !locked.integrity?.startsWith("sha512-"))
          throw new Error(`Missing locked document runtime: ${name}`);
        const packed = JSON.parse(
          run(
            "npm",
            [
              "pack",
              locked.resolved,
              "--ignore-scripts",
              "--json",
              "--pack-destination",
              temporary,
            ],
            { capture: true },
          ),
        )[0];
        const archive = join(temporary, packed.filename);
        const integrity =
          "sha512-" + createHash("sha512").update(readFileSync(archive)).digest("base64");
        if (integrity !== locked.integrity)
          throw new Error(`Document runtime integrity mismatch: ${name}`);
        const destination = join("node_modules", name);
        mkdirSync(destination, { recursive: true });
        run("tar", ["-xzf", archive, "--strip-components=1", "-C", destination]);
      }
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  run("next", ["build", ...args], { env });
} else if (mode === "start") {
  console.log(`Starting production release ${deploymentId}`);
  run("next", ["start", ...args], { env });
} else if (mode === "vercel-build") {
  console.log(`Building production release ${deploymentId}`);
  run("vercel", ["build", "--prod", ...args, ...hostingArgs], {
    env: { ...env, ACCELERATE_PREBUILT_NATIVE: "1" },
  });
} else if (mode === "verify-prebuilt") {
  verifyPrebuiltIdentity();
  console.log(`Verified prebuilt release ${deploymentId}`);
} else if (mode === "vercel-deploy") {
  console.log(`Deploying production release ${deploymentId}`);
  verifyPrebuiltIdentity();
  run("vercel", ["deploy", "--prebuilt", "--prod", "--archive=tgz", ...args, ...hostingArgs], {
    env,
  });
} else {
  throw new Error(`Unknown release command: ${mode || "(missing)"}`);
}
