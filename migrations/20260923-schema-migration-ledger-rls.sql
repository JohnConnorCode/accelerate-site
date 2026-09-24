-- The migration ledger is an internal runner table, never an application API.
ALTER TABLE public.accelerate_schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accelerate_schema_migrations FROM PUBLIC, anon, authenticated, service_role;
