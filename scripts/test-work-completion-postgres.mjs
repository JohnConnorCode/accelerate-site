import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "accelerate-work-completion-"));
const data = join(root, "data");
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}
let started = false;
try {
  run("initdb", ["-A", "trust", "-U", "postgres", "-D", data]);
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-F -h 127.0.0.1 -k '' -p ${port}`,
    "-w",
    "start",
  ]);
  started = true;
  const args = [
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
    "-q",
  ];
  run("psql", [
    ...args,
    "-c",
    `
    CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;
    CREATE FUNCTION public.accelerate_default_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT private.request_tenant_id() $$;
    CREATE FUNCTION private.authorized_request_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT private.request_tenant_id() $$;
    CREATE FUNCTION private.has_active_tenant_membership(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
  `,
  ]);
  run("psql", [...args, "-f", "migrations/20260902-work-items.sql"]);
  const output = run("npx", ["tsx", "scripts/test-work-completion-postgres.ts"], {
    env: {
      ...process.env,
      NODE_OPTIONS: "--conditions=react-server",
      WORK_TEST_PG_PORT: String(port),
    },
  });
  console.log(output.trim());
} catch (error) {
  if (!started) {
    try {
      console.error(readFileSync(join(root, "postgres.log"), "utf8"));
    } catch {
      /* Server may not have started. */
    }
  }
  throw error;
} finally {
  if (started) spawnSync("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { encoding: "utf8" });
  if (root.startsWith(join(tmpdir(), "accelerate-work-completion-")))
    rmSync(root, { recursive: true, force: true });
}
