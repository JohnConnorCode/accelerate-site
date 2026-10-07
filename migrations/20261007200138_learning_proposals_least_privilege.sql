BEGIN;

-- Learning uses tenant-scoped CRUD, never anonymous access or table-management
-- privileges. ALL also removes MAINTAIN on PostgreSQL 17+, without naming a
-- privilege that PostgreSQL 15/16 do not recognize. Existing RLS stays intact.
REVOKE ALL PRIVILEGES ON TABLE public.learning_proposals FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.learning_proposals TO authenticated;

COMMIT;
