-- Close Supabase's public Data API to this database.
--
-- Supabase publishes every table in the public schema through its REST API,
-- where the anon and authenticated roles can reach it with the project's
-- public key. Every table here had Row-Level Security off and full grants to
-- both roles, so anyone with that key could read, change or delete users,
-- subscriptions and identifications.
--
-- Sorrel never uses that API. The app talks only to this backend, which
-- connects as postgres: the owner of these tables, with BYPASSRLS. Nothing
-- below changes what the backend can do.
--
-- Two layers, so either one alone still protects the data:
--   1. Row-Level Security on, with no policies: the API roles see no rows.
--   2. The API roles' privileges removed, including on tables created later.
-- run-migrations.js also re-enables RLS on any public table missing it, every
-- time it runs, so a future migration can't quietly reopen this.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Trigger functions can't be called directly, but they have no business being
-- executable by the API roles either.
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.create_user_preferences() FROM anon, authenticated;

-- Supabase's defaults grant the API roles full access to anything postgres
-- creates in public. Tables added by later migrations must not inherit that.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
