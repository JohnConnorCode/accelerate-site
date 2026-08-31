import { runPsql } from "./lib/accelerate-database.mjs";

const lifecycleFunctions = [
  "platform_create_tenant",
  "platform_upsert_tenant_membership",
  "platform_set_tenant_status",
  "platform_revoke_tenant_membership",
];

const query = String.raw`
SELECT jsonb_build_object(
  'functions', count(*),
  'service_role_execute', bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE')),
  'authenticated_execute', bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'anon_execute', bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY[${lifecycleFunctions.map((name) => `'${name}'`).join(", ")}]);
`;

const result = runPsql(["-t", "-A", "-c", query]);
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const receipt = JSON.parse(result.stdout.trim());
if (
  receipt.functions !== lifecycleFunctions.length
  || receipt.service_role_execute !== true
  || receipt.authenticated_execute !== false
  || receipt.anon_execute !== false
) {
  throw new Error(`Tenant lifecycle privilege verification failed: ${JSON.stringify(receipt)}`);
}

console.log(JSON.stringify({ result: "passed", ...receipt }, null, 2));
