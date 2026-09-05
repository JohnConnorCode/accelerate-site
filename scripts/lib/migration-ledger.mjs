import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MIGRATION_MANIFEST, EXCLUDED_MIGRATIONS } from "./migration-manifest.mjs";
import { applyBootstrapIdentitySubstitution } from "./bootstrap-identity.mjs";
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
export function migrationCatalog(root) {
  const files = ["migrations", "supabase"].flatMap((dir) =>
    readdirSync(join(root, dir))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => `${dir}/${f}`),
  );
  const known = new Set([...MIGRATION_MANIFEST, ...Object.keys(EXCLUDED_MIGRATIONS)]);
  if (known.size !== MIGRATION_MANIFEST.length + Object.keys(EXCLUDED_MIGRATIONS).length)
    throw new Error("Duplicate migration classification");
  const unknown = files.filter((file) => !known.has(file));
  const missing = [...known].filter((file) => !files.includes(file));
  if (unknown.length || missing.length)
    throw new Error(
      `Migration classification mismatch: unclassified=${unknown.join(",")}; missing=${missing.join(",")}`,
    );
  return MIGRATION_MANIFEST.map((file) => {
    const source = readFileSync(join(root, file), "utf8");
    if (
      /^\s*\\/m.test(source) ||
      /\bCONCURRENTLY\b|^\s*(?:VACUUM|COMMIT AND CHAIN|ROLLBACK)\b/im.test(source)
    )
      throw new Error(`Migration cannot run in a ledger transaction: ${file}`);
    const begins = source.match(/^BEGIN;\s*$/gm) ?? [];
    const commits = source.match(/^COMMIT;\s*$/gm) ?? [];
    if (begins.length !== commits.length || begins.length > 1)
      throw new Error(`Unsupported transaction wrapper: ${file}`);
    return {
      file,
      checksum: createHash("sha256").update(source).digest("hex"),
      sql: applyBootstrapIdentitySubstitution(
        source.replace(/^BEGIN;\s*$/m, "").replace(/^COMMIT;\s*$/m, ""),
      ),
    };
  });
}
export function migrationProgram(catalog, { through } = {}) {
  if (through && !catalog.some((m) => m.file === through))
    throw new Error("Unknown --through migration");
  const end = through ? catalog.findIndex((m) => m.file === through) + 1 : catalog.length;
  const selected = catalog.slice(0, end);
  return `\\set ON_ERROR_STOP on
\\set VERBOSITY terse
SET standard_conforming_strings=on;
SET lock_timeout='15s';
DO $guard$ BEGIN
 IF NOT pg_try_advisory_lock(482917624) THEN
 RAISE EXCEPTION 'Another migration runner is active. Retry after it completes.';
 END IF;
END $guard$;
DO $guard$ BEGIN
 IF to_regclass('public.accelerate_schema_migrations') IS NULL AND EXISTS (
 SELECT 1 FROM pg_tables WHERE schemaname='public') THEN
 RAISE EXCEPTION 'Existing database has no migration ledger. Refusing to replay historical migrations; use a reviewed baseline adoption, or a new empty project.';
 END IF;
END $guard$;
CREATE TABLE IF NOT EXISTS public.accelerate_schema_migrations (
 file text PRIMARY KEY, checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'), applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.accelerate_schema_migrations FROM PUBLIC, anon, authenticated, service_role;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.accelerate_schema_migrations WHERE file NOT IN (${catalog.map((m) => literal(m.file)).join(",")})) THEN
 RAISE EXCEPTION 'Database contains a migration unknown to this release; upgrade the code before migrating.';
 END IF;
END $guard$;
${selected
  .map(
    (m) => `
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.accelerate_schema_migrations WHERE file=${literal(m.file)} AND checksum<>${literal(m.checksum)}) THEN
 RAISE EXCEPTION 'Applied migration changed: ${m.file}';
 END IF;
END $guard$;
SELECT EXISTS(SELECT 1 FROM public.accelerate_schema_migrations WHERE file=${literal(m.file)}) AS applied \\gset
\\if :applied
\\echo Verified ${m.file}
\\else
\\echo Applying ${m.file}
BEGIN;
${m.sql}
INSERT INTO public.accelerate_schema_migrations(file,checksum) VALUES(${literal(m.file)},${literal(m.checksum)});
COMMIT;
\\endif
`,
  )
  .join("\n")}
SELECT pg_advisory_unlock(482917624);
`;
}
