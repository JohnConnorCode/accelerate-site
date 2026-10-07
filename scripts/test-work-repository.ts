import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { repositoryIdentity } from "../src/lib/work-repository.mjs";
import { demoPacketProblems } from "../src/lib/work-packet";
import { workSpecSchema } from "../src/lib/revenue-os/work-board";
import { readinessSummary } from "./lib/agent-readiness.mjs";

const valid = [
  "https://github.com/Example/repo.git",
  "HTTPS://GITHUB.COM/Example/repo.git/",
  "https://git.example.test:8443/team/repo",
  "https://my--git.example.test/team/repo",
  "https://127.0.0.1:443/repo.git",
  "https://[::1]:8443/repo",
  "ssh://git@git.example.test/team/repo.git",
  "ssh://git@git.example.test:2222/team/repo.git",
  "ssh://git.example.test/team/repo.git",
  "ssh://git@[2001:db8::1]:2222/team/repo",
  "git@git.example.test:team/repo.git",
  "deploy-bot@git.example.test:team/repo.git",
  "file:///tmp/fixture.git",
  "file://localhost/tmp/fixture.git",
  "file:///tmp/fixture%20space.git",
];
const invalid = [
  "local:Accelerate-agency/accelerate-site",
  "http://github.com/team/repo",
  "git://github.com/team/repo",
  "https:///github.com/team/repo",
  "https://github.com",
  "https://github.com/",
  "https://github.com///",
  "https://token@github.com/team/repo",
  "https://user:fixture-secret@github.com/team/repo",
  "ssh://git:fixture-secret@git.example.test/repo",
  "ssh://git%40token@git.example.test/repo",
  "https://github.com/team/repo?token=fixture-secret",
  "https://github.com/team/repo#fixture-secret",
  "https://github.com:0/team/repo",
  "ssh://git.example.test:65536/repo",
  "https://github.com:999999/team/repo",
  "https://999.999.999.999/repo",
  "https://127.1/repo",
  "https://0177.0.0.1/repo",
  "https://example.0x01/repo",
  "https://-example.test/repo",
  "https://example..test/repo",
  "https://[::::]/repo",
  "https://github.com/team/../repo",
  "https://github.com/team/%2e%2e/repo",
  "https://github.com/team/repo%xx",
  "https://github.com\\team/repo",
  "https://github.com/team\n/repo",
  " https://github.com/team/repo",
  "https://github.com/team/repo ",
  "file://remote.test/tmp/repo.git",
  "file:relative.git",
  "file:///",
  "file:///tmp/../repo.git",
  "",
];
const spec = {
  packetVersion: 2,
  northstar: { phase: "B", layers: ["See", "Act"], contribution: "Safe contributor pickup" },
  businessValue: "Select only usable work",
  currentBehavior: "Controlled repository fixture",
  scope: ["Repository readiness"],
  exclusions: ["No real work or provider effects"],
  references: [{ path: "scripts/test-work-repository.ts", reason: "Controlled proof" }],
  workflow: ["Validate and claim controlled work"],
  failureModes: ["Invalid addresses remain unclaimed"],
  requiredCapabilities: ["code"],
  acceptance: [{ id: "AC1", criterion: "Usable source contract", environment: "local" }],
  verification: [
    { command: "npm run test:work-repository", expected: "Pass", environment: "local" },
  ],
  repository: { url: valid[0]!, baseBranch: "main", baseCommit: "a".repeat(40) },
};
const cases = [
  ...valid.map((url) => ({ url, valid: true })),
  ...invalid.map((url) => ({ url, valid: false })),
];
for (const [index, item] of cases.entries()) {
  const packet = { ...spec, repository: { ...spec.repository, url: item.url } };
  assert.equal(repositoryIdentity(item.url) !== null, item.valid, `address case ${index}`);
  assert.equal(workSpecSchema.safeParse(packet).success, item.valid, `mutation case ${index}`);
  const reasons = demoPacketProblems(packet);
  assert.equal(reasons.length === 0, item.valid, `fictional readiness case ${index}`);
  if (!item.valid && item.url) assert.ok(reasons.includes("invalid_repository_url"));
}
assert.equal(repositoryIdentity(null), null);
assert.equal(repositoryIdentity({ toString: () => valid[0] }), null);
assert.equal(repositoryIdentity("https://example.test/" + "a".repeat(500)), null);
assert.equal(repositoryIdentity(valid[0]), repositoryIdentity(valid[1]));
assert.equal(repositoryIdentity(valid[12]), repositoryIdentity(valid[13]));
assert.notEqual(repositoryIdentity(valid[6]), repositoryIdentity(valid[7]));
assert.equal(repositoryIdentity(valid[6]), repositoryIdentity(valid[10]));
const blocked = readinessSummary(
  Array.from({ length: 20 }, (_, index) => ({
    id: randomUUID(),
    seed_key: `broken-${index}`,
    status: "planned",
    labels: ["milestone:now"],
    readiness: ["invalid_repository_url"],
    work_spec: { repository: { url: invalid[8] } },
  })),
);
assert.equal(blocked.repositoryProblems!.length, 10);
assert.equal(blocked.reasons.invalid_repository_url, 20);
assert.ok(!JSON.stringify(blocked).includes("fixture-secret"));
console.log(
  `PASS: ${cases.length} shared address, mutation and fictional readiness cases; identity aliases and SSH port boundaries.`,
);

