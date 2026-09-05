import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
await import("./test-migration-catalog.mjs");
const root = mkdtempSync(join(tmpdir(), "accelerate-ledger-proof-"));
const port = await new Promise((resolve, reject) => {
  const s = createServer();
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
function run(command, args, options = {}) {
  const r = spawnSync(command, args, { encoding: "utf8", ...options });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || `${command} could not start`);
  return r.stdout;
}
let started = false;
try {
  run("initdb", ["-D", join(root, "data"), "-A", "trust", "-U", "postgres"]);
  run("pg_ctl", [
    "-D",
    join(root, "data"),
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k ${root}`,
    "-w",
    "start",
  ]);
  started = true;
  run("psql", [
    "-X",
    "-h",
    "127.0.0.1",
    "-p",
    String(port),
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;",
  ]);
  console.log(
    run(process.execPath, ["scripts/test-migration-ledger.mjs"], {
      env: {
        ...process.env,
        SUPABASE_DB_HOST: "127.0.0.1",
        SUPABASE_DB_PORT: String(port),
        SUPABASE_DB_USER: "postgres",
        SUPABASE_DB_NAME: "postgres",
        SUPABASE_PROJECT_REF: "local",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
        SUPABASE_DB_PASSWORD: "local-test",
      },
    }).trim(),
  );
} finally {
  if (started) run("pg_ctl", ["-D", join(root, "data"), "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
