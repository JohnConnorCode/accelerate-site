import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { SetupError } from "./workspace-setup.mjs";
import { bootstrapOwnerMembershipSql } from "./bootstrap-owner-membership.mjs";
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
export function createWorkspaceSetupHost(
  config,
  database,
  catalog,
  { fetch: transport = fetch, env = process.env } = {},
) {
  const client = createClient(config.apiUrl, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) => transport(url, { ...options, signal: AbortSignal.timeout(15000) }),
    },
  });
  const query = (input) => {
    const result = database.runPsql(["--quiet", "--tuples-only", "--no-align"], { input });
    if (result.status !== 0)
      throw new SetupError(
        "Database check failed. Verify PostgreSQL client tools, connection settings and database credentials; no credential values are printed.",
      );
    return JSON.parse(result.stdout.trim());
  };
  const checked = ({ data, error }) => {
    if (error) throw new Error("Service request failed");
    return data;
  };
  return {
    async inspectDatabase() {
      // Existing target/user validation is shared with every migration command.
      database.psqlArgs();
      const state = query(
        "SELECT json_build_object('ledger',to_regclass('public.accelerate_schema_migrations') IS NOT NULL,'tenants',to_regclass('public.tenants') IS NOT NULL,'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'));\n",
      );
      if (!state.ledger && state.tables > 0)
        return { untrackedExisting: true, pending: catalog.length };
      const rows = state.ledger
        ? query(
            "SELECT coalesce(json_agg(json_build_object('file',file,'checksum',checksum)),'[]'::json) FROM public.accelerate_schema_migrations;\n",
          )
        : [];
      const expected = new Map(catalog.map((row) => [row.file, row.checksum]));
      for (const row of rows)
        if (expected.get(row.file) !== row.checksum)
          throw new SetupError(
            "Migration ledger differs from this checkout. Use the matching release or reviewed upgrade procedure; setup will not rewrite migration receipts.",
          );
      const workspace = state.tenants
        ? query(
            "SELECT row_to_json(t) FROM (SELECT id,status,json_build_object('founder',json_build_object('email',config #>> '{founder,email}')) AS config FROM public.tenants WHERE id=public.accelerate_default_tenant_id()) t;\n",
          )
        : null;
      return { untrackedExisting: false, pending: catalog.length - rows.length, workspace };
    },
    async findOwner(email) {
      for (let page = 1; page <= 100; page++) {
        const data = checked(await client.auth.admin.listUsers({ page, perPage: 100 }));
        const match = data.users.find((user) => user.email?.toLowerCase() === email);
        if (match) return match;
        if (data.users.length < 100) return null;
      }
      throw new SetupError(
        "Owner lookup exceeded 10,000 accounts. Use the platform owner recovery procedure; setup will not guess an identity.",
      );
    },
    async createOwner(email, password) {
      const data = checked(
        await client.auth.admin.createUser({ email, password, email_confirm: true }),
      );
      return data.user;
    },
    async assertDatabaseOwner(owner) {
      const match = query(
        `SELECT to_json(EXISTS(SELECT 1 FROM auth.users WHERE id=${literal(owner.id)}::uuid AND lower(email)=${literal(owner.email.toLowerCase())}));\n`,
      );
      if (match !== true)
        throw new SetupError(
          "Auth and database owner identity do not match. Verify both connections point to the same project before retrying.",
        );
    },
    async migrate(bootstrap) {
      const childEnv = { ...env, ...bootstrap };
      delete childEnv.SETUP_OWNER_PASSWORD;
      const result = spawnSync(process.execPath, ["scripts/run-all-migrations.mjs"], {
        cwd: database.repoRoot,
        env: childEnv,
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
      });
      if (result.status !== 0)
        throw new SetupError(
          "Migration application stopped. Completed files remain recorded; an interrupted file rolls back. Check database availability and retry this setup command. Setup never deletes a partial installation.",
        );
    },
    async readWorkspace() {
      const id = checked(await client.rpc("accelerate_default_tenant_id"));
      return checked(await client.from("tenants").select("id,status,config").eq("id", id).single());
    },
    async readMembership(tenantId, userId) {
      return checked(
        await client
          .from("tenant_memberships")
          .select("tenant_id,user_id,role,status,invited_email")
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .maybeSingle(),
      );
    },
    async activateMembership(tenantId, owner) {
      const result = database.runPsql(["--quiet"], {
        input: bootstrapOwnerMembershipSql(tenantId, owner.id, config.ownerEmail),
      });
      if (result.status !== 0)
        throw new SetupError(
          "Bootstrap membership transaction refused or could not be verified. Review the workspace, owner and existing membership; setup never silently restores revoked access. Retry is safe after review.",
        );
    },
  };
}
