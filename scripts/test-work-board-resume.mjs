import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "accelerate-work-resume-"));
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
    `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE kanban_columns(tenant_id uuid,board_key text,column_key text,label text,color text,sort_order numeric,is_default boolean,metadata jsonb);`,
  ]);
  run("psql", [...args, "-f", "migrations/20260816-feature-board.sql"]);
  run("psql", [
    ...args,
    "-c",
    `ALTER TABLE feature_requests DROP CONSTRAINT feature_requests_status_check;
    ALTER TABLE feature_requests ADD COLUMN lease_owner text, ADD COLUMN lease_expires_at timestamptz, ADD COLUMN claimed_at timestamptz, ADD COLUMN subtasks jsonb NOT NULL DEFAULT '[]';`,
  ]);
  for (const migration of [
    "20260906-universal-work-board.sql",
    "20260907-work-packet-quality.sql",
    "20260912145031-work-board-resumable-attempts.sql",
    "20260912145031-work-board-resumable-attempts.sql",
  ])
    run("psql", [...args, "-f", `migrations/${migration}`]);
  const output = run("npx", ["tsx", "scripts/test-work-board-resume.ts"], {
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
  if (root.startsWith(join(tmpdir(), "accelerate-work-resume-")))
    rmSync(root, { recursive: true, force: true });
}