const port = process.env.WORK_TEST_PG_PORT;
const database = process.env.WORK_TEST_PG_DATABASE;
if (port || database) {
  if (!port || !/^\d+$/.test(port) || !database || !/^[a-z0-9_]+$/.test(database))
    throw new Error("Use the isolated PostgreSQL work-board runner");
  const lit = (value: unknown) =>
    value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
  const sql = (query: string) =>
    execFileSync(
      "psql",
      [
        "-X",
        "-h",
        "127.0.0.1",
        "-p",
        port,
        "-U",
        "postgres",
        "-d",
        database,
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
        "-t",
        "-A",
        "-c",
        query,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  for (const [index, item] of cases.entries()) {
    assert.equal(
      sql(`SELECT public.work_repository_url_valid(${lit(item.url)})`),
      item.valid ? "t" : "f",
      `SQL address case ${index}`,
    );
    const packet = { ...spec, repository: { ...spec.repository, url: item.url } };
    assert.deepEqual(
      JSON.parse(
        sql(`SELECT to_jsonb(public.work_packet_problems(${lit(JSON.stringify(packet))}::jsonb))`),
      ).sort(),
      demoPacketProblems(packet).sort(),
      `SQL packet case ${index}`,
    );
  }
  const call = (operation: string, id: string | null, revision: number | null, payload: unknown) =>
    JSON.parse(
      sql(
        `SELECT public.mutate_work_board('repository-fixture',${lit(operation)},${lit(id)}::uuid,${lit(revision)}::bigint,${lit(randomUUID())}::uuid,${lit(randomUUID())},${lit(JSON.stringify(payload))}::jsonb,ARRAY['repository-fixture'],false)`,
      ),
    );
  const create = (url: string) =>
    call("create", null, null, {
      project_key: "repository-fixture",
      title: "Controlled legacy repository",
      description: "Prove unusable work cannot be claimed",
      acceptance_criteria: "Validate its repository",
      labels: ["milestone:now"],
      work_kind: "bug",
      work_spec: { ...spec, repository: { ...spec.repository, url } },
    }).card;
  const broken = create(invalid[0]!);
  const before = sql(
    `SELECT to_jsonb(f)::text FROM public.feature_requests f WHERE id=${lit(broken.id)}::uuid`,
  );
  assert.ok(
    JSON.parse(
      sql(`SELECT to_jsonb(public.work_board_readiness(${lit(broken.id)}::uuid))`),
    ).includes("invalid_repository_url"),
  );
  assert.throws(
    () =>
      call("claim", broken.id, broken.revision, {
        claim_token_hash: "a".repeat(64),
        worker_capabilities: ["code"],
      }),
    /invalid_repository_url/,
  );
  assert.equal(
    sql(`SELECT to_jsonb(f)::text FROM public.feature_requests f WHERE id=${lit(broken.id)}::uuid`),
    before,
    "refused claim leaves the entire card unchanged",
  );
  assert.equal(
    sql(`SELECT count(*) FROM public.work_board_attempts WHERE card_id=${lit(broken.id)}::uuid`),
    "0",
  );
  assert.equal(
    sql(`SELECT count(*) FROM public.work_board_events WHERE card_id=${lit(broken.id)}::uuid`),
    "1",
    "only the create event exists",
  );
  const ready = create(valid[0]!);
  const claimed = call("claim", null, null, {
    claim_token_hash: "b".repeat(64),
    worker_capabilities: ["code"],
  });
  assert.equal(claimed.card.id, ready.id, "automatic dispatch skips the legacy invalid card");
  assert.equal(claimed.card.status, "in_progress");
  assert.equal(
    sql(
      `SELECT has_function_privilege('anon','public.work_repository_url_valid(text)','EXECUTE') OR has_function_privilege('authenticated','public.work_repository_url_valid(text)','EXECUTE')`,
    ),
    "f",
  );
  assert.equal(
    sql(
      "SELECT has_function_privilege('service_role','public.work_repository_url_valid(text)','EXECUTE')",
    ),
    "t",
  );
  assert.equal(
    sql(
      "SELECT prosecdef FROM pg_proc WHERE oid='public.work_repository_url_valid(text)'::regprocedure",
    ),
    "f",
  );
  console.log(
    `PASS: ${cases.length} native PostgreSQL address/packet parity cases; explicit refusal, unchanged state/history, automatic valid claim and service-only invoker access.`,
  );
}
